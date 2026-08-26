import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';

const root = new URL('../', import.meta.url).pathname;
const pages = JSON.parse(readFileSync(join(root, 'pages.json'), 'utf8'));
const dist = join(root, 'dist');
const origin = 'https://tama.wisent.com';

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'site'), dist, { recursive: true });

const htmlText = (value) => value
  .replace(/<[^>]*>/g, '')
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .trim();

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const slugify = (value) => htmlText(value)
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const routeForSource = (source) => {
  if (source === 'CHANGELOG.md') return '/docs/changelog/';
  if (source === 'SECURITY.md') return '/docs/security/';
  if (source === 'examples/README.md') return '/docs/examples/';
  if (source.startsWith('docs/') && source.endsWith('.md')) {
    return `/docs/${source.slice(5, -3)}/`;
  }
  return null;
};

const githubUrl = (target) => {
  const clean = target.replace(/^\.\//, '').replace(/\/$/, '');
  const filename = posix.basename(clean);
  const isFile = filename.includes('.');
  return `https://github.com/wisent-ai/tama-desktop/${isFile ? 'blob' : 'tree'}/main/${clean}`;
};

const rewriteLinks = (html, source) => html.replace(/href="([^"]+)"/g, (match, href) => {
  if (/^(?:https?:|mailto:|#)/.test(href)) return match;
  const hashIndex = href.indexOf('#');
  const rawTarget = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const target = posix.normalize(posix.join(posix.dirname(source), rawTarget));
  const docsRoute = routeForSource(target);
  if (docsRoute) return `href="${docsRoute}${hash}"`;
  if (target === 'README.md') return 'href="https://github.com/wisent-ai/tama-desktop"';
  if (target === 'LICENSE') return 'href="https://github.com/wisent-ai/tama-desktop/blob/main/LICENSE"';
  return `href="${githubUrl(target)}${hash}"`;
});

const addHeadingIds = (html) => {
  const seen = new Map();
  return html.replace(/<h([2-6])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const base = slugify(inner) || 'section';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    return `<h${level} id="${id}"><a class="heading-anchor" href="#${id}" aria-label="Link to ${escapeHtml(htmlText(inner))}">#</a>${inner}</h${level}>`;
  });
};

const records = pages.map((page) => {
  const original = readFileSync(join(root, page.content), 'utf8');
  const titleMatch = original.match(/<h1>([\s\S]*?)<\/h1>/);
  if (!titleMatch) throw new Error(`${page.content} has no h1`);
  const title = htmlText(titleMatch[1]);
  const withoutTitle = original.replace(titleMatch[0], '');
  const firstParagraph = withoutTitle.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '';
  const description = htmlText(firstParagraph).replace(/\s+/g, ' ');
  const linked = rewriteLinks(withoutTitle, page.source);
  const content = addHeadingIds(linked);
  const headings = [...content.matchAll(/<h2 id="([^"]+)">[\s\S]*?<\/h2>/g)].map((match) => ({
    id: match[1],
    title: htmlText(match[0]),
  }));
  return { ...page, title, description, content, headings };
});

const grouped = new Map();
for (const page of records) {
  const items = grouped.get(page.category) ?? [];
  items.push(page);
  grouped.set(page.category, items);
}

const sidebar = (activeRoute = '') => [...grouped.entries()].map(([category, items]) => `
  <section class="sidebar-group">
    <h2>${escapeHtml(category)}</h2>
    ${items.map((item) => `<a${item.route === activeRoute ? ' class="is-current" aria-current="page"' : ''} href="/docs/${item.route}/">${escapeHtml(item.title)}</a>`).join('\n    ')}
  </section>`).join('');

const header = (active = 'docs') => `<header class="site-header docs-site-header">
  <a class="brand" href="/" aria-label="Tama home"><span class="brand-mark">T</span><span>Tama</span></a>
  <nav class="top-nav" aria-label="Primary navigation">
    <a${active === 'docs' ? ' class="active"' : ''} href="/docs/">Documentation</a>
    <a href="https://github.com/wisent-ai/tama-desktop">GitHub</a>
    <a class="nav-cta" href="/docs/quick-start/">Quick start</a>
  </nav>
</header>`;

