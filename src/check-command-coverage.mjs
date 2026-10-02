#!/usr/bin/env node
// Every command `tama` advertises in its usage has a page on this site, or
// this refuses. The public commands are read from the usage text the binary
// prints (rust/crates/tama-cli/src/cli/output.rs: each line of the Commands
// block that starts at two spaces with a word), the pages from
// content/pages.json; a command's page is the route `cli/<command>` or any
// route below it, so a group documented leaf by leaf counts.
//
//   node src/check-command-coverage.mjs [--tama-root DIR]
//
// Exit 0 when every command has a page, 1 with the missing ones named, 2 for
// a wrong invocation or an unreadable usage text.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
let tamaRoot = resolve(root, '..', 'tama');
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === '--tama-root' && index + 1 < argv.length) {
    index += 1;
    tamaRoot = resolve(argv[index]);
    continue;
  }
  console.error(`check-command-coverage: unknown argument ${argv[index]}`);
  process.exit(2);
}

const usagePath = resolve(tamaRoot, 'rust/crates/tama-cli/src/cli/output.rs');
let usageSource;
try {
  usageSource = readFileSync(usagePath, 'utf8');
} catch (error) {
  console.error(`check-command-coverage: ${usagePath} cannot be read (${error.message}); name the Tama checkout with --tama-root`);
  process.exit(2);
}
const start = usageSource.indexOf('Commands:');
const end = usageSource.indexOf('";', start);
if (start < 0 || end < 0) {
  console.error(`check-command-coverage: ${usagePath} has no Commands block`);
  process.exit(2);
}
const advertised = new Set();
for (const line of usageSource.slice(start, end).split('\n')) {
  const entry = line.match(/^ {2}([a-z][a-z-]*)\b/);
  if (entry) advertised.add(entry[1]);
}

const pages = JSON.parse(readFileSync(resolve(root, 'content/pages.json'), 'utf8'));
const routes = pages.map((page) => page.route);
const documented = (command) =>
  routes.some((route) => route === `cli/${command}` || route.startsWith(`cli/${command}/`));

const missing = [...advertised].filter((command) => !documented(command)).sort();
if (missing.length) {
  console.error(
    `check-command-coverage: ${missing.length} advertised command(s) have no page: ${missing.join(', ')}; add a page under content/docs/cli and register it in content/pages.json`,
  );
  process.exit(1);
}
console.log(`check-command-coverage: every one of ${advertised.size} advertised commands has a page`);
