/* build-html.js — first build step: assemble dist/ from the source pages.

   The pages in en/ and es/ (and 404.html) are source: their build regions are
   empty, they carry an empty <style id="inline-css"> and an unhashed script
   tag. This step starts dist/ from scratch, writes every page into it with the
   shared regions filled in, and copies the static files that ship. The next
   steps (fingerprint-js.js, build-css.js) finish the pages inside dist/; the
   sources are never written to, so git only ever shows real edits.

   Pipeline:  templates/{head,seo,header,footer}.html  +  data/site.js (pages)
              →  fill {{placeholders}} per page (locale, depth, SEO data,
                 "you are here")
              →  write the page to dist/ with its build regions filled

   Each page marks the regions it hands over to this script:

       <!-- build:head -->    …    <!-- /build:head -->     charset, preloads, icons
       <!-- build:seo -->     …    <!-- /build:seo -->      title, description,
                                                             canonical, hreflang, OG, Twitter
       <!-- build:header -->  …    <!-- /build:header -->
       <!-- build:footer -->  …    <!-- /build:footer -->

   The SEO block comes entirely from the page's entry in site.js: edit a title
   or description there, never in the HTML. Everything outside the markers
   (JSON-LD, the page's content) stays hand-written. In the source the markers
   stay empty; only dist/ ever holds what goes between them. Likewise each
   responsive image's `sizes`: the source names its layout (data-sizes="…")
   and scripts/images.js works out the value. The 404s
   (NOT_FOUND_PAGES) are standalone (no header, no footer) and are copied over
   as they are. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PAGES, LOCALES, NOT_FOUND_PAGES, SITE_ORIGIN, SITE_NAME, DIST, fileFor, imageFor, dateTimeFor } from './site.js';
import { PROJECTS, TAGS, CATEGORIES, STATUSES } from '../data/projects.js';
import { graphFor } from './jsonld.js';
import { imageSize, sizesFor } from './images.js';
import { feedFor, feedPathFor, feedTitleFor } from './feed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Per-locale copy used by the templates as {{t.key}}.
const STRINGS = {
  en: {
    skip: 'Skip to main content',
    logoLabel: 'Go to homepage',
    logoAlt: 'Miguel PV Logo',
    toggle: 'Toggle navigation menu',
    mainNav: 'Main',
    projects: 'Projects',
    contact: 'Contact',
    language: 'Language',
    noCookies: 'No Cookies',
    noTracking: 'No Tracking',
    noAnalytics: 'No Analytics',
    homeCrumb: 'Home',
    breadcrumb: 'Breadcrumb',
  },
  es: {
    skip: 'Saltar al contenido principal',
    logoLabel: 'Ir al inicio',
    logoAlt: 'Logo de Miguel PV',
    toggle: 'Abrir o cerrar el menú de navegación',
    mainNav: 'Principal',
    projects: 'Proyectos',
    contact: 'Contacto',
    language: 'Idioma',
    noCookies: 'Sin cookies',
    noTracking: 'Sin rastreo',
    noAnalytics: 'Sin analíticas',
    homeCrumb: 'Inicio',
    breadcrumb: 'Ruta de navegación',
  },
};

// Locale-specific URLs and ids the header points at.
const LINKS = {
  en: { home: '/en/', hero: '#hero', projects: '/en/projects', blog: '/en/blog', contact: '/en/#contact', manifest: '/site.webmanifest' },
  es: { home: '/es/', hero: '#inicio', projects: '/es/proyectos', blog: '/es/blog', contact: '/es/#contacto', manifest: '/site.es.webmanifest' },
};

const BLOCKS = ['head', 'seo', 'header', 'footer'];

const OG_LOCALE = { en: 'en_US', es: 'es_ES' };

/** Escape a text value for use in element content or a double-quoted attribute. */
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const templates = Object.fromEntries(
  BLOCKS.map(name => [name, fs.readFileSync(path.join(root, 'templates', `${name}.html`), 'utf8').replace(/\r\n/g, '\n')])
);

