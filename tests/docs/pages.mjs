// What the site builds reaches a reader: src/check-pages.mjs, run as a user
// would, accepts every page, and the site src/cli.mjs builds into dist/ then
// holds no Markdown table delimiter row in any page and no /docs/ link to a
// route it did not build. The check reads the sources the way the build does;
// this journey also reads what the build wrote, so a check and a build that
// came apart are both caught.
//
//   node tests/docs/pages.mjs
//
// With TAMA_LANDING_TEST_DEFECT and TAMA_LANDING_TEST_CRITERION set, a passing
// run on committed sources writes criterion.json under
// .build/real-tests/docs-pages/<stamp>/ (tests/cli/qualification.mjs) with both
// runs and every broken link or table it found as observed final state.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUCCEEDED, qualification, root } from "../cli/qualification.mjs";

const qualified = qualification("docs-pages", fileURLToPath(import.meta.url),
  ["src", "content", "site", "tests/docs", "tests/cli/qualification.mjs"]);
const runs = [];

function node(args) {
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  runs.push({ args, exit: run.status, stdout: run.stdout, stderr: run.stderr });
  return run;
}

const checked = node([path.join("src", "check-pages.mjs")]);
assert.equal(checked.status, SUCCEEDED, `check-pages exited ${checked.status}:\n${checked.stderr}`);
assert.match(checked.stdout, /^check-pages: every page under content\/docs is registered/);

const built = node([path.join("src", "cli.mjs"), "build"]);
assert.equal(built.status, SUCCEEDED, `build exited ${built.status}:\n${built.stderr}`);

const docs = path.join(root, "dist", "docs");
const pages = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === "index.html") pages.push(full);
  }
};
walk(docs);
assert.ok(pages.length, "the build wrote no page under dist/docs");

const broken = [];
for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const name = path.relative(root, page);
  if (/^\s*\|\s*:?-+:?\s*\|/m.test(html)) broken.push(`${name}: a Markdown table delimiter row`);
  for (const [, route] of html.matchAll(/href="\/docs\/([^"#?]*)/g)) {
    if (!existsSync(path.join(docs, route, "index.html"))) broken.push(`${name}: /docs/${route} names no built page`);
  }
}
runs.push({ builtPages: pages.length, broken });
assert.deepEqual(broken, [], `the built site reaches readers broken:\n${broken.join("\n")}`);

console.log(`docs pages: check-pages accepts every page, and none of the ${pages.length} built pages holds a Markdown table or a /docs/ link to no page`);

qualified.report(runs);
