import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
test('consent documentation keeps site links on their real published routes', () => {
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  assert.equal(revision.status, 0, revision.stderr);
  const build = spawnSync(process.execPath, ['src/cli.mjs', 'build'], { cwd: root, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const pages = JSON.parse(readFileSync(join(root, 'content/pages.json'), 'utf8'));
  const checked = [];
  for (const route of ['cli/justify', 'cli/request', 'desktop/justifications']) {
    const page = pages.find(page => page.route === route);
    assert.ok(page, route);
    const source = readFileSync(join(root, page.content), 'utf8');
    const output = readFileSync(join(root, 'dist/docs', route, 'index.html'), 'utf8');
    const links = [...source.matchAll(/href="(\/docs\/[^"#]*)(?:#[^"]*)?"/g)];
    assert.ok(links.length, `${route} has no documentation navigation`);
    for (const [attribute, href] of links) {
      assert.ok(output.includes(attribute), `${route} rewrote the site link ${href}`);
      assert.ok(existsSync(join(root, 'dist', href, 'index.html')), `${href} has no built page`);
      checked.push({ route, href });
    }
  }
  writeFileSync(join(root, 'dist/consent-link-evidence.json'), JSON.stringify({
    sourceRevision: revision.stdout.trim(), command: 'node --test tests/docs/links.test.mjs',
    buildExitStatus: build.status, checked,
  }, null, 2));
});
