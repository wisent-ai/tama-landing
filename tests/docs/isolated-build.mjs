// The publishing build needs nothing but this repository: the committed tree
// at HEAD, exported alone into a fresh directory with no sibling checkout
// beside it (as a hosting clone receives it), builds with the command the
// hosting configuration declares and writes the site's documentation index.
// A build step that reads ../tama or another neighbour fails here exactly as
// it fails on the host.
//
//   node tests/docs/isolated-build.mjs
//
// The export is made under .build/isolated-build/<uuid>/ and removed after a
// passing run; a failing run leaves it for inspection. With
// TAMA_LANDING_TEST_DEFECT and TAMA_LANDING_TEST_CRITERION set, a passing run
// on committed sources writes criterion.json under
// .build/real-tests/isolated-build/<stamp>/ (tests/cli/qualification.mjs).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUCCEEDED, qualification, root } from "../cli/qualification.mjs";

const qualified = qualification("isolated-build", fileURLToPath(import.meta.url),
  ["src", "content", "site", "package.json", "vercel.json", "tests/docs"]);
const runs = [];

function run(program, args, cwd) {
  const answer = spawnSync(program, args, { cwd, encoding: "utf8" });
  runs.push({ program, args, cwd: path.relative(root, cwd), exit: answer.status, stdout: answer.stdout, stderr: answer.stderr });
  if (answer.error) throw new Error(`${program} could not run: ${answer.error.message}`);
  return answer;
}

const hosting = JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8"));
assert.ok(hosting.buildCommand, "vercel.json declares no buildCommand");
assert.ok(hosting.outputDirectory, "vercel.json declares no outputDirectory");

const parent = path.join(root, ".build", "isolated-build", randomUUID());
const tree = path.join(parent, "tama-landing");
mkdirSync(tree, { recursive: true });
const archive = path.join(parent, "tree.tar");
const exported = run("git", ["archive", "--format=tar", `--output=${archive}`, "HEAD"], root);
assert.equal(exported.status, SUCCEEDED, exported.stderr);
const unpacked = run("tar", ["-xf", archive, "-C", tree], root);
assert.equal(unpacked.status, SUCCEEDED, unpacked.stderr);

const [program, ...words] = hosting.buildCommand.split(" ");
const built = run(program, words, tree);
assert.equal(built.status, SUCCEEDED, `${hosting.buildCommand} in a lone export exited ${built.status}:\n${built.stdout}${built.stderr}`);
const index = path.join(tree, hosting.outputDirectory, "docs", "index.html");
assert.ok(existsSync(index), `${hosting.buildCommand} wrote no ${path.relative(tree, index)}`);

rmSync(parent, { recursive: true, force: true });
console.log(`isolated build: ${hosting.buildCommand} builds the committed tree alone and writes ${hosting.outputDirectory}/docs/index.html`);

qualified.report(runs);
