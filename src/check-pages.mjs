#!/usr/bin/env node
// What the build makes of each page reaches a reader, or this refuses: every
// page under content/docs is registered in content/pages.json, every link a
// registered page holds reaches a registered page, and no page holds Markdown
// table rows. A page nobody registered is built into no route, so whatever it
// documents is unreachable; a relative link that names no route is turned by
// the build into a GitHub address of a file nobody checked exists; and the
// build copies a page's HTML as it is, so a Markdown table (`| a | b |` rows
// and a `|---|` delimiter) is printed as a paragraph of pipes. Links are
// resolved as the build resolves them (src/cli.mjs rewriteLinks and
// routeForSource): `/docs/<route>/` must name a route; a relative link is read
// against the page's route, then as a route of its own, then as a file beside
// the page's source — docs/<route>.md, or a source the build names a route for
// — whose route must exist. Any other target is linked by the build to the
// repository the sources come from (github.com/wisent-ai/tama-desktop), so it
// must be a file or directory that repository's checkout holds.
//
//   node src/check-pages.mjs [--repository-root DIR]
//
// DIR is the tama-desktop checkout, beside this one when not given. Exits
// successfully when every page is registered, every link reaches a page or a
// file of that repository and no page holds a Markdown table; otherwise names
// each by page, or the invocation that failed, and exits with failure.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/stdlib.h.html
const EXIT_FAILURE = 1;

const refuse = (message) => {
  console.error(`check-pages: ${message}`);
  process.exit(EXIT_FAILURE);
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let options;
try {
  ({ values: options } = parseArgs({ options: { 'repository-root': { type: 'string' } }, strict: true }));
} catch (error) {
  refuse(`${error.message}; the only option is --repository-root DIR`);
}
const repositoryRoot = options['repository-root'] === undefined
  ? resolve(root, '..', 'tama-desktop')
  : resolve(options['repository-root']);
if (!existsSync(resolve(repositoryRoot, '.git'))) {
  refuse(`${repositoryRoot} is no Git checkout, so the files the build links there cannot be read; name the tama-desktop checkout with --repository-root`);
}

const pages = JSON.parse(readFileSync(resolve(root, 'content/pages.json'), 'utf8'));
const routes = new Set(pages.map((page) => page.route));
const registered = new Set(pages.map((page) => page.content));
const builtSources = new Set(['CHANGELOG.md', 'SECURITY.md', 'examples/README.md']);

const problems = [];
const docs = resolve(root, 'content/docs');
for (const entry of readdirSync(docs, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || posix.extname(entry.name) !== '.html') continue;
  const content = relative(root, resolve(entry.parentPath, entry.name)).split(sep).join('/');
  if (!registered.has(content)) problems.push(`${content}: no route in content/pages.json builds this page`);
}

const reaches = (page, target) => {
  const candidates = [posix.join(page.route, target), target].map((route) =>
    posix.normalize(route).replace(/^\/|\/$/g, ''),
  );
  if (candidates.some((route) => routes.has(route))) return true;
  const source = posix.normalize(posix.join(posix.dirname(page.source), target));
  if (builtSources.has(source)) return true;
  if (source.startsWith('docs/') && source.endsWith('.md')) return routes.has(source.slice('docs/'.length, -'.md'.length));
  return !source.startsWith('../') && existsSync(resolve(repositoryRoot, source));
};

// The address the build gives every route: /docs/<route>/.
const docsPrefix = '/docs/';

for (const page of pages) {
  let text;
  try {
    text = readFileSync(resolve(root, page.content), 'utf8');
  } catch (error) {
    problems.push(`${page.content}: the page pages.json registers cannot be read (${error.message})`);
    continue;
  }
  for (const [, href] of text.matchAll(/href="([^"#]*)(?:#[^"]*)?"/g)) {
    if (href.startsWith(docsPrefix)) {
      const route = href.slice(docsPrefix.length).replace(/\/$/, '');
      if (route !== '' && !routes.has(route)) problems.push(`${page.content}: href="${href}" names no route`);
      continue;
    }
    if (href === '' || /^(?:[a-z]+:|\/)/.test(href)) continue;
    if (!reaches(page, href)) problems.push(`${page.content}: href="${href}" from route ${page.route} reaches no page`);
  }
  for (const [, row] of text.matchAll(/^(?:<p>)?(\|[^\n]*\|)(?:<\/p>)?$/gm)) {
    const [, firstCell] = row.split('|');
    problems.push(`${page.content}: the Markdown table row "| ${firstCell.trim()} |…" is printed as text; write the table as <table> rows`);
  }
}

if (problems.length) {
  refuse(`${problems.length} problem(s) a reader would meet:\n  ${problems.join('\n  ')}`);
}
console.log(`check-pages: every page under content/docs is registered, every link of the ${pages.length} routes reaches a page and no page holds a Markdown table`);
