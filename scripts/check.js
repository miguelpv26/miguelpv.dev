/* check.js — static checks on the built site in dist/, run before every deploy.

   Usage:  npm run build && npm run check    (`npm run deploy` runs both and
                                              stops if any check fails)

   Each built page is checked against what scripts/site.js says it should be,
   so the checks catch drift that no browser would complain about: a canonical
   that points at the wrong locale, a social card that was never rendered, an
   article date that disagrees with its structured data, a broken local link,
   a CSP hash that doesn't match the inlined CSS. The source pages are checked
   too — they must stay free of generated content.

   Errors fail the run (exit 1); warnings are printed but don't block. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PAGES, LOCALES, NOT_FOUND_PAGES, SITE_ORIGIN, DIST, fileFor, imageFor } from './site.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Everything below reads the built site; the source checks use `repo`.
const root = path.join(repo, DIST);
if (!fs.existsSync(root)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build first`);
  process.exit(1);
}
const MARKERS = ['head', 'seo', 'jsonld', 'header', 'footer'];
const DESCRIPTION_MAX = 160; // Google truncates around here
const TITLE_WARN = 70;

const errors = [];
const warnings = [];
const error = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, key) => {
  const m = html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`));
  return m ? decode(m[1]) : undefined;
};

/** Every local file a page references (src, href, srcset, poster, data-fullres) must exist. */
function checkLocalRefs(rel, html) {
  const body = html.replace(/<style id="inline-css">[\s\S]*?<\/style>/, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const dir = path.dirname(rel);
  for (const [, value] of body.matchAll(/\s(?:src|href|srcset|poster|data-fullres)="([^"]+)"/g)) {
    for (const candidate of value.split(',').map(part => part.trim().split(/\s+/)[0])) {
      if (!candidate || /^(https?:|mailto:|tel:|data:|#)/.test(candidate)) continue;
      const clean = decodeURIComponent(candidate.split(/[?#]/)[0]);
      const target = clean.startsWith('/') ? clean.slice(1) : path.posix.join(dir.replace(/\\/g, '/'), clean);
      if (/^assets\/min\//.test(path.posix.normalize(target))) continue; // build output, checked by fingerprint-js
      const ok = [target, `${target}.html`, path.posix.join(target, 'index.html')].some(t => t === '' ? true : exists(t));
      if (!ok) error(rel, `broken local reference "${candidate}"`);
    }
  }
}

function checkDocument(rel, html) {
  const body = html.slice(html.indexOf('<body'));

  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dupes.length) error(rel, `duplicate id(s): ${dupes.join(', ')}`);

  const headings = [...body.matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
  const h1s = headings.filter(level => level === 1).length;
  if (h1s !== 1) error(rel, `expected exactly one <h1>, found ${h1s}`);
  headings.forEach((level, i) => {
    if (i && level > headings[i - 1] + 1) error(rel, `heading jumps from h${headings[i - 1]} to h${level}`);
  });

  // Every icon is decorative (its link or label carries the name) unless it
  // says otherwise with role="img" and a label.
  for (const [svg] of body.matchAll(/<svg\b[^>]*>/g)) {
    if (!/aria-hidden="true"|role="img"/.test(svg)) error(rel, `<svg> neither aria-hidden nor role="img": ${svg.slice(0, 80)}`);
  }
  for (const [img] of body.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt=/.test(img)) error(rel, `<img> without alt: ${img.slice(0, 80)}`);
  }
  for (const [video] of body.matchAll(/<video\b[^>]*>/g)) {
    if (!/preload="none"/.test(video)) error(rel, `<video> without preload="none": ${video.slice(0, 80)}`);
    if (!/\sposter=/.test(video)) error(rel, `<video> without a poster: ${video.slice(0, 80)}`);
    if (!/\saria-label=/.test(video)) error(rel, `<video> without an aria-label: ${video.slice(0, 80)}`);
  }
  for (const [link] of body.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    if (!/noopener/.test(link)) error(rel, `target="_blank" without rel="noopener": ${link.slice(0, 80)}`);
  }
  if (/\sitemprop=/.test(html)) error(rel, 'itemprop found — structured data is JSON-LD only');

  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(json); } catch (e) { error(rel, `invalid JSON-LD: ${e.message}`); }
  }

  checkLocalRefs(rel, html);
}

function checkPage(page, locale) {
  const url = page[locale];
  const rel = fileFor(url);
  if (!exists(rel)) { error(rel, 'listed in site.js but the file is missing'); return; }
  const html = read(rel);
  const canonical = SITE_ORIGIN + url;

  for (const name of MARKERS) {
    if (!html.includes(`<!-- build:${name} -->`) || !html.includes(`<!-- /build:${name} -->`)) {
      error(rel, `missing <!-- build:${name} --> markers`);
    }
  }

  // What the SEO block must say, straight from site.js.
  const seo = page.seo[locale];
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (decode(title || '') !== seo.title) error(rel, `<title> doesn't match site.js — run npm run build:html`);
  if (seo.title.length > TITLE_WARN) warn(rel, `title is ${seo.title.length} chars; Google shows about 60`);
  if (seo.description.length > DESCRIPTION_MAX) error(rel, `description is ${seo.description.length} chars (max ${DESCRIPTION_MAX})`);
  if (meta(html, 'description') !== seo.description) error(rel, `meta description doesn't match site.js — run npm run build:html`);

  const canon = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (canon !== canonical) error(rel, `canonical is ${canon}, expected ${canonical}`);
  if (meta(html, 'og:url') !== canonical) error(rel, `og:url doesn't match the canonical`);
  const alternates = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(m => [m[1], m[2]]));
  const expected = { en: SITE_ORIGIN + page.en, es: SITE_ORIGIN + page.es, 'x-default': SITE_ORIGIN + page.en };
  for (const [lang, href] of Object.entries(expected)) {
    if (alternates[lang] !== href) error(rel, `hreflang ${lang} is ${alternates[lang]}, expected ${href}`);
  }

  const image = imageFor(page, locale);
  if (!exists(image.src.slice(1))) error(rel, `social image ${image.src} doesn't exist${page.card ? ` — run npm run og-cards -- ${page.card.name}-${locale}` : ''}`);
  if (meta(html, 'og:image') !== SITE_ORIGIN + image.src) error(rel, `og:image doesn't match site.js — run npm run build:html`);

  // Articles: the dates in site.js, the JSON-LD and the visible <time>s must agree.
  if (page.published) {
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const graph = ld ? [].concat(JSON.parse(ld[1])['@graph'] || JSON.parse(ld[1])) : [];
    const post = graph.find(node => node['@type'] === 'BlogPosting');
    if (!post) error(rel, 'article without a BlogPosting in its JSON-LD');
    else {
      if (post.datePublished !== page.published) error(rel, `JSON-LD datePublished ${post.datePublished} ≠ site.js ${page.published}`);
      if (post.dateModified !== page.modified) error(rel, `JSON-LD dateModified ${post.dateModified} ≠ site.js ${page.modified}`);
      if (post.image !== SITE_ORIGIN + image.src) error(rel, `BlogPosting image ${post.image} ≠ the page's social card`);
    }
    const times = [...html.matchAll(/<time datetime="([^"]+)"/g)].map(m => m[1]);
    for (const date of new Set([page.published, page.modified])) {
      if (!times.includes(date)) error(rel, `no visible <time datetime="${date}">`);
    }
  }

  checkDocument(rel, html);
}

// Every source page in en/ and es/ must be in site.js, and must stay clean:
// generated content only ever lives in dist/.
const listed = new Set(PAGES.flatMap(page => LOCALES.map(locale => fileFor(page[locale]))));
const htmlFilesUnder = dir => fs.readdirSync(path.join(repo, dir), { withFileTypes: true }).flatMap(entry => {
  const rel = `${dir}/${entry.name}`;
  if (entry.isDirectory()) return htmlFilesUnder(rel);
  return entry.name.endsWith('.html') ? [rel] : [];
});
for (const rel of new Set([...LOCALES.flatMap(htmlFilesUnder), ...NOT_FOUND_PAGES])) {
  if (!NOT_FOUND_PAGES.includes(rel) && !listed.has(rel)) error(rel, 'not listed in scripts/site.js');
  const source = fs.readFileSync(path.join(repo, rel), 'utf8');
  if (!/<style id="inline-css"><\/style>/.test(source)) error(`${rel} (source)`, 'the inline-css block must be empty in the source');
  if (/assets\/min\/main\.[0-9a-f]{8}\.min\.js/.test(source)) error(`${rel} (source)`, 'the script tag must reference the unhashed main.min.js');
  for (const [, name, inner] of source.matchAll(/<!-- build:([\w-]+)(?: [^>]*?)? -->([\s\S]*?)<!-- \/build:\1 -->/g)) {
    if (inner.trim()) error(`${rel} (source)`, `build:${name} region must be empty in the source`);
  }
}

for (const page of PAGES) for (const locale of LOCALES) checkPage(page, locale);

// The standalone 404s need working links, staying out of the index, and (for
// the per-locale ones) their folder's language.
for (const rel of NOT_FOUND_PAGES) {
  const html = read(rel);
  checkLocalRefs(rel, html);
  if (!/<meta name="robots" content="noindex/.test(html)) error(rel, 'a 404 must be noindex');
  const locale = rel.split('/')[0];
  if (LOCALES.includes(locale) && !html.includes(`<html lang="${locale}"`)) error(rel, `expected <html lang="${locale}">`);
}

// Every built page carries the same inlined CSS and the hashed bundle, and the
// CSP in dist/_headers allows exactly that CSS.
const builtPages = [...PAGES.flatMap(page => LOCALES.map(locale => fileFor(page[locale]))), ...NOT_FOUND_PAGES];
const cssOf = rel => (read(rel).match(/<style id="inline-css">([\s\S]*?)<\/style>/) || [])[1] || '';
const css = cssOf(builtPages[0]);
if (!css) error(builtPages[0], 'inline CSS is empty — did build-css.js run?');
for (const rel of builtPages) {
  if (cssOf(rel) !== css) error(rel, 'inlined CSS differs from the other pages');
  if (!/assets\/min\/main\.[0-9a-f]{8}\.min\.js"/.test(read(rel))) error(rel, 'script tag isn\'t pointing at a hashed bundle — did fingerprint-js.js run?');
}
const cssHash = `'sha256-${crypto.createHash('sha256').update(css, 'utf8').digest('base64')}'`;
if (!read('_headers').includes(`style-src 'self' ${cssHash}`)) error('_headers', 'CSP style-src hash doesn\'t match the inlined CSS');

// Redirect targets must be real pages.
const pageUrls = new Set(PAGES.flatMap(page => LOCALES.map(locale => page[locale])));
for (const line of read('_redirects').split('\n')) {
  const parts = line.trim().split(/\s+/);
  if (!parts[0] || parts[0].startsWith('#')) continue;
  if (!pageUrls.has(parts[1])) error('_redirects', `${parts[0]} points at ${parts[1]}, which isn't a page in site.js`);
  if (pageUrls.has(parts[0])) error('_redirects', `${parts[0]} is still a live page — a redirect would hide it`);
}

// security.txt must carry a future Expires (RFC 9116); renew it yearly.
const securityTxt = '.well-known/security.txt';
if (!exists(securityTxt)) error(securityTxt, 'missing');
else {
  const expires = (read(securityTxt).match(/^Expires:\s*(\S+)/m) || [])[1];
  const daysLeft = expires ? (Date.parse(expires) - Date.now()) / 864e5 : NaN;
  if (!(daysLeft > 0)) error(securityTxt, `Expires (${expires}) is missing or in the past — set it up to a year ahead`);
  else if (daysLeft < 30) warn(securityTxt, `Expires in ${Math.floor(daysLeft)} days — renew it`);
}

for (const w of warnings) console.warn(`warn   ${w}`);
for (const e of errors) console.error(`ERROR  ${e}`);
const pages = PAGES.length * LOCALES.length;
if (errors.length) {
  console.error(`\ncheck: ${errors.length} error(s) across ${pages} pages + ${NOT_FOUND_PAGES.length} 404s — fix before deploying.`);
  process.exit(1);
}
console.log(`check: ${pages} pages + ${NOT_FOUND_PAGES.length} 404s OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
