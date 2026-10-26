/* site.js — what the tooling knows about the site: everything in data/site.js
   (the pages, the author, the locales), plus the build's own settings and the
   helpers that turn that data into files, dates and social images. Every
   script imports from here; the data itself is edited in data/site.js. */
import { LOCALES, TIME_ZONE } from '../data/site.js';

export * from '../data/site.js';

/** Where the build assembles the deployable site (gitignored). */
export const DIST = 'dist';

/** The standalone 404s: one per locale (Cloudflare Pages serves the nearest
    404.html up the tree, so /en/… and /es/… each get their own language) and an
    English one at the root for anything outside the locale folders. They
    have no build markers and aren't in PAGES. */
export const NOT_FOUND_PAGES = [...LOCALES.map(locale => `${locale}/404.html`), '404.html'];

/** The HTML file that serves a URL: /en/ → en/index.html, /en/blog → en/blog.html. */
export function fileFor(url) {
  return url.endsWith('/') ? `${url.slice(1)}index.html` : `${url.slice(1)}.html`;
}

/** TIME_ZONE's UTC offset at an instant, as "+02:00" (Intl says "GMT+02:00", or plain "GMT" at zero). */
function offsetAt(ms) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' })
    .formatToParts(new Date(ms)).find(part => part.type === 'timeZoneName').value;
  return name === 'GMT' ? '+00:00' : name.slice(3);
}

/**
 * An article date from PAGES as a full ISO 8601 date-time with TIME_ZONE's
 * offset on that day: '2026-07-13' → '2026-07-13T12:00:00+02:00'. Schema.org
 * DateTime values and article:*_time want a zone; a bare date has none, and
 * Google's validators flag it. A date without a time means noon, which stays
 * on the same calendar day from UTC-10 to UTC+12 (midnight would read as the
 * previous day anywhere west of Madrid).
 */
export function dateTimeFor(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value || '');
  if (!m) throw new Error(`data/site.js: article date "${value}" isn't YYYY-MM-DD or YYYY-MM-DDTHH:MM`);
  const [, y, mo, d, h = '12', mi = '00'] = m;
  const wall = Date.UTC(+y, mo - 1, +d, +h, +mi);
  const check = new Date(wall);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== +d || +h > 23 || +mi > 59) {
    throw new Error(`data/site.js: article date "${value}" doesn't exist`);
  }
  // Reading the wall time as UTC lands within hours of the real instant; asking
  // again from the corrected instant settles dates right next to a DST switch.
  const toMs = offset => (offset[0] === '-' ? -1 : 1) * (+offset.slice(1, 3) * 60 + +offset.slice(4, 6)) * 60000;
  const offset = offsetAt(wall - toMs(offsetAt(wall)));
  return `${y}-${mo}-${d}T${h}:${mi}:00${offset}`;
}

/** The page's social image for a locale: { src (root-absolute), alt }. */
export function imageFor(page, locale) {
  if (page.image) return page.image[locale];
  const card = page.card[locale];
  return {
    src: `/assets/img/og/${page.card.name}-${locale}.png`,
    alt: `${card.eyebrow}: ${card.title}. ${card.sub}`,
  };
}
