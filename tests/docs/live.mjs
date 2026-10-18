// The live documentation is what the pushed source builds: HEAD must be the
// commit origin/main names, src/cli.mjs builds it into dist/, and every page
// the build wrote under dist/docs is fetched from the site's origin (read from
// the build's own sitemap) and must answer 200 with exactly the bytes the
// build wrote. A push that never reached the site, or a site serving an older
// build, fails here naming each page that differs.
//
//   node tests/docs/live.mjs
//
// With TAMA_LANDING_TEST_DEFECT and TAMA_LANDING_TEST_CRITERION set, a passing
// run on committed sources writes criterion.json under
// .build/real-tests/docs-live/<stamp>/ (tests/cli/qualification.mjs) with the
// origin, every page's status and digest and both git reads as observed state.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUCCEEDED, qualification, root } from "../cli/qualification.mjs";

const qualified = qualification("docs-live", fileURLToPath(import.meta.url), ["src", "content", "site", "tests/docs"]);
const runs = [];

function run(program, args) {
  const answer = spawnSync(program, args, { cwd: root, encoding: "utf8" });
  runs.push({ program, args, exit: answer.status, stderr: answer.stderr });
  if (answer.error) throw new Error(`${program} could not run: ${answer.error.message}`);
  assert.equal(answer.status, SUCCEEDED, `${program} ${args.join(" ")} exited ${answer.status}:\n${answer.stderr}`);
  return answer.stdout;
}

const head = run("git", ["rev-parse", "HEAD"]).trim();
const [pushed] = run("git", ["ls-remote", "origin", "refs/heads/main"]).split(/\s/);
assert.equal(head, pushed, `HEAD ${head} is not the pushed main ${pushed}; the live site can only be compared with what was pushed`);
run(process.execPath, [path.join("src", "cli.mjs"), "build"]);

const dist = path.join(root, "dist");
const sitemap = readFileSync(path.join(dist, "sitemap.xml"), "utf8");
const located = sitemap.match(/<loc>(?<loc>[^<]+)<\/loc>/);
assert.ok(located, "the built sitemap names no page");
const origin = new URL(located.groups.loc).origin;

const pages = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "index.html") pages.push(full);
  }
};
walk(path.join(dist, "docs"));
assert.ok(pages.length, "the build wrote no page under dist/docs");

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const observed = [];
const differing = [];
for (const page of pages) {
  const route = `/${path.relative(dist, path.dirname(page)).split(path.sep).join("/")}/`;
  const built = readFileSync(page);
  const response = await fetch(new URL(route, origin), { redirect: "manual" });
  const served = Buffer.from(await response.arrayBuffer());
  const entry = { route, status: response.status, built: digest(built), served: digest(served) };
  observed.push(entry);
  if (!response.ok || entry.built !== entry.served) differing.push(`${origin}${route}: ${response.status}, serves ${entry.served}, main builds ${entry.built}`);
}
runs.push({ origin, head, pages: observed });
assert.deepEqual(differing, [], `${differing.length} of ${pages.length} live pages are not what main ${head} builds:\n${differing.join("\n")}`);

console.log(`docs live: every one of ${pages.length} pages at ${origin} is what main ${head} builds`);

qualified.report(runs);
