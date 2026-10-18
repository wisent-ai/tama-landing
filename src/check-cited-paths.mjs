#!/usr/bin/env node
// Every repository file a page cites in a <code> element is a file the Tama
// checkout tracks, or this refuses. A cited file is a path whose first
// segment is a directory Tama tracks at its root (tests/, rust/,
// shared-hooks/, …), read from `git ls-files` there, and whose last segment
// has an extension. So a state path such as smoke-test-reviews/review.log, a
// crate-relative src/… path, a directory any repository may hold
// (.github/workflows/) and a request operation such as tests/approve are not
// taken for checkout files; a file of another product is cited under that
// product's checkout (oko/tests/…). A page that cites a test or module Tama
// removed then names it instead of describing behaviour that is gone.
//
//   node src/check-cited-paths.mjs [--tama-root DIR]
//
// Exits successfully when every cited file is tracked; otherwise names each
// missing file by page, or the invocation or Git listing that failed, and
// exits with failure.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/stdlib.h.html
const EXIT_FAILURE = 1;

const refuse = (message) => {
  console.error(`check-cited-paths: ${message}`);
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

let listing;
try {
  listing = execFileSync('git', ['-C', tamaRoot, 'ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: Infinity,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  refuse(`git ls-files in ${tamaRoot} failed: ${(error.stderr || error.message).trim()}; name the Tama checkout with --tama-root`);
}
const trackedFiles = new Set(listing.split('\0').filter((path) => path.length));
const trackedDirectories = new Set();
for (const path of trackedFiles) {
  for (let directory = posix.dirname(path); directory !== '.'; directory = posix.dirname(directory)) {
    trackedDirectories.add(directory);
  }
}
const rootDirectories = new Set([...trackedDirectories].filter((directory) => posix.dirname(directory) === '.'));

const cited = (text) => {
  const paths = new Set();
  for (const [, code] of text.matchAll(/<code>([^<]*)<\/code>/g)) {
    const value = code.trim();
    if (/[\s&*?{}$:]/.test(value) || !value.includes('/') || !posix.extname(value)) continue;
    const [first] = value.split('/');
    if (rootDirectories.has(first)) paths.add(value);
  }
  return paths;
};

const pages = JSON.parse(readFileSync(resolve(root, 'content/pages.json'), 'utf8'));
const contents = [...new Set(pages.map((page) => page.content))];
const missing = [];
for (const content of contents) {
  let text;
  try {
    text = readFileSync(resolve(root, content), 'utf8');
  } catch (error) {
    missing.push(`${content}: the page pages.json registers cannot be read (${error.message})`);
    continue;
  }
  for (const path of cited(text)) {
    if (!trackedFiles.has(path)) missing.push(`${content}: ${path} is not tracked in ${tamaRoot}`);
  }
}

if (missing.length) {
  refuse(`${missing.length} cited file(s) name nothing Tama tracks:\n  ${missing.join('\n  ')}`);
}
console.log(`check-cited-paths: every file the ${contents.length} pages cite is tracked in ${tamaRoot}`);
