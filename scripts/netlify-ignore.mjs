import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { QUIET_PERIOD_MS, RELEASE_MESSAGE, RELEASE_PATH } from "./publication-policy.mjs";

export function shouldBuild({ cwd = process.cwd() } = {}) {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    if (git("log", "-1", "--format=%s") !== RELEASE_MESSAGE) return false;
    const marker = JSON.parse(git("show", `HEAD:${RELEASE_PATH}`));
    return marker.sourceRevision === git("rev-parse", "HEAD^") &&
      marker.quietPeriodSeconds === QUIET_PERIOD_MS / 1000 &&
      Number.isFinite(Date.parse(marker.releasedAt)) &&
      git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD") === RELEASE_PATH;
  } catch {
    // Missing or stale release markers must never publish a partial CMS update.
    return false;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const build = shouldBuild();
  console.log(build ? "Quiet period complete: run tests and build." : "Changes saved: waiting for the grouped publication.");
  // Netlify's ignore command uses 0 to stop and 1 to continue.
  process.exitCode = build ? 1 : 0;
}
