/* check.js — static checks on the built site in dist/, run before every deploy.

   Usage:  npm run build && npm run check    (`npm run deploy` runs both and
                                              stops if any check fails)

   Each built page is checked against what data/site.js says it should be,
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
import { PAGES, LOCALES, NOT_FOUND_PAGES, SITE_ORIGIN, DIST, fileFor, imageFor, dateTimeFor } from './site.js';
import { imageSize } from './images.js';
import { articles, feedPathFor } from './feed.js';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Everything below reads the built site; the source checks use `repo`.
const root = path.join(repo, DIST);
if (!fs.existsSync(root)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build first`);
  process.exit(1);
}
const MARKERS = ['head', 'seo', 'jsonld', 'header', 'footer'];
const NEW_TAB = { en: 'opens in a new tab', es: 'se abre en una pestaña nueva' };
const DESCRIPTION_MAX = 160; // Google truncates around here
const TITLE_WARN = 70;

const errors = [];
const warnings = [];
const error = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
// Cloudflare Pages matches URLs case-sensitively, but Windows and macOS file
// systems don't, so a plain existsSync passed links to CV-MiguelPV-English.pdf
// while production 404'd. Compare every segment's real spelling instead.
const listings = new Map();
const listing = dir => {
  if (!listings.has(dir)) listings.set(dir, fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  return listings.get(dir);
};
const exists = rel => {
  let dir = root;
  return path.relative(root, path.join(root, rel)).split(path.sep).filter(Boolean).every(part => {
    const ok = part === '..' || listing(dir).includes(part);
    dir = path.join(dir, part);
    return ok;
  });
};
const decode = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, key) => {
  const m = html.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`));
  return m ? decode(m[1]) : undefined;
};

// JSON-LD dates: a plain year or date ("2025", "2026-07-13") is a schema.org
// Date; anything with a time is a DateTime and must carry its zone, or Google
// reports "datetime property is missing a timezone". Articles' dates are always
// DateTimes — Google reads them as such even when given a bare date.
const ZONED_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const PLAIN_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const DATE_KEYS = ['datePublished', 'dateModified', 'dateCreated', 'uploadDate', 'startDate', 'endDate'];
const ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle'];
// Every {"@id": …} reference must point at a node defined on the same page:
// Google reads each page's graph on its own and won't follow an @id elsewhere.
function checkLdRefs(rel, ld) {
  const defined = new Set(), referenced = new Set();
  (function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '@id') referenced.add(value['@id']);
    else if (value['@id']) defined.add(value['@id']);
    Object.values(value).forEach(walk);
  })(ld);
  for (const id of referenced) if (!defined.has(id)) error(rel, `JSON-LD references ${id}, which no node on the page defines`);
}

function checkLdDates(rel, value) {
  if (Array.isArray(value)) return value.forEach(item => checkLdDates(rel, item));
  if (!value || typeof value !== 'object') return;
  const isArticle = [].concat(value['@type']).some(type => ARTICLE_TYPES.includes(type));
  for (const [key, inner] of Object.entries(value)) {
    if (DATE_KEYS.includes(key)) {
      const ok = ZONED_DATETIME.test(inner) || (!isArticle && PLAIN_DATE.test(inner));
      if (!ok) error(rel, `JSON-LD ${value['@type']} ${key} "${inner}" ${isArticle ? 'needs a date-time with a timezone' : 'is neither a date nor a zoned date-time'}`);
    } else checkLdDates(rel, inner);
  }
}

/** Every local file a page references (src, href, srcset, imagesrcset, poster, data-poster, data-fullres) must exist. */
function checkLocalRefs(rel, html) {
  const body = html.replace(/<style id="inline-css">[\s\S]*?<\/style>/, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');
  const dir = path.dirname(rel);
  for (const [, value] of body.matchAll(/\s(?:src|href|srcset|imagesrcset|poster|data-poster|data-fullres)="([^"]+)"/g)) {
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

/** The attributes holding a tag's candidates and their sizes: a preload <link> uses image* names. */
const srcsetAttrs = tag => (tag.startsWith('<link') ? ['imagesrcset', 'imagesizes'] : ['srcset', 'sizes']);

/** A `w`-descriptor srcset — the kind that needs a `sizes` — as [url, width] pairs; null otherwise. */
const widthCandidates = tag => {
  const srcset = (tag.match(new RegExp(`\\s${srcsetAttrs(tag)[0]}="([^"]+)"`)) || [])[1];
  if (!srcset) return null;
  const candidates = srcset.trim().split(/\s*,\s*/).map(candidate => candidate.split(/\s+/));
  return candidates.some(([, descriptor]) => /^\d+w$/.test(descriptor || '')) ? candidates : null;
};

/* Responsive images: the browser picks a srcset candidate by its `w` descriptor
   before it has seen the file, so each one must be the file's real width; and
   the `sizes` that goes with them is generated (scripts/images.js), so none may
   be left as a data-sizes placeholder. An image preload must ask for exactly
   what its <picture> will — the same candidates and sizes — or the browser
   preloads one file and then fetches another. */
function checkResponsiveImages(rel, html) {
  const sources = [];
  for (const [tag] of html.matchAll(/<(?:source|img|link)\b[^>]*>/g)) {
    const candidates = widthCandidates(tag);
    if (!candidates) continue;
    const [srcsetAttr, sizesAttr] = srcsetAttrs(tag);
    const sizes = (tag.match(new RegExp(`\\s${sizesAttr}="([^"]+)"`)) || [])[1];
    if (/\sdata-sizes=/.test(tag)) error(rel, `data-sizes left in a built page — did build-html.js run? ${tag.slice(0, 80)}`);
    if (!sizes) error(rel, `${srcsetAttr} with w descriptors but no ${sizesAttr}: ${tag.slice(0, 80)}`);
    for (const [url, descriptor] of candidates) {
      const file = path.join(root, path.dirname(rel), decodeURIComponent(url));
      if (!fs.existsSync(file)) continue; // reported by checkLocalRefs
      const { width } = imageSize(file);
      if (descriptor !== `${width}w`) error(rel, `${url} is ${width}px wide but its ${srcsetAttr} descriptor says ${descriptor}`);
    }
    const key = `${candidates.map(c => c.join(' ')).join(', ')} | ${sizes}`;
    if (tag.startsWith('<link')) sources.push({ preload: key, tag });
    else sources.push({ key });
  }
  for (const { preload, tag } of sources.filter(s => s.preload)) {
    if (!sources.some(s => s.key === preload)) error(rel, `image preload matches no <source> on the page (same candidates and sizes) — it would download a second file: ${tag.slice(0, 80)}`);
  }
  // The AVIF and WebP sources of one picture describe the same box.
  for (const [picture] of html.matchAll(/<picture\b[\s\S]*?<\/picture>/g)) {
    const values = new Set([...picture.matchAll(/<source\b[^>]*\ssizes="([^"]+)"/g)].map(m => m[1]));
    if (values.size > 1) error(rel, `the sources of one <picture> have different sizes — give them the same data-sizes: ${picture.slice(0, 80)}`);
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
  // A slider's hidden slides (every [data-slide] but the .active one) must not
  // download with the page: images lazy (display:none until the slider starts
  // keeps them from loading), video posters as data-poster (the slider sets them
  // when the slider starts — a poster attribute always downloads at once).
  const hiddenSlide = tag => /\sdata-slide\b/.test(tag) && !/\sclass="[^"]*\bactive\b/.test(tag);
  for (const [img] of body.matchAll(/<img\b[^>]*>/g)) {
    if (!/\salt=/.test(img)) error(rel, `<img> without alt: ${img.slice(0, 80)}`);
    if (hiddenSlide(img) && !/\sloading="lazy"/.test(img)) error(rel, `hidden slide without loading="lazy": ${img.slice(0, 80)}`);
  }
  for (const [video] of body.matchAll(/<video\b[^>]*>/g)) {
    if (!/preload="none"/.test(video)) error(rel, `<video> without preload="none": ${video.slice(0, 80)}`);
    if (hiddenSlide(video)) {
      if (!/\sdata-poster=/.test(video) || /\sposter=/.test(video)) error(rel, `hidden video slide must defer its poster as data-poster: ${video.slice(0, 80)}`);
    } else if (!/\sposter=/.test(video)) error(rel, `<video> without a poster: ${video.slice(0, 80)}`);
    if (!/\saria-label=/.test(video)) error(rel, `<video> without an aria-label: ${video.slice(0, 80)}`);
  }
  // A new-tab link says so in its accessible name: in its aria-label when it
  // has one (that replaces the content), else in a .sr-only span inside it.
  // mailto: links are exempt — they open a mail client, not a tab.
  const lang = (html.match(/<html\b[^>]*\slang="([^"]+)"/) || [])[1];
  const newTab = NEW_TAB[lang];
  for (const [anchor, link, content] of body.matchAll(/(<a\b[^>]*target="_blank"[^>]*>)([\s\S]*?)<\/a>/g)) {
    if (!/noopener/.test(link)) error(rel, `target="_blank" without rel="noopener": ${link.slice(0, 80)}`);
    if (!newTab || /\shref="mailto:/.test(link)) continue;
    const label = (link.match(/\saria-label="([^"]*)"/) || [])[1];
    const said = label !== undefined ? label.includes(newTab)
      : [...content.matchAll(/<span class="sr-only">([^<]*)<\/span>/g)].some(m => m[1].includes(newTab));
    if (!said) error(rel, `target="_blank" link doesn't announce "${newTab}" (aria-label, or a .sr-only span inside): ${anchor.slice(0, 120)}`);
  }
  if (/\sitemprop=/.test(html)) error(rel, 'itemprop found — structured data is JSON-LD only');

  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const ld = JSON.parse(json);
      checkLdDates(rel, ld);
      checkLdRefs(rel, ld);
    } catch (e) { error(rel, `invalid JSON-LD: ${e.message}`); }
  }

  checkLocalRefs(rel, html);
  checkResponsiveImages(rel, html);
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
  const feedLink = (html.match(/<link rel="alternate" type="application\/atom\+xml" title="[^"]+" href="([^"]+)"/) || [])[1];
  if (feedLink !== feedPathFor(locale)) error(rel, `feed link is ${feedLink}, expected ${feedPathFor(locale)} — run npm run build:html`);

  const image = imageFor(page, locale);
  if (!exists(image.src.slice(1))) error(rel, `social image ${image.src} doesn't exist${page.card ? ` — run npm run og-cards -- ${page.card.name}-${locale}` : ''}`);
  if (meta(html, 'og:image') !== SITE_ORIGIN + image.src) error(rel, `og:image doesn't match site.js — run npm run build:html`);

  // Articles: the dates in site.js, the JSON-LD, the Open Graph article:*_time
  // and the visible <time>s must agree (the <time>s on the day).
  if (page.published) {
    let published, modified;
    try {
      [published, modified] = [dateTimeFor(page.published), dateTimeFor(page.modified)];
    } catch (e) { error(rel, e.message); }
    if (published && Date.parse(modified) < Date.parse(published)) error(rel, `site.js modified ${page.modified} is before published ${page.published}`);
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const graph = ld ? [].concat(JSON.parse(ld[1])['@graph'] || JSON.parse(ld[1])) : [];
    const post = graph.find(node => node['@type'] === 'BlogPosting');
    if (!post) error(rel, 'article without a BlogPosting in its JSON-LD');
    else {
      if (post.datePublished !== published) error(rel, `JSON-LD datePublished ${post.datePublished} ≠ site.js ${published}`);
      if (post.dateModified !== modified) error(rel, `JSON-LD dateModified ${post.dateModified} ≠ site.js ${modified}`);
      if (post.image !== SITE_ORIGIN + image.src) error(rel, `BlogPosting image ${post.image} ≠ the page's social card`);
    }
    if (meta(html, 'article:published_time') !== published) error(rel, `article:published_time ≠ site.js ${published} — run npm run build:html`);
    if (meta(html, 'article:modified_time') !== modified) error(rel, `article:modified_time ≠ site.js ${modified} — run npm run build:html`);
    const times = [...html.matchAll(/<time datetime="([^"]+)"/g)].map(m => m[1]);
    for (const date of new Set([page.published, page.modified].map(value => value.slice(0, 10)))) {
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
  if (!NOT_FOUND_PAGES.includes(rel) && !listed.has(rel)) error(rel, 'not listed in data/site.js');
  const source = fs.readFileSync(path.join(repo, rel), 'utf8');
  if (!/<style id="inline-css"><\/style>/.test(source)) error(`${rel} (source)`, 'the inline-css block must be empty in the source');
  if (/assets\/min\/main\.[0-9a-f]{8}\.min\.js/.test(source)) error(`${rel} (source)`, 'the script tag must reference the unhashed main.min.js');
  for (const [, name, inner] of source.matchAll(/<!-- build:([\w-]+)(?: [^>]*?)? -->([\s\S]*?)<!-- \/build:\1 -->/g)) {
    if (inner.trim()) error(`${rel} (source)`, `build:${name} region must be empty in the source`);
  }
  for (const [tag] of source.matchAll(/<(?:source|img|link)\b[^>]*>/g)) {
    if (!widthCandidates(tag)) continue;
    const [srcsetAttr, sizesAttr] = srcsetAttrs(tag);
    if (new RegExp(`\\s${sizesAttr}="`).test(tag)) error(`${rel} (source)`, `${sizesAttr} is generated — name the layout with data-sizes (data/images.js) instead: ${tag.slice(0, 80)}`);
    else if (!/\sdata-sizes="/.test(tag)) error(`${rel} (source)`, `${srcsetAttr} with w descriptors needs data-sizes="LAYOUT" (data/images.js): ${tag.slice(0, 80)}`);
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

// Each locale's Atom feed lists every article, newest first, with site.js's
// dates, and robots.txt points crawlers at it.
const robots = read('robots.txt');
for (const locale of LOCALES) {
  const rel = feedPathFor(locale).slice(1);
  if (!exists(rel)) { error(rel, 'missing — run npm run build:html'); continue; }
  const feed = read(rel);
  const entries = [...feed.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, entry]) => ({
    href: (entry.match(/<link rel="alternate" type="text\/html" href="([^"]+)"/) || [])[1],
    published: (entry.match(/<published>([^<]+)<\/published>/) || [])[1],
    updated: (entry.match(/<updated>([^<]+)<\/updated>/) || [])[1],
  }));
  const expected = articles();
  if (entries.map(e => e.href).join() !== expected.map(page => SITE_ORIGIN + page[locale]).join()) {
    error(rel, 'entries aren\'t every article in site.js, newest first');
  }
  entries.forEach((entry, i) => {
    const page = expected[i];
    if (!page) return;
    if (entry.published !== dateTimeFor(page.published) || entry.updated !== dateTimeFor(page.modified)) {
      error(rel, `${entry.href}: dates don't match site.js`);
    }
  });
  if (!robots.includes(`Sitemap: ${SITE_ORIGIN}${feedPathFor(locale)}`)) error('robots.txt', `no Sitemap line for ${feedPathFor(locale)}`);
  // The hub's visible "Atom feed" link is hand-written, so it can point at the wrong locale.
  const hub = fileFor(`/${locale}/blog`);
  const visible = (read(hub).match(/<a href="([^"]+)" type="application\/atom\+xml">/) || [])[1];
  if (visible !== feedPathFor(locale)) error(hub, `visible feed link is ${visible}, expected ${feedPathFor(locale)}`);
}

// Redirect targets must be real pages or shipped files.
const pageUrls = new Set(PAGES.flatMap(page => LOCALES.map(locale => page[locale])));
const isFile = url => /\.\w+$/.test(url) && exists(url.slice(1));
for (const line of read('_redirects').split('\n')) {
  const parts = line.trim().split(/\s+/);
  if (!parts[0] || parts[0].startsWith('#')) continue;
  if (!pageUrls.has(parts[1]) && !isFile(parts[1])) error('_redirects', `${parts[0]} points at ${parts[1]}, which isn't a page in site.js or a shipped file`);
  if (pageUrls.has(parts[0]) || isFile(parts[0])) error('_redirects', `${parts[0]} is still live — a redirect would hide it`);
}

// The web app manifests: every icon exists, a PNG's real size is its declared
// `sizes`, the 192 and 512 PNGs browsers want for installing are there (SVG
// support in manifests is uneven, so the SVGs are extras, not substitutes),
// and both locales list the same icons — only names and URLs differ.
const MANIFESTS = ['site.webmanifest', 'site.es.webmanifest'];
const iconsOf = manifest => [...(manifest.icons || []), ...(manifest.shortcuts || []).flatMap(s => s.icons || [])];
const manifests = {};
for (const rel of MANIFESTS) {
  if (!exists(rel)) { error(rel, 'missing'); continue; }
  try { manifests[rel] = JSON.parse(read(rel)); } catch (e) { error(rel, `invalid JSON: ${e.message}`); continue; }
  for (const icon of iconsOf(manifests[rel])) {
    const file = icon.src.replace(/^\//, '');
    if (!exists(file)) { error(rel, `icon ${icon.src} doesn't exist`); continue; }
    if (icon.type !== 'image/png') continue;
    const { width, height } = imageSize(path.join(root, file));
    if (icon.sizes !== `${width}x${height}`) error(rel, `${icon.src} is ${width}x${height} but declares sizes "${icon.sizes}"`);
  }
  for (const purpose of ['any', 'maskable']) for (const size of ['192x192', '512x512']) {
    if (!(manifests[rel].icons || []).some(i => i.type === 'image/png' && i.sizes === size && (i.purpose || 'any').split(' ').includes(purpose))) {
      error(rel, `no ${size} PNG icon with purpose "${purpose}"`);
    }
  }
}
if (manifests[MANIFESTS[0]] && manifests[MANIFESTS[1]]
  && JSON.stringify(iconsOf(manifests[MANIFESTS[0]])) !== JSON.stringify(iconsOf(manifests[MANIFESTS[1]]))) {
  error(MANIFESTS[1], `icons differ from ${MANIFESTS[0]} — keep the two manifests in sync`);
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