/** " aria-current=…" for a nav link: "page" on the section's own page, "true" anywhere under it. */
function currentFor(url, sectionUrl) {
  if (url === sectionUrl) return ' aria-current="page"';
  if (url.startsWith(sectionUrl + '/')) return ' aria-current="true"';
  return '';
}

function varsFor(page, locale) {
  const url = page[locale];
  const links = LINKS[locale];
  const depth = fileFor(url).split('/').length - 1;
  const isHome = url === links.home;
  const langLink = lang => ({
    [`${lang}Href`]: page[lang],
    [`${lang}Active`]: lang === locale ? ' lang-toggle__link--active' : '',
    [`${lang}Current`]: lang === locale ? ' aria-current="page"' : '',
  });

  // SEO block. Home and the two section hubs are "website"; everything under a
  // section (case studies, articles) is an "article".
  const seo = page.seo[locale];
  const image = imageFor(page, locale);
  const isArticleType = !isHome && url !== links.projects && url !== links.blog;
  // article:author is a profile URL, not a name: the homepage is the ProfilePage.
  const articleMeta = page.published
    ? [
        `<meta property="article:author" content="${SITE_ORIGIN + links.home}" />`,
        `<meta property="article:published_time" content="${esc(dateTimeFor(page.published))}" />`,
        `<meta property="article:modified_time" content="${esc(dateTimeFor(page.modified))}" />`,
      ].map(line => `    ${line}\n`).join('')
    : '';

  return {
    title: esc(seo.title),
    description: esc(seo.description),
    shareTitle: esc(seo.shareTitle || seo.title),
    url: SITE_ORIGIN + url,
    enUrl: SITE_ORIGIN + page.en,
    esUrl: SITE_ORIGIN + page.es,
    ogType: isArticleType ? 'article' : 'website',
    ogLocale: OG_LOCALE[locale],
    ogLocaleAlt: OG_LOCALE[locale === 'en' ? 'es' : 'en'],
    siteName: esc(SITE_NAME[locale]),
    image: SITE_ORIGIN + image.src,
    imageAlt: esc(image.alt),
    articleMeta,
    feedUrl: feedPathFor(locale),
    feedTitle: esc(feedTitleFor(locale, links.blog)),
    prefix: '../'.repeat(depth),
    manifest: links.manifest,
    year: String(new Date().getFullYear()),
    // On the homepage the logo scrolls back to the hero and is the current page.
    logoHref: isHome ? links.hero : links.home,
    logoCurrent: isHome ? ' aria-current="page"' : '',
    projectsHref: links.projects,
    projectsCurrent: currentFor(url, links.projects),
    blogHref: links.blog,
    blogCurrent: currentFor(url, links.blog),
    contactHref: links.contact,
    ...langLink('en'),
    ...langLink('es'),
  };
}

function render(template, vars, locale, where) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
    const value = key.startsWith('t.') ? STRINGS[locale][key.slice(2)] : vars[key];
    if (value === undefined) throw new Error(`${where}: unknown placeholder ${m}`);
    return value;
  });
}

/* Project regions — <!-- build:project-KIND SLUG [terminal] --> — rendered from
   data/projects.js (see the comment there for what each kind is). Returns
   the region's lines without indentation; the caller indents them to match
   the marker. */
const PRESENT = { en: 'present', es: 'actualidad' };
const TERMINAL_LABELS = { en: { role: 'role', years: 'timeline', status: 'status' }, es: { role: 'rol', years: 'año', status: 'estado' } };
const textFor = (value, locale) => (typeof value === 'string' ? value : value[locale]);

