/* jsonld.js — each page's structured data (JSON-LD), built from scripts/site.js
   and scripts/projects.js. Used by build-html.js to fill <!-- build:jsonld -->.

   Every page gets the same WebSite and Person (with his profile image), so the
   entities that share an @id across pages can never disagree. On top of that:

     homepage          ProfilePage whose mainEntity is the Person
     projects hub      CollectionPage + an ItemList of the projects, hub order
     blog hub          CollectionPage whose mainEntity is the Blog, which lists
                       every post (the same BlogPosting nodes as the articles)
     case study        WebPage about the project
     article           WebPage whose mainEntity is the BlogPosting (headline,
                       dates, card image, keywords), plus the Blog it is part of

   The breadcrumb always hangs off the WebPage: schema.org defines it only
   there, so a Blog or BlogPosting carrying it fails validation.

   plus a BreadcrumbList for every page below the homepage, and the JSON-LD
   entity of each project the page shows (any project with a build:project-*
   region in it). */
import { SITE_ORIGIN, PERSON, PAGES, imageFor, dateTimeFor } from './site.js';
import { PROJECTS } from './projects.js';

const abs = path => SITE_ORIGIN + path;
const ref = path => ({ '@id': abs(path) });
const pick = (value, locale) => (value && typeof value === 'object' && !Array.isArray(value) && 'en' in value ? value[locale] : value);

const PERSON_ID = '/#person';
const WEBSITE_ID = '/#website';
const PROFILE_IMAGE_ID = '/#profile-image';

/** The @id a project is known by: its own, the site's for this very site, or /#project-<slug>. */
export function projectId(slug) {
  const { schema } = PROJECTS[slug];
  if (schema === null) return abs(WEBSITE_ID);
  return schema.id || abs(`/#project-${slug}`);
}

function projectNode(slug, locale) {
  const { schema } = PROJECTS[slug];
  const node = { '@type': schema.type, '@id': projectId(slug) };
  for (const [key, raw] of Object.entries(schema)) {
    if (key === 'type' || key === 'id') continue;
    let value = pick(raw, locale);
    if (key === 'screenshot') value = abs(value);
    if (key === 'contributor') value = { '@type': 'Organization', name: value };
    node[key] = value;
  }
  // Software is authored; a client's website is created.
  node[schema.type === 'WebSite' ? 'creator' : 'author'] = ref(PERSON_ID);
  return node;
}

