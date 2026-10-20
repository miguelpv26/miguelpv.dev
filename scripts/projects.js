/* projects.js — the facts about each project that several pages repeat.

   A project's role, years, category, status and tags used to be typed out on
   the projects hub, the homepage and its case study, in both locales — and
   drifted. They live here now, and scripts/build-html.js renders them into
   these regions of the source pages:

     <!-- build:project-card SLUG -->     the hub card's opening <article> tag,
                                          with the filter data main.js reads
                                          (data-tags, data-updated, data-ongoing)
     <!-- build:project-meta SLUG -->     the hub card's role · years · #category
                                          · status line
     <!-- build:project-tags SLUG -->     the tag chips: toggle buttons on the
                                          hub (they filter), plain labels elsewhere
     <!-- build:project-facts SLUG -->    a case study's role · years · status
                                          line, or — inside its terminal <dl> —
                                          the same facts as dt/dd rows

   Each project's `schema` also becomes its JSON-LD entity on every page that
   shows it (see scripts/jsonld.js).

   What stays hand-written: names in prose, descriptions, bullets, media and
   the case studies' detailed stack lists (deliberately richer than the hub
   tags). */

/** Display text for each tag slug; a plain string is the same in both locales. */
export const TAGS = {
  html: 'HTML',
  css: 'CSS',
  javascript: 'JavaScript',
  cloudflare: 'Cloudflare',
  accessibility: { en: 'Accessibility', es: 'Accesibilidad' },
  seo: 'SEO',
  npm: 'npm',
  'open-source': { en: 'Open Source', es: 'Código abierto' },
  design: { en: 'Design', es: 'Diseño' },
  react: 'React',
  'restful-api': { en: 'RESTful API', es: 'API REST' },
  agile: { en: 'Agile Methodologies', es: 'Metodologías ágiles' },
  i18n: { en: 'Multilingual Support', es: 'Soporte multilingüe' },
  vue: 'Vue',
  node: 'Node',
  typescript: 'TypeScript',
  mongodb: 'MongoDB',
  tailwind: 'Tailwind CSS',
};

/** The hub's three categories, shown as #hashtags (and filterable). */
export const CATEGORIES = {
  product: { en: 'product', es: 'producto' },
  client: { en: 'client', es: 'cliente' },
  'open-source': { en: 'open-source', es: 'código-abierto' },
};

/** Status label and dot colour (the CSS modifier). */
export const STATUSES = {
  live: { modifier: 'live', en: 'Live', es: 'En producción' },
  published: { modifier: 'live', en: 'Published', es: 'Publicado' },
  standby: { modifier: 'standby', en: 'On stand-by', es: 'En pausa' },
  archived: { modifier: 'archived', en: 'Discontinued', es: 'Discontinuado' },
};

/**
 * One entry per project, keyed by its case-study slug.
 *   years    { from, to } — `to: null` means ongoing ("2025 – present")
 *   updated  year of last activity; the hub sorts by it
 *   tags     tag slugs, in display order (the category is added for filtering)
 *   schema   the project as JSON-LD (rendered on every page that shows the
 *            project): `type` plus schema.org properties; per-locale values are
 *            { en, es }. `id` overrides the default /#project-<slug>. `null`
 *            means the project is this website itself (/#website).
 *   image    the screenshot its case study names as primaryImageOfPage
 */