function renderProject(kind, slug, args, { locale, isHub, cardIndex }, where) {
  const project = PROJECTS[slug];
  if (!project) throw new Error(`${where}: no project "${slug}" in data/projects.js`);
  const { years } = project;
  const yearsText = years.to === null ? `${years.from} &ndash; ${PRESENT[locale]}`
    : years.from === years.to ? String(years.from) : `${years.from} &ndash; ${years.to}`;
  const status = STATUSES[project.status];
  const statusSpan = text => `<span class="project-status project-status--${status.modifier}">${esc(text)}</span>`;
  const role = esc(project.role[locale]);

  switch (kind) {
    case 'card': {
      // The category is a filter tag too; the hub filters on data-tags.
      const filterTags = [project.category, ...project.tags.filter(tag => tag !== project.category)];
      const reverse = cardIndex % 2 === 1 ? ' project-card--reverse' : '';
      const ongoing = years.to === null ? ' data-ongoing' : '';
      return [`<article class="project-card${reverse}" data-updated="${project.updated}"${ongoing} data-tags="${filterTags.join(' ')}">`];
    }
    case 'meta':
      return [
        '<p class="project-meta">',
        `  <span>${role}</span>`,
        '  <span class="sep-dot" aria-hidden="true"></span>',
        `  <span>${yearsText}</span>`,
        '  <span class="sep-dot" aria-hidden="true"></span>',
        `  <button type="button" class="project-type" data-tag="${project.category}" aria-pressed="false">#${esc(CATEGORIES[project.category][locale])}</button>`,
        `  ${statusSpan(status[locale])}`,
        '</p>',
      ];
    case 'tags':
      return [
        '<div class="project-tags">',
        ...project.tags.map(tag => {
          if (!(tag in TAGS)) throw new Error(`${where}: tag "${tag}" has no label in TAGS`);
          const label = esc(textFor(TAGS[tag], locale));
          // On the hub every tag is a filter toggle; elsewhere it's a label.
          return isHub
            ? `  <button type="button" class="tag" data-tag="${tag}" aria-pressed="false">${label}</button>`
            : `  <span class="tag">${label}</span>`;
        }),
        '</div>',
      ];
    case 'facts': {
      if (args.includes('terminal')) {
        const labels = TERMINAL_LABELS[locale];
        return [
          `<dt>${labels.role}</dt>`, `<dd>${role}</dd>`,
          `<dt>${labels.years}</dt>`, `<dd>${yearsText}</dd>`,
          `<dt>${labels.status}</dt>`, `<dd>${statusSpan(status[locale].toLowerCase())}</dd>`,
        ];
      }
      return [
        '<p class="case-study__meta">',
        `  <span>${role}</span>`,
        '  <span class="sep-dot" aria-hidden="true"></span>',
        `  <span>${yearsText}</span>`,
        `  ${statusSpan(status[locale])}`,
        '</p>',
      ];
    }
    default:
      throw new Error(`${where}: unknown region build:project-${kind}`);
  }
}

function renderProjectRegions(html, context, eol, where) {
  let cardIndex = 0;
  return html.replace(
    /^([ \t]*)<!-- build:project-([a-z]+) ([^>]*?) -->[\s\S]*?<!-- \/build:project-\2 -->/gm,
    (match, indent, kind, params) => {
      const [slug, ...args] = params.trim().split(/\s+/);
      const lines = renderProject(kind, slug, args, { ...context, cardIndex }, where);
      if (kind === 'card') cardIndex++;
      return [`${indent}<!-- build:project-${kind} ${params} -->`, ...lines.map(line => indent + line), `${indent}<!-- /build:project-${kind} -->`].join(eol);
    }
  );
}

