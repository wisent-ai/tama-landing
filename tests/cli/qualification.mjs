// What a CLI journey needs to qualify a repair for a defect register: the
// committed revision it ran, and, when TAMA_LANDING_TEST_DEFECT and
// TAMA_LANDING_TEST_CRITERION name the defect and criterion, a criterion.json
// under .build/real-tests/<journey>/<stamp>/ holding the revision, the digests
// of the Node binary and of the journey, every git command it ran, and the
// runs it observed as final state. Without those variables nothing is
// written; a journey that asks for a report refuses uncommitted CLI source.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// The shell's statuses for success and misuse (https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html).
export const SUCCEEDED = 0;
export const MISUSE = 2; // https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html

/**
 * A journey's qualification: its revision, and its report when one is asked
 * for. `sources` are the paths whose uncommitted changes refuse a report: the
 * product the journey runs and the journey itself.
 */
export function qualification(journey, journeyFile, sources) {
  const defectId = process.env.TAMA_LANDING_TEST_DEFECT?.trim();
  const criterion = process.env.TAMA_LANDING_TEST_CRITERION?.trim();
  assert.equal(Boolean(defectId), Boolean(criterion),
    "TAMA_LANDING_TEST_DEFECT and TAMA_LANDING_TEST_CRITERION are named together or not at all");
  const commands = [];
  const git = (...args) => {
    const run = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(run.status, SUCCEEDED, run.stderr);
    commands.push({ executable: "git", args, exit: run.status });
    return run.stdout;
  };
  const revision = git("rev-parse", "HEAD").trim();
  const uncommitted = git("status", "--porcelain", "--", ...sources);
  assert.ok(!defectId || uncommitted === "", `commit ${sources.join(", ")} before qualification`);
  return {
    /** Writes the criterion report when one was asked for; `runs` is the observed final state. */
    report(runs) {
      if (!defectId) return;
      const digest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
      const out = path.join(root, ".build", "real-tests", journey, new Date().toISOString().replace(/[:.]/g, ""));
      mkdirSync(out, { recursive: true });
      const file = path.join(out, "criterion.json");
      writeFileSync(file, `${JSON.stringify({
        defectId,
        criterion,
        sourceRevision: revision,
        result: "passed",
        binarySha256: digest(process.execPath),
        testSha256: digest(journeyFile),
        observedFinalState: { runs },
        commands,
      }, null, "  ")}\n`, { mode: constants.S_IRUSR | constants.S_IWUSR });
      console.log(`criterion report: ${file}`);
    },
  };
}
