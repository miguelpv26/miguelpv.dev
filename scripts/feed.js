/* feed.js — the blog's Atom feed, one per locale, built from scripts/site.js.

   Every page with `published` is an article and gets an entry: its headline,
   meta description (as the summary), dates and URL, newest first. Nothing in
   the feed is hand-written, so it can't drift from the pages it lists. Feed
   readers find it through the <link rel="alternate" type="application/atom+xml">
   in every page's SEO block, and search engines through robots.txt, which
   lists it as a sitemap (Google and Bing read Atom there): a feed carries only
   the latest posts, so it points crawlers at what's new.

   Read by:
     scripts/build-html.js  → writes dist/<locale>/feed.xml and links it from every page
     scripts/check.js       → each feed's entries match site.js */
import { PAGES, PERSON, SITE_ORIGIN, dateTimeFor } from './site.js';

/** Where a locale's feed is served: /en/feed.xml. */
export const feedPathFor = locale => `/${locale}/feed.xml`;

/** The articles, newest first. */
export const articles = () => PAGES.filter(page => page.published)
  .sort((a, b) => Date.parse(dateTimeFor(b.published)) - Date.parse(dateTimeFor(a.published)));

/** The feed's name, as readers list it: the blog hub's title, like the JSON-LD Blog's name. */
export function feedTitleFor(locale, blogUrl) {
  const seo = PAGES.find(page => page[locale] === blogUrl).seo[locale];
  return seo.shareTitle || seo.title;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param locale   'en' | 'es'
 * @param blogUrl  the locale's blog hub, whose title and description name the feed
 * @param homeUrl  the locale's homepage, the author's profile
 */
export function feedFor(locale, blogUrl, homeUrl) {
  const hub = PAGES.find(page => page[locale] === blogUrl).seo[locale];
  const posts = articles();
  if (!posts.length) throw new Error('feed.js: no page in site.js has `published`, so there is nothing to put in the feed');
  // The feed changed when its most recently modified entry did.
  const updated = posts.map(page => dateTimeFor(page.modified)).sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  const entries = posts.map(page => {
    const url = SITE_ORIGIN + page[locale];
    return `  <entry>
    <id>${url}</id>
    <title>${esc(page.headline[locale])}</title>
    <link rel="alternate" type="text/html" href="${url}" />
    <published>${dateTimeFor(page.published)}</published>
    <updated>${dateTimeFor(page.modified)}</updated>
    <summary>${esc(page.seo[locale].description)}</summary>
  </entry>`;
  });

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${locale}">
  <id>${SITE_ORIGIN}${feedPathFor(locale)}</id>
  <title>${esc(feedTitleFor(locale, blogUrl))}</title>
  <subtitle>${esc(hub.description)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE_ORIGIN}${feedPathFor(locale)}" />
  <link rel="alternate" type="text/html" href="${SITE_ORIGIN}${blogUrl}" />
  <updated>${updated}</updated>
  <author>
    <name>${esc(PERSON.name)}</name>
    <uri>${SITE_ORIGIN}${homeUrl}</uri>
  </author>
  <icon>${SITE_ORIGIN}/assets/img/favicon-192x192.png</icon>
${entries.join('\n')}
</feed>
`;
}