/** What kind of page this is, and its breadcrumb trail (home first; empty on the homepage). */
function placeOf(page, locale) {
  const url = page[locale];
  const links = LINKS[locale];
  const crumb = p => ({ name: p.crumb[locale], url: p[locale] });
  const home = { name: STRINGS[locale].homeCrumb, url: links.home };
  if (url === links.home) return { kind: 'home', trail: [] };
  for (const [section, childKind] of [['projects', 'case-study'], ['blog', 'article']]) {
    const sectionUrl = links[section];
    if (url === sectionUrl) return { kind: section, trail: [home, crumb(page)] };
    if (url.startsWith(`${sectionUrl}/`)) {
      const parent = PAGES.find(p => p[locale] === sectionUrl);
      return { kind: childKind, trail: [home, crumb(parent), crumb(page)] };
    }
  }
  throw new Error(`${url}: not the homepage and not under a known section`);
}

function breadcrumbLines(trail, locale) {
  return [
    `<nav class="breadcrumb" aria-label="${STRINGS[locale].breadcrumb}">`,
    '  <ol>',
    ...trail.map((crumb, i) => (i === trail.length - 1
      ? `    <li aria-current="page">${esc(crumb.name)}</li>`
      : `    <li><a href="${crumb.url}">${esc(crumb.name)}</a></li>`)),
    '  </ol>',
    '</nav>',
  ];
}

/* Responsive images — every <source data-sizes="LAYOUT"> gets the `sizes`
   that scripts/images.js derives from its layout and its image's shape, and a
   <link rel="preload" imagesrcset data-sizes> the same value as `imagesizes`,
   so the preload asks for exactly the file the <picture> will. The widest
   candidate is the image at full size, so its aspect is the image's. */
function renderImageSizes(html, rel) {
  return html.replace(/<(source|link)\b[^>]*>/g, (tag, name) => {
    const layout = (tag.match(/\sdata-sizes="([^"]+)"/) || [])[1];
    if (!layout) return tag;
    const [srcsetAttr, sizesAttr] = name === 'link' ? ['imagesrcset', 'imagesizes'] : ['srcset', 'sizes'];
    const srcset = (tag.match(new RegExp(`\\s${srcsetAttr}="([^"]+)"`)) || [])[1];
    if (!srcset) throw new Error(`${rel}: data-sizes on a <${name}> without ${srcsetAttr}`);
    const candidates = srcset.trim().split(/\s*,\s*/).map(candidate => candidate.split(/\s+/));
    const [widest] = candidates.sort((a, b) => parseInt(b[1], 10) - parseInt(a[1], 10));
    const { width, height } = imageSize(path.join(root, path.dirname(rel), widest[0]));
    return tag.replace(/data-sizes="[^"]+"/, `${sizesAttr}="${sizesFor(layout, width / height)}"`);
  });
}

function jsonldLines(graph) {
  // "</" can't appear inside a <script>; JSON lets it be written "<\/".
  const json = JSON.stringify(graph, null, 2).replace(/<\//g, '<\\/');
  return ['<script type="application/ld+json">', ...json.split('\n').map(line => `  ${line}`), '</script>'];
}

/** Replace a single <!-- build:NAME --> region with lines, indented like its marker. */
function fillRegion(html, name, lines, eol, where) {
  const region = new RegExp(`^([ \\t]*)<!-- build:${name} -->[\\s\\S]*?<!-- \\/build:${name} -->`, 'm');
  if (!region.test(html)) throw new Error(`${where}: no <!-- build:${name} --> region`);
  return html.replace(region, (m, indent) =>
    [`${indent}<!-- build:${name} -->`, ...lines.map(line => indent + line), `${indent}<!-- /build:${name} -->`].join(eol));
}

// Every page in en/ and es/ must be listed in site.js, or its header's language
// toggle would have no twin to point at. The locale 404s are the exception.
function htmlFilesUnder(dir) {
  const abs = path.join(root, dir);
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return htmlFilesUnder(rel);
    return e.name.endsWith('.html') ? [rel] : [];
  });
}
const listed = new Set(PAGES.flatMap(page => LOCALES.map(locale => fileFor(page[locale]))));
const unlisted = LOCALES.flatMap(htmlFilesUnder).filter(rel => !listed.has(rel) && !NOT_FOUND_PAGES.includes(rel));
if (unlisted.length) {
  console.error(`ERROR: pages missing from data/site.js:\n  ${unlisted.join('\n  ')}`);
  process.exit(1);
}

