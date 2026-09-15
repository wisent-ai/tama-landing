import { strict as assert } from "node:assert";

const origin = (process.env.TAMA_DOCS_ORIGIN || "https://tama.wisent.com").replace(/\/$/, "");
const canonicalOrigin = (process.env.TAMA_DOCS_CANONICAL_ORIGIN || "https://tama.wisent.com").replace(/\/$/, "");
const commands = [
  "/docs/cli/help",
  "/docs/cli/list",
  "/docs/cli/show",
  "/docs/cli/validate",
  "/docs/cli/install-plan",
  "/docs/cli/install",
  "/docs/cli/verify",
  "/docs/cli/mcp-config",
  "/docs/cli/find-violations",
  "/docs/cli/clean",
  "/docs/cli/brama-check",
  "/docs/cli/sessions",
  "/docs/cli/assignment/show",
  "/docs/cli/justify",
  "/docs/cli/enforcement/status",
  "/docs/cli/enforcement/only",
  "/docs/cli/enforcement/preflight",
  "/docs/cli/enforcement/all",
  "/docs/cli/serve",
  "/docs/cli/adaptive",
  "/docs/cli/adaptive/status",
  "/docs/cli/adaptive/drift",
  "/docs/cli/adaptive/queue",
  "/docs/cli/adaptive/repair",
  "/docs/cli/adaptive/apply",
  "/docs/cli/adaptive/install",
  "/docs/cli/adaptive/uninstall",
  "/docs/cli/adaptive/claude-config",
  "/docs/cli/worktrees",
  "/docs/cli/worktrees/list",
  "/docs/cli/worktrees/remove",
  "/docs/cli/copies",
  "/docs/cli/copies/list",
  "/docs/cli/copies/remove",
];

for (const route of commands) {
  const url = `${origin}${route}/`;
  const response = await fetch(url, { redirect: "error" });
  assert.equal(response.status, 200, `${route} returned ${response.status}`);
  assert.equal(response.url, url, `${route} did not resolve at its canonical URL`);
  const html = await response.text();
  assert.ok(
    html.includes(`<link rel="canonical" href="${canonicalOrigin}${route}/">`),
    `${route} has the wrong canonical link`,
  );
}

const indexResponse = await fetch(`${origin}/docs/cli/`, { redirect: "error" });
assert.equal(indexResponse.status, 200, `/docs/cli returned ${indexResponse.status}`);
const indexHtml = await indexResponse.text();
for (const route of commands) {
  assert.ok(indexHtml.includes(`href="${route}/"`), `/docs/cli is missing ${route}`);
}

console.log(`verified ${commands.length} Tama CLI command routes and the complete command tree`);
