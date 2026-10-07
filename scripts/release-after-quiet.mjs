import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { QUIET_PERIOD_MS, RELEASE_MESSAGE, RELEASE_PATH } from "./publication-policy.mjs";

export async function releaseAfterQuiet({
  expectedRevision,
  cwd = process.cwd(),
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim(),
}) {
  if (!/^[a-f0-9]{40}$/.test(expectedRevision || "")) throw new Error("Missing publication revision");
  const latest = () => git("ls-remote", "origin", "refs/heads/main").split(/\s/)[0];
  const started = now();
  // Cancellation is also configured in GitHub Actions. The head check protects
  // against delayed/out-of-order runs and a change just before the release.
  while (true) {
    if (latest() !== expectedRevision) return "superseded";
    const remaining = QUIET_PERIOD_MS - (now() - started);
    if (remaining <= 0) break;
    await sleep(Math.min(15000, remaining));
  }
  if (git("rev-parse", "HEAD") !== expectedRevision) throw new Error("Unexpected checkout revision");
  if (git("log", "-1", "--format=%s") === RELEASE_MESSAGE) return "already-released";
  mkdirSync(path.join(cwd, path.dirname(RELEASE_PATH)), { recursive: true });
  writeFileSync(path.join(cwd, RELEASE_PATH), JSON.stringify({
    sourceRevision: expectedRevision,
    releasedAt: new Date(now()).toISOString(),
    quietPeriodSeconds: QUIET_PERIOD_MS / 1000,
  }, null, 2) + "\n");
  git("add", "--", RELEASE_PATH);
  git("-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
    "commit", "-m", RELEASE_MESSAGE);
  try {
    // A normal push is atomic and refuses to overwrite a concurrent CMS save.
    git("push", "origin", "HEAD:refs/heads/main");
  } catch (error) {
    if (latest() !== expectedRevision) return "superseded";
    throw error;
  }
  return "released";
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(await releaseAfterQuiet({ expectedRevision: process.env.GITHUB_SHA }));
}