// Start every build from an empty dist/, so nothing stale can ship.
const dist = path.join(root, DIST);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const page of PAGES) {
  for (const locale of LOCALES) {
    const rel = fileFor(page[locale]);
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    const vars = varsFor(page, locale);
    // Keep each file's own line endings rather than mixing LF into a CRLF file.
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    let html = source;

    for (const name of BLOCKS) {
      const region = new RegExp(`<!-- build:${name} -->[\\s\\S]*?<!-- /build:${name} -->`);
      if (!region.test(html)) {
        console.error(`ERROR: ${rel} has no <!-- build:${name} --> … <!-- /build:${name} --> markers`);
        process.exit(1);
      }
      const body = render(templates[name], vars, locale, `templates/${name}.html (${rel})`).replace(/\n/g, eol);
      html = html.replace(region, () => `<!-- build:${name} -->${eol}${body}    <!-- /build:${name} -->`);
    }

    const isHub = page[locale] === LINKS[locale].projects;
    // The projects this page shows, in page order — read before the regions are filled.
    const slugs = [...new Set([...source.matchAll(/<!-- build:project-[a-z]+ ([\w-]+)/g)].map(m => m[1]))];
    html = renderProjectRegions(html, { locale, isHub }, eol, rel);

    // Breadcrumb trail, shared by the visible <nav> and the JSON-LD.
    const { kind, trail } = placeOf(page, locale);
    if (trail.length) {
      html = fillRegion(html, 'breadcrumb', breadcrumbLines(trail, locale), eol, rel);
    }
    const graph = graphFor({ page, locale, kind, trail, slugs, siteName: SITE_NAME[locale], blogUrl: LINKS[locale].blog });
    html = fillRegion(html, 'jsonld', jsonldLines(graph), eol, rel);
    html = renderImageSizes(html, rel);

    const out = path.join(dist, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
  }
}

// The standalone 404s have no build markers; they only need their CSS and
// script, which the next two build steps add, like every other page.
for (const rel of NOT_FOUND_PAGES) fs.copyFileSync(path.join(root, rel), path.join(dist, rel));

// The blog's Atom feed per locale (scripts/feed.js), linked from every page's SEO block.
for (const locale of LOCALES) {
  fs.writeFileSync(path.join(dist, feedPathFor(locale).slice(1)), feedFor(locale, LINKS[locale].blog, LINKS[locale].home));
}

// Everything else that ships, copied as-is. This list is the deploy whitelist:
// a new top-level asset directory or root file must be added here.
const STATIC = [
  'assets/img', 'assets/fonts', 'assets/pdf',
  'site.webmanifest', 'site.es.webmanifest', 'robots.txt', '_headers', '_redirects',
  '.well-known/security.txt',
];
// Not fs.cpSync: Node 22's native implementation fails with EIO on Windows
// when the path holds a non-ASCII character (as this checkout's does).
function copy(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dest, name));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}
for (const rel of STATIC) copy(path.join(root, rel), path.join(dist, rel));
// Some clients request /favicon.ico regardless of the <link> tags; without
// this copy they get the 404 page, uncacheable.
copy(path.join(root, 'assets/img/favicon.ico'), path.join(dist, 'favicon.ico'));
// Where the next step's terser writes the bundle (terser won't create it).
fs.mkdirSync(path.join(dist, 'assets/min'), { recursive: true });

console.log(`Built ${PAGES.length * LOCALES.length} pages (${BLOCKS.join('/')}) + ${NOT_FOUND_PAGES.length} 404s + ${LOCALES.length} feeds into ${DIST}/, and copied ${STATIC.length} static paths.`);
