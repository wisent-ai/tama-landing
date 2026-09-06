import { strict as assert } from "node:assert";

const origin = (process.env.TAMA_DOCS_ORIGIN || "https://tama.wisent.com").replace(/\/$/, "");
const commands = [
  ["/docs/cli/help", "tama help"],
  ["/docs/cli/list", "tama list [--json]"],
  ["/docs/cli/show", "tama show &lt;hook-id&gt; [--json]"],
  ["/docs/cli/validate", "tama validate [--json]"],
  ["/docs/cli/install-plan", "tama install-plan [--json] [--git-hooks-path &lt;path&gt;] [--home &lt;path&gt;]"],
  ["/docs/cli/install", "tama install [--git-hooks-path &lt;path&gt;] [--home &lt;path&gt;]"],
  ["/docs/cli/verify", "tama verify"],
  ["/docs/cli/mcp-config", "tama mcp-config"],
  ["/docs/cli/find-violations", "tama find-violations (--repo &lt;path&gt; | --tree &lt;dir&gt; | --owner &lt;gh-user-or-org&gt; | --me) [...]"],
  ["/docs/cli/clean", "tama clean (--repo &lt;path&gt; | --tree &lt;dir&gt; | --owner &lt;gh-owner&gt; | --me) [...]"],
  ["/docs/cli/sessions", "tama sessions [--json] [--home &lt;path&gt;]"],
  ["/docs/cli/serve", "tama serve [--port N] [--root &lt;release-path&gt;]"],
  ["/docs/cli/adaptive", "tama adaptive &lt;command&gt; [...]"],
  ["/docs/cli/adaptive/status", "tama adaptive status"],
  ["/docs/cli/adaptive/drift", "tama adaptive drift"],
  ["/docs/cli/adaptive/queue", "tama adaptive queue"],
  ["/docs/cli/adaptive/repair", "tama adaptive repair &lt;hook-id&gt; [--patch-file &lt;path&gt;]"],
  ["/docs/cli/adaptive/apply", "DEVICE_HOOK_EDIT_APPROVED=1 tama adaptive apply &lt;proposal-dir&gt;"],
  ["/docs/cli/adaptive/install", "DEVICE_HOOK_EDIT_APPROVED=1 tama adaptive install"],
  ["/docs/cli/adaptive/uninstall", "tama adaptive uninstall"],
  ["/docs/cli/adaptive/claude-config", "tama adaptive claude-config"],
];

for (const [route, invocation] of commands) {
  const url = `${origin}${route}/`;
  const response = await fetch(url, { redirect: "error" });
  assert.equal(response.status, 200, `${route} returned ${response.status}`);
  assert.equal(response.url, url, `${route} did not resolve at its canonical URL`);
  const html = await response.text();
  assert.ok(
    html.includes(`<link rel="canonical" href="${url}">`),
    `${route} has the wrong canonical link`,
  );
  assert.ok(html.includes(invocation), `${route} is missing invocation: ${invocation}`);
}

const indexResponse = await fetch(`${origin}/docs/cli/`, { redirect: "error" });
assert.equal(indexResponse.status, 200, `/docs/cli returned ${indexResponse.status}`);
const indexHtml = await indexResponse.text();
for (const [route] of commands) {
  assert.ok(indexHtml.includes(`href="${route}/"`), `/docs/cli is missing ${route}`);
}

console.log(`verified ${commands.length} Tama CLI command routes and the complete command tree`);
