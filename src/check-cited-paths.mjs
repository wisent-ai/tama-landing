#!/usr/bin/env node
// Every repository file a page cites in a <code> element is a file the Tama
// checkout tracks, or this refuses. A cited file is a path whose first
// segment is a directory Tama tracks at its root (tests/, rust/,
// shared-hooks/, …), read from `git ls-files` there, and whose last segment
// has an extension. So a state path such as smoke-test-reviews/review.log, a
// crate-relative src/… path and a request operation such as tests/approve are
// not taken for checkout files. A hidden directory (.github/, .tama/) is one
// any repository may hold, and a page citing a file in it describes that file
// in the reader's repository, so it is not judged against Tama's own
// checkout; a file of another product is cited under that product's checkout
// (oko/tests/…). The changelog records what each release changed where it
// stood then, so its citations are judged against every path Tama's history
// has tracked, not only today's tree. A page that cites a test or module Tama
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

// The changelog's own file name, the Keep a Changelog convention
// (https://keepachangelog.com/en/1.1.0/), as pages.json records its source.
const CHANGELOG_SOURCE = 'CHANGELOG.md';
let history;
try {
  history = execFileSync('git', ['-C', tamaRoot, 'log', '--all', '--name-only', '--no-renames', '--format=', '-z'], {
    encoding: 'utf8',
    maxBuffer: Infinity,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  refuse(`git log in ${tamaRoot} failed: ${(error.stderr || error.message).trim()}; the changelog's citations are judged against Tama's history`);
}
const everTracked = new Set(history.split('\0').map((path) => path.trim()).filter((path) => path.length));
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
    if (first.startsWith('.')) continue;
    if (rootDirectories.has(first)) paths.add(value);
  }
  return paths;
};

const pages = JSON.parse(readFileSync(resolve(root, 'content/pages.json'), 'utf8'));
const contents = [...new Set(pages.map((page) => page.content))];
const changelogs = new Set(pages.filter((page) => page.source === CHANGELOG_SOURCE).map((page) => page.content));
const missing = [];
for (const content of contents) {
  let text;
  try {
    text = readFileSync(resolve(root, content), 'utf8');
  } catch (error) {
    missing.push(`${content}: the page pages.json registers cannot be read (${error.message})`);
    continue;
  }
  const known = changelogs.has(content) ? everTracked : trackedFiles;
  for (const path of cited(text)) {
    if (known.has(path)) continue;
    missing.push(
      changelogs.has(content)
        ? `${content}: ${path} was never tracked in ${tamaRoot}`
        : `${content}: ${path} is not tracked in ${tamaRoot}`,
    );
  }
}

if (missing.length) {
  refuse(`${missing.length} cited file(s) name nothing Tama tracks:\n  ${missing.join('\n  ')}`);
}
console.log(`check-cited-paths: every file the ${contents.length} pages cite is tracked in ${tamaRoot}`);
