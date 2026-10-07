import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { releaseAfterQuiet } from "../scripts/release-after-quiet.mjs";
import { shouldBuild } from "../scripts/netlify-ignore.mjs";
import { QUIET_PERIOD_MS, RELEASE_MESSAGE, RELEASE_PATH } from "../scripts/publication-policy.mjs";

const fixture = async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lartdelou-publication-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const remote = path.join(root, "remote.git");
  const cwd = path.join(root, "editor");
  await fs.mkdir(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--bare", remote);
  git("init", "-b", "main");
  git("config", "user.name", "CMS test");
  git("config", "user.email", "cms@example.test");
  git("remote", "add", "origin", remote);
  const publish = async (file = "artwork.md", contents = "image: ancienne.png\n") => {
    await fs.writeFile(path.join(cwd, file), contents);
    git("add", ".");
    git("commit", "-m", `Publish ${file}`);
    git("push", "origin", "main");
    return git("rev-parse", "HEAD");
  };
  const expectedRevision = await publish();
  let time = 0;
  const timing = { now: () => time, sleep: async (ms) => { time += ms; } };
  return { cwd, git, publish, expectedRevision, timing, elapsed: () => time };
};

test("one release after three quiet minutes starts a single build without changing content", async (t) => {
  const f = await fixture(t);
  assert.equal(shouldBuild(f), false);
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing }), "released");
  assert.equal(f.elapsed(), QUIET_PERIOD_MS);
  assert.equal(shouldBuild(f), true);
  assert.equal(f.git("rev-parse", "HEAD^"), f.expectedRevision);
  assert.equal(f.git("diff", "HEAD^", "HEAD", "--", "artwork.md"), "");
  assert.equal(f.git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"), RELEASE_PATH);
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing, expectedRevision: f.git("rev-parse", "HEAD") }), "already-released");
});

test("a second publication cancels the old deadline and gets its own full three minutes", async (t) => {
  const f = await fixture(t);
  let elapsed = 0;
  let newest;
  const result = await releaseAfterQuiet({
    ...f,
    now: () => elapsed,
    sleep: async (ms) => {
      elapsed += ms;
      if (elapsed === 45000) newest = await f.publish("artwork.md", "image: nouvelle.png\n");
    },
  });
  assert.equal(result, "superseded");
  assert.equal(elapsed, 45000);
  assert.equal(shouldBuild(f), false);
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing, expectedRevision: newest }), "released");
  assert.equal(f.elapsed(), QUIET_PERIOD_MS);
  assert.match(f.git("show", "HEAD:artwork.md"), /nouvelle/);
});

test("uploads and deletions restart the same deadline even without editing a fiche", async (t) => {
  const f = await fixture(t);
  let newest;
  const result = await releaseAfterQuiet({ ...f, ...f.timing, sleep: async (ms) => {
    await f.timing.sleep(ms);
    if (!newest) newest = await f.publish("photo.png", "uploaded image");
  } });
  assert.equal(result, "superseded");
  assert.equal(shouldBuild(f), false);
  f.git("rm", "photo.png");
  f.git("commit", "-m", "Delete photo");
  f.git("push", "origin", "main");
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing, expectedRevision: newest }), "superseded");
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing, expectedRevision: f.git("rev-parse", "HEAD") }), "released");
  assert.equal(shouldBuild(f), true);
  assert.equal(f.git("ls-tree", "HEAD", "photo.png"), "");
});

test("a late/out-of-order run and a stale marker cannot launch a build", async (t) => {
  const f = await fixture(t);
  const newest = await f.publish("artwork.md", "image: nouvelle.png\n");
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing }), "superseded");
  assert.equal(f.elapsed(), 0);
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing, expectedRevision: newest }), "released");
  await f.publish("artwork.md", "image: ancienne.png\n");
  assert.equal(shouldBuild(f), false);
  f.git("commit", "--allow-empty", "-m", RELEASE_MESSAGE);
  assert.equal(shouldBuild(f), false);
});

test("a publication racing with the release push is preserved and never overwritten", async (t) => {
  const f = await fixture(t);
  const second = path.join(path.dirname(f.cwd), "second-editor");
  f.git("clone", "--branch", "main", f.git("remote", "get-url", "origin"), second);
  let newer;
  const git = (...args) => {
    if (args[0] === "push") {
      const otherGit = (...params) => execFileSync("git", params, { cwd: second, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
      otherGit("-c", "user.name=CMS", "-c", "user.email=cms@example.test", "commit", "--allow-empty", "-m", "Concurrent publication");
      otherGit("push", "origin", "main");
      newer = otherGit("rev-parse", "HEAD");
    }
    return f.git(...args);
  };
  assert.equal(await releaseAfterQuiet({ ...f, ...f.timing, git }), "superseded");
  assert.equal(f.git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0], newer);
});
