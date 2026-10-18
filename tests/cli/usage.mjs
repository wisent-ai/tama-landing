// `tama-landing` answers its help as help and anything else but `build` as a
// wrong invocation. `--help`, `-h` and `help` print the usage on stdout,
// nothing on stderr, and exit 0. A bare call, an unknown command and `build`
// with an extra word print the usage on stderr, nothing on stdout, exit 2,
// and build nothing: no case here reaches the build. Every case runs
// src/cli.mjs as a user would.
//
//   node tests/cli/usage.mjs
//
// A defect register that measures a repair by this run names the defect and
// its criterion in TAMA_LANDING_TEST_DEFECT and TAMA_LANDING_TEST_CRITERION;
// when every case passes on committed source the run writes criterion.json
// under .build/real-tests/cli-usage/<stamp>/ (tests/cli/qualification.mjs),
// with every run's arguments, exit status and output as observed final state.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MISUSE, SUCCEEDED, qualification, root } from "./qualification.mjs";

const cli = path.join(root, "src", "cli.mjs");
const usage = "Usage: tama-landing build\n";
const qualified = qualification("cli-usage", fileURLToPath(import.meta.url));
const runs = [];

function landing(args) {
  const run = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
  runs.push({ args, exit: run.status, stdout: run.stdout, stderr: run.stderr });
  return run;
}

for (const words of [["--help"], ["-h"], ["help"]]) {
  const run = landing(words);
  assert.equal(run.status, SUCCEEDED, `${words.join(" ")} exited ${run.status}:\n${run.stderr}`);
  assert.equal(run.stdout, usage);
  assert.equal(run.stderr, "", "help prints nothing on stderr");
}

for (const words of [[], ["no-such-command"], ["build", "extra"]]) {
  const run = landing(words);
  assert.equal(run.status, MISUSE, `${words.join(" ")} exited ${run.status}:\n${run.stdout}`);
  assert.equal(run.stdout, "", "a refused invocation prints nothing on stdout");
  assert.equal(run.stderr, usage);
}

console.log("cli usage: help exits 0 on stdout; a wrong invocation exits 2 on stderr");

qualified.report(runs);