const footer = `<footer class="site-footer docs-footer">
  <a class="brand" href="/"><span class="brand-mark">T</span><span>Tama</span></a>
  <p>Policy for coding agents, by <a href="https://wisent.com">Wisent</a>.</p>
  <nav aria-label="Footer navigation"><a href="/docs/">Docs</a><a href="/docs/security/">Security</a><a href="https://github.com/wisent-ai/tama-desktop">Source</a></nav>
</footer>`;

const document = ({ title, description, canonical, body }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — Tama documentation</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)} — Tama">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="docs-body">
${body}
<script src="/site.js" defer></script>
</body>
</html>
`;

for (const [index, page] of records.entries()) {
  const previous = records[index - 1];
  const next = records[index + 1];
  const toc = page.headings.length > 1 ? `<aside class="page-toc" aria-label="On this page"><strong>On this page</strong>${page.headings.map((heading) => `<a href="#${heading.id}">${escapeHtml(heading.title)}</a>`).join('')}</aside>` : '';
  const pagination = `<nav class="doc-pagination" aria-label="Documentation pagination">
    ${previous ? `<a class="previous" href="/docs/${previous.route}/"><span>Previous</span><strong>← ${escapeHtml(previous.title)}</strong></a>` : '<span></span>'}
    ${next ? `<a class="next" href="/docs/${next.route}/"><span>Next</span><strong>${escapeHtml(next.title)} →</strong></a>` : '<span></span>'}
  </nav>`;
  const body = `${header()}
<button class="docs-menu-button" type="button" data-menu-button aria-expanded="false">Browse topics</button>
<div class="docs-layout">
  <aside class="docs-sidebar" data-docs-sidebar><a class="docs-home-link" href="/docs/">Documentation home</a>${sidebar(page.route)}</aside>
  <main class="doc-main">
    <div class="doc-breadcrumb"><a href="/docs/">Docs</a><span>/</span><span>${escapeHtml(page.category)}</span></div>
    <div class="doc-reading-layout">
      <article class="doc-content">
        <header class="doc-title"><p>${escapeHtml(page.category)}</p><h1>${escapeHtml(page.title)}</h1>${page.description ? `<div class="doc-intro">${escapeHtml(page.description)}</div>` : ''}</header>
        ${page.content}
        ${pagination}
      </article>
      ${toc}
    </div>
  </main>
</div>
${footer}`;
  const target = join(dist, 'docs', page.route, 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, document({
    title: page.title,
    description: page.description || `Tama documentation: ${page.title}`,
    canonical: `${origin}/docs/${page.route}/`,
    body,
  }));
}

const categories = [...grouped.entries()].map(([category, items]) => `<section class="docs-category" data-reveal>
  <div class="docs-category-heading"><h2>${escapeHtml(category)}</h2><span>${items.length} ${items.length === 1 ? 'topic' : 'topics'}</span></div>
  <div class="docs-card-grid">${items.map((item) => `<a class="docs-card" href="/docs/${item.route}/"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><span>Read topic →</span></a>`).join('')}</div>
</section>`).join('');

const docsHomeBody = `${header()}
<main class="docs-home">
  <section class="docs-home-hero"><p class="eyebrow">Tama documentation</p><h1>Policy you can inspect,<br>operate, and recover.</h1><p>Everything Tama owns: core concepts, every desktop screen, CLI and configuration contracts, release integrity, exact failures, and end-to-end walkthroughs.</p><div class="docs-home-actions"><a class="button button-primary" href="/docs/quick-start/">Start with the quick start →</a><a class="button button-secondary" href="/docs/runbook/">Open the runbook</a></div></section>
  <div class="docs-home-layout"><aside class="docs-index-sidebar">${sidebar()}</aside><div class="docs-categories">${categories}</div></div>
</main>
${footer}`;

mkdirSync(join(dist, 'docs'), { recursive: true });
writeFileSync(join(dist, 'docs', 'index.html'), document({
  title: 'Documentation',
  description: 'Complete documentation for Tama, Wisent’s local coding-agent policy product.',
  canonical: `${origin}/docs/`,
  body: docsHomeBody,
}));

const sitemapUrls = ['/', '/docs/', ...records.map((page) => `/docs/${page.route}/`)];
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map((url) => `  <url><loc>${origin}${url}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
