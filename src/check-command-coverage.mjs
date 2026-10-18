#!/usr/bin/env node
// Every command `tama` advertises in its usage has a page on this site, or
// this refuses. The usage the binary prints is composed from the command
// table's summary lines (rust/crates/tama-cli/src/cli/help/table.rs and the
// longer ones in table_text.rs beside it); a summary line starts at two spaces
// with the command's word, at the start of its string literal or of a line
// inside it. The pages are read from content/pages.json; a command's page is
// the route `cli/<command>` or any route below it, so a group documented leaf
// by leaf counts.
//
//   node src/check-command-coverage.mjs [--tama-root DIR]
//
// Exits with success when every command has a page. A missing page, a wrong
// invocation or an unreadable usage text is named on stderr and exits with
// failure.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/stdlib.h.html
const EXIT_FAILURE = 1;

const refuse = (message) => {
  console.error(`check-command-coverage: ${message}`);
  process.exit(EXIT_FAILURE);
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let options;
try {
  ({ values: options } = parseArgs({ options: { 'tama-root': { type: 'string' } }, strict: true }));
} catch (error) {
  refuse(`${error.message}; the only option is --tama-root DIR`);
}
const tamaRoot = options['tama-root'] === undefined ? resolve(root, '..', 'tama') : resolve(options['tama-root']);

const tableDirectory = resolve(tamaRoot, 'rust/crates/tama-cli/src/cli/help');
const advertised = new Set();
for (const name of ['table.rs', 'table_text.rs']) {
  const path = resolve(tableDirectory, name);
  let source;
  try {
    source = readFileSync(path, 'utf8');
  } catch (error) {
    refuse(`${path} cannot be read (${error.message}); name the Tama checkout with --tama-root`);
  }
  for (const [, command] of source.matchAll(/(?:"|^)  ([a-z][a-z-]*)\b/gm)) {
    advertised.add(command);
  }
}
if (!advertised.size) {
  refuse(`${tableDirectory} holds no command summary line, so the usage cannot be read; the table moved or its lines changed shape`);
}

const pages = JSON.parse(readFileSync(resolve(root, 'content/pages.json'), 'utf8'));
const routes = pages.map((page) => page.route);
const documented = (command) =>
  routes.some((route) => route === `cli/${command}` || route.startsWith(`cli/${command}/`));

const missing = [...advertised].filter((command) => !documented(command)).sort();
if (missing.length) {
  refuse(
    `${missing.length} advertised command(s) have no page: ${missing.join(', ')}; add a page under content/docs/cli and register it in content/pages.json`,
  );
}
console.log(`check-command-coverage: every one of ${advertised.size} advertised commands has a page`);