function sharedNodes(locale, siteName) {
  return [
    {
      '@type': 'WebSite',
      '@id': abs(WEBSITE_ID),
      url: abs('/'),
      name: PERSON.name,
      alternateName: siteName,
      inLanguage: ['en', 'es'],
      publisher: ref(PERSON_ID),
    },
    {
      '@type': 'Person',
      '@id': abs(PERSON_ID),
      name: PERSON.name,
      url: abs('/'),
      image: ref(PROFILE_IMAGE_ID),
      jobTitle: PERSON.jobTitle[locale],
      description: PERSON.description[locale],
      email: `mailto:${PERSON.email}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: PERSON.address.locality,
        addressRegion: PERSON.address.region[locale],
        addressCountry: PERSON.address.country,
      },
      sameAs: PERSON.sameAs,
      knowsAbout: PERSON.knowsAbout[locale],
      alumniOf: { '@type': 'Organization', name: PERSON.alumniOf },
    },
    {
      '@type': 'ImageObject',
      '@id': abs(PROFILE_IMAGE_ID),
      url: abs(PERSON.image),
      contentUrl: abs(PERSON.image),
      caption: PERSON.name,
    },
  ];
}

/**
 * The Blog — on the hub, and on every article so the post's isPartOf resolves
 * within the page (Google doesn't follow @ids across pages). The hub adds its
 * mainEntityOfPage and post list.
 */
function blogNode(blogUrl, locale) {
  const hub = PAGES.find(p => p[locale] === blogUrl);
  const seo = hub.seo[locale];
  return {
    '@type': 'Blog',
    '@id': abs(`${blogUrl}#blog`),
    url: abs(blogUrl),
    name: seo.shareTitle || seo.title,
    description: seo.description,
    author: ref(PERSON_ID),
    publisher: ref(PERSON_ID),
    inLanguage: locale,
  };
}

/** An article's BlogPosting — the same node on its own page and in the blog hub's list. */
function postNode(page, locale, blogUrl) {
  const url = page[locale];
  return {
    '@type': 'BlogPosting',
    '@id': abs(`${url}#article`),
    // Typed, so the post is complete in the hub's list too, where the article's
    // full WebPage node isn't (on the article page the two merge by @id).
    mainEntityOfPage: { '@type': 'WebPage', '@id': abs(`${url}#webpage`) },
    url: abs(url),
    headline: page.headline[locale],
    image: abs(imageFor(page, locale).src),
    description: page.seo[locale].description,
    datePublished: dateTimeFor(page.published),
    dateModified: dateTimeFor(page.modified),
    author: ref(PERSON_ID),
    publisher: ref(PERSON_ID),
    isPartOf: ref(`${blogUrl}#blog`),
    keywords: page.keywords[locale],
    inLanguage: locale,
  };
}

/**
 * @param page      the page's entry in site.js
 * @param locale    'en' | 'es'
 * @param kind      'home' | 'projects' | 'blog' | 'case-study' | 'article'
 * @param trail     breadcrumb [{ name, url }], home first ([] on the homepage)
 * @param slugs     projects shown on the page, in page order
 * @param siteName  og:site_name for this locale
 * @param blogUrl   the blog hub's URL in this locale (articles are part of it)
 */
export function graphFor({ page, locale, kind, trail, slugs, siteName, blogUrl }) {
  const url = page[locale];
  const seo = page.seo[locale];
  const nodes = sharedNodes(locale, siteName);
  const breadcrumb = trail.length ? ref(`${url}#breadcrumb`) : undefined;
  const base = {
    url: abs(url),
    name: seo.shareTitle || seo.title,
    description: seo.description,
    isPartOf: ref(WEBSITE_ID),
    ...(breadcrumb && { breadcrumb }),
    inLanguage: locale,
  };

  if (kind === 'home') {
    // A portfolio homepage is about one person: schema.org's (and Google's) ProfilePage.
    nodes.push({ '@type': 'ProfilePage', '@id': abs(`${url}#webpage`), ...base, mainEntity: ref(PERSON_ID), primaryImageOfPage: ref(PROFILE_IMAGE_ID) });
  } else if (kind === 'projects') {
    nodes.push({ '@type': 'CollectionPage', '@id': abs(`${url}#webpage`), ...base, about: ref(PERSON_ID), mainEntity: ref(`${url}#project-list`) });
    nodes.push({
      '@type': 'ItemList',
      '@id': abs(`${url}#project-list`),
      name: page.crumb[locale],
      itemListOrder: 'https://schema.org/ItemListOrderDescending',
      numberOfItems: slugs.length,
      itemListElement: slugs.map((slug, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@id': projectId(slug) } })),
    });
  } else if (kind === 'blog') {
    // A listing page like the projects hub. breadcrumb belongs to the page, not
    // the Blog (a CreativeWork); the Blog lists its posts, newest first.
    const posts = PAGES
      .filter(p => p.published && p[locale].startsWith(`${url}/`))
      .sort((a, b) => Date.parse(dateTimeFor(b.published)) - Date.parse(dateTimeFor(a.published)));
    nodes.push({ '@type': 'CollectionPage', '@id': abs(`${url}#webpage`), ...base, about: ref(PERSON_ID), mainEntity: ref(`${url}#blog`) });
    nodes.push({
      ...blogNode(url, locale),
      mainEntityOfPage: ref(`${url}#webpage`),
      blogPost: posts.map(p => ref(`${p[locale]}#article`)),
    });
    nodes.push(...posts.map(p => postNode(p, locale, url)));
  } else if (kind === 'case-study') {
    const slug = url.split('/').pop();
    const image = PROJECTS[slug]?.image;
    nodes.push({
      '@type': 'WebPage', '@id': abs(`${url}#webpage`), ...base,
      about: { '@id': projectId(slug) },
      ...(image && { primaryImageOfPage: abs(image) }),
    });
  } else if (kind === 'article') {
    // As on the blog hub, the WebPage carries the breadcrumb; the post is its main entity.
    nodes.push({ '@type': 'WebPage', '@id': abs(`${url}#webpage`), ...base, mainEntity: ref(`${url}#article`) });
    nodes.push(postNode(page, locale, blogUrl));
    nodes.push(blogNode(blogUrl, locale));
  }

  if (trail.length) {
    nodes.push({
      '@type': 'BreadcrumbList',
      '@id': abs(`${url}#breadcrumb`),
      itemListElement: trail.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.name, item: abs(crumb.url) })),
    });
  }

  for (const slug of slugs) {
    if (PROJECTS[slug].schema !== null) nodes.push(projectNode(slug, locale));
  }

  return { '@context': 'https://schema.org', '@graph': nodes };
}