export const PROJECTS = {
  portfolio: {
    role: { en: 'Sole developer', es: 'Desarrollador único' },
    years: { from: 2025, to: null },
    updated: 2026,
    category: 'product',
    status: 'live',
    tags: ['html', 'css', 'javascript', 'cloudflare', 'accessibility'],
    schema: null,
  },
  'input-color-feedback': {
    role: { en: 'Author', es: 'Autor' },
    years: { from: 2025, to: null },
    updated: 2026,
    category: 'open-source',
    status: 'published',
    tags: ['npm', 'css', 'open-source', 'design'],
    image: '/assets/img/input-color-feedback/readme.png',
    schema: {
      type: 'SoftwareSourceCode',
      name: 'Input Color Feedback',
      description: {
        en: 'Lightweight utility library that provides visual feedback on input fields. Open-source npm package.',
        es: 'Librería ligera que aporta feedback visual en campos de entrada. Paquete npm open source.',
      },
      url: 'https://inputcolorfeedback.dev/',
      codeRepository: 'https://github.com/miguelpv26/input-color-feedback',
      programmingLanguage: 'CSS',
      runtimePlatform: 'Web',
      license: 'https://opensource.org/licenses/MIT',
      version: '2.2.0',
      datePublished: '2025',
      dateModified: '2026',
      keywords: {
        en: ['npm', 'css', 'ui', 'ux', 'input', 'feedback', 'design', 'accessibility'],
        es: ['npm', 'css', 'ui', 'ux', 'input', 'feedback', 'diseño', 'accesibilidad'],
      },
      sameAs: ['https://www.npmjs.com/package/input-color-feedback', 'https://github.com/miguelpv26/input-color-feedback'],
    },
  },
  'abogada-de-la-tierra': {
    role: { en: 'Design & development', es: 'Diseño y desarrollo' },
    years: { from: 2026, to: 2026 },
    updated: 2026,
    category: 'client',
    status: 'live',
    tags: ['html', 'css', 'javascript', 'cloudflare', 'seo'],
    image: '/assets/img/abogadadelatierra/inicio.png',
    // A client's site: described as that website, credited to me as its creator.
    schema: {
      type: 'WebSite',
      id: 'https://abogadadelatierra.es/#website',
      name: 'Abogada de la Tierra',
      url: 'https://abogadadelatierra.es/',
      description: {
        en: 'Website for an administrative-law firm: fast, accessible and built to convert.',
        es: 'Sitio de presentación para un despacho de Derecho Administrativo: rápido, accesible y orientado a conversión.',
      },
      inLanguage: 'es',
      datePublished: '2026',
    },
  },
  digitalando: {
    role: { en: 'Frontend developer', es: 'Desarrollador frontend' },
    years: { from: 2025, to: 2025 },
    updated: 2025,
    category: 'product',
    status: 'archived',
    tags: ['react', 'restful-api', 'agile', 'i18n'],
    image: '/assets/img/digitalando/landing.png',
    schema: {
      type: 'SoftwareApplication',
      name: 'Digitalando',
      applicationCategory: 'WebApplication',
      applicationSubCategory: { en: 'Developer community platform', es: 'Plataforma de comunidad de desarrolladores' },
      description: {
        en: 'Large-scale digitalization platform for companies and developers. Built with React and REST APIs. No longer in operation.',
        es: 'Plataforma de digitalización a gran escala para empresas y desarrolladores. Construida con React y APIs REST. Ya no está en funcionamiento.',
      },
      screenshot: '/assets/img/digitalando/landing.png',
      operatingSystem: 'Web',
      contributor: { en: 'Digitalando Team', es: 'Equipo de Digitalando' },
      keywords: 'JavaScript, React, REST APIs',
      datePublished: '2023',
      inLanguage: ['en', 'es'],
    },
  },
  biglo: {
    role: { en: 'Sole developer', es: 'Desarrollador único' },
    years: { from: 2024, to: 2024 },
    updated: 2024,
    category: 'product',
    status: 'standby',
    tags: ['vue', 'node', 'typescript', 'mongodb', 'tailwind'],
    image: '/assets/img/biglo/landing-page.png',
    schema: {
      type: 'SoftwareApplication',
      name: 'Biglo',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: { en: 'Logistics platform', es: 'Plataforma logística' },
      description: {
        en: 'B2B logistics platform built with Vue, Node.js, TypeScript and MongoDB.',
        es: 'Plataforma logística B2B construida con Vue, Node.js, TypeScript y MongoDB.',
      },
      url: 'https://biglosolutions.com',
      screenshot: '/assets/img/biglo/landing-page.png',
      operatingSystem: 'Web',
      keywords: 'JavaScript, TypeScript, Vue, Node.js, MongoDB',
      datePublished: '2024',
      inLanguage: ['en', 'es'],
    },
  },
};
