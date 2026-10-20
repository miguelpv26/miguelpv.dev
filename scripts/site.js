/* site.js — the single source of truth for every page, shared by the build,
   the social-card renderer, the checks and the deploy.

   Each PAGES entry is one page that exists in both locales: its English URL
   and its Spanish twin, plus everything about it that isn't page content:

     seo.{en,es}    title and meta description (≤155 chars), and an optional
                    shareTitle when the social title should differ from <title>
     card.{en,es}   the 1200×630 social card's copy (rendered by og-cards.js to
                    assets/img/og/<card.name>-<locale>.png); pages without a card
                    give a ready-made image instead
     crumb.{en,es}  the page's label in its breadcrumb trail (visible and JSON-LD)
     published /    article dates (YYYY-MM-DD); must match the article's visible
     modified       <time>, which scripts/check.js verifies
     headline /     articles: the BlogPosting headline (the full H1) and keywords
     keywords

   The JSON-LD of every page is generated from this file and scripts/projects.js
   (PERSON below, each page's entry, and the projects the page shows).

   Read by:
     scripts/build-html.js  → each page's SEO block (title, description,
                              canonical, hreflang, Open Graph, Twitter), JSON-LD,
                              breadcrumb, and the header's EN/ES toggle and
                              "you are here" state
     scripts/og-cards.js    → the social cards
     scripts/check.js       → what each page must declare
     scripts/deploy.js      → sitemap.xml

   To add a page: create both HTML files with the build markers, add an entry
   here, render its cards (npm run og-cards -- <name>-en <name>-es), then
   npm run build && npm run check. */

export const SITE_ORIGIN = 'https://miguelpv.dev';

/** Where the build assembles the deployable site (gitignored). */
export const DIST = 'dist';

export const LOCALES = ['en', 'es'];

/** The standalone 404s: one per locale (Cloudflare Pages serves the nearest
    404.html up the tree, so /en/… and /es/… each get their own language) and an
    English one at the root for anything outside the locale folders. They
    have no build markers and aren't in PAGES. */
export const NOT_FOUND_PAGES = [...LOCALES.map(locale => `${locale}/404.html`), '404.html'];

/** og:site_name, per locale. */
export const SITE_NAME = {
  en: 'Miguel Payá Vañó Portfolio',
  es: 'Portfolio de Miguel Payá Vañó',
};

/** The footer line of every social card, per locale. */
export const CARD_FOOTER = {
  en: 'Full-Stack Developer',
  es: 'Desarrollador Full-Stack',
};

/** The site's author, as JSON-LD describes him on every page (Person + WebSite). */
export const PERSON = {
  name: 'Miguel Payá Vañó',
  email: 'miguelpayav@gmail.com',
  image: '/assets/img/picture.jpg',
  logo: { src: '/assets/img/favicon-512x512.png', width: 512, height: 512, caption: { en: "MiguelPV's logo", es: 'Logotipo de MiguelPV' } },
  jobTitle: { en: 'Full-Stack Developer', es: 'Desarrollador Full-Stack' },
  description: {
    en: "Full-stack developer working in Vue, Node.js, TypeScript and MongoDB, or in plain HTML, CSS and JavaScript when a framework isn't worth its weight. Builds for speed, accessibility and privacy.",
    es: 'Desarrollador full-stack con Vue, Node.js, TypeScript y MongoDB, o con HTML, CSS y JavaScript puros cuando un framework no compensa. Construye pensando en la velocidad, la accesibilidad y la privacidad.',
  },
  address: { locality: 'Alcoy', region: { en: 'Alicante, Valencian Community', es: 'Alacant, Comunitat Valenciana' }, country: 'ES' },
  alumniOf: 'CIP FP Batoi',
  sameAs: [
    'https://github.com/miguelpv26',
    'https://linkedin.com/in/miguel-pay%C3%A1-va%C3%B1%C3%B3',
    'https://www.npmjs.com/~miguelpv',
  ],
  knowsAbout: {
    en: ['JavaScript', 'TypeScript', 'Vue.js', 'React', 'Node.js', 'MongoDB', 'REST APIs', 'Tailwind CSS', 'Semantic HTML', 'CSS', 'Progressive enhancement', 'Web performance', 'Core Web Vitals', 'Web accessibility', 'Web privacy', 'Content Security Policy', 'Agile methodologies'],
    es: ['JavaScript', 'TypeScript', 'Vue.js', 'React', 'Node.js', 'MongoDB', 'APIs REST', 'Tailwind CSS', 'HTML semántico', 'CSS', 'Mejora progresiva', 'Rendimiento web', 'Core Web Vitals', 'Accesibilidad web', 'Privacidad web', 'Content Security Policy', 'Metodologías ágiles'],
  },
};

export const PAGES = [
  {
    en: '/en/', es: '/es/', priority: '1.0',
    seo: {
      en: { title: 'Miguel Payá Vañó | Full-Stack Developer Portfolio', description: 'Miguel Payá Vañó, full-stack developer: Vue, Node.js, TypeScript and MongoDB, or plain HTML, CSS and JavaScript when a framework isn\'t worth its weight.' },
      es: { title: 'Miguel Payá Vañó | Portfolio de Desarrollador Full-Stack', description: 'Miguel Payá Vañó, desarrollador full-stack: Vue, Node.js, TypeScript y MongoDB, o HTML, CSS y JavaScript puros cuando un framework no compensa.' },
    },
    image: {
      en: { src: '/assets/img/og-image.png', alt: 'Miguel Payá Vañó - Full-Stack Developer' },
      es: { src: '/assets/img/og-image.es.png', alt: 'Miguel Payá Vañó - Desarrollador Full-Stack' },
    },
  },
  {
    en: '/en/projects', es: '/es/proyectos', priority: '0.8',
    crumb: { en: 'Projects', es: 'Proyectos' },
    seo: {
      en: { title: 'Projects | Miguel Payá Vañó — Full-Stack Developer', description: 'Every project by Miguel Payá Vañó: products like Biglo and Digitalando, client sites and open-source npm tools, in Vue, Node.js, React or no framework.' },
      es: { title: 'Proyectos | Miguel Payá Vañó — Desarrollador Full-Stack', description: 'Los proyectos de Miguel Payá Vañó: productos como Biglo y Digitalando, webs de clientes y paquetes open source, con Vue, Node.js, React o sin framework.' },
    },
    card: {
      name: 'projects',
      en: { eyebrow: 'Projects', title: 'Everything I\'ve built', sub: 'Products, client work and open-source tools, all held to the same bar.', chips: 'Vue|Node|TypeScript|React|JavaScript' },
      es: { eyebrow: 'Proyectos', title: 'Todo lo que he construido', sub: 'Productos, webs para clientes y herramientas open source, con el mismo listón para todos.', chips: 'Vue|Node|TypeScript|React|JavaScript', size: 80 },
    },
  },
  {
    en: '/en/blog', es: '/es/blog', priority: '0.8',
    crumb: { en: 'Blog', es: 'Blog' },
    seo: {
      en: { title: 'Blog | Miguel Payá Vañó — Full-Stack Developer', description: 'Notes on web performance, Core Web Vitals, font loading, accessibility and when a framework earns its weight, by full-stack developer Miguel Payá Vañó.' },
      es: { title: 'Blog | Miguel Payá Vañó — Desarrollador Full-Stack', description: 'Artículos sobre rendimiento web, Core Web Vitals, carga de fuentes, accesibilidad y cuándo compensa un framework, por el desarrollador Miguel Payá Vañó.' },
    },
    card: {
      name: 'blog',
      en: { eyebrow: 'Blog', title: 'How I build websites, and why', sub: 'Web performance, Core Web Vitals, font loading, accessibility, and when a framework earns its weight.', chips: 'WPO|Core Web Vitals|Fonts|Accessibility', size: 76 },
      es: { eyebrow: 'Blog', title: 'Cómo construyo webs, y por qué', sub: 'Rendimiento web, Core Web Vitals, carga de fuentes, accesibilidad y cuándo compensa un framework.', chips: 'WPO|Core Web Vitals|Fuentes|Accesibilidad', size: 76 },
    },
  },
  {
    en: '/en/blog/web-font-strategy', es: '/es/blog/estrategia-fuentes-web', priority: '0.7',
    published: '2026-07-13', modified: '2026-10-16',
    crumb: { en: 'Web font strategy', es: 'Estrategia de fuentes web' },
    headline: { en: 'Web Font Strategy: the four steps I always run', es: 'Estrategia de fuentes web: los cuatro pasos que siempre aplico' },
    keywords: {
      en: 'web font performance, self-hosting fonts, font subsetting, preload fonts, woff2, Core Web Vitals, WPO',
      es: 'rendimiento de fuentes web, autoalojar fuentes, subconjunto de fuentes, precargar fuentes, woff2, Core Web Vitals, WPO',
    },
    seo: {
      en: { title: 'Web Font Strategy in 4 Steps | Miguel Payá Vañó', description: 'How I make web fonts fast: self-host, woff2, subset and preload. On this site, JetBrains Mono goes from 825 KB of TTF to 65 KB, measured step by step.', shareTitle: 'Web Font Strategy in 4 Steps' },
      es: { title: 'Estrategia de fuentes web en 4 pasos | Miguel Payá Vañó', description: 'Cómo consigo que las fuentes web carguen rápido: autoalojarlas, woff2, subconjuntos y preload. En esta web, de 825 KB en TTF a 65 KB, medido paso a paso.', shareTitle: 'Estrategia de fuentes web en 4 pasos' },
    },
    card: {
      name: 'web-font-strategy',
      en: { eyebrow: 'Blog · Web fonts', title: 'Web Font Strategy', sub: 'The four steps I always run, measured on this site.', chips: 'Self-host|woff2|Subset|Preload', pill: '825 KB -> 65 KB' },
      es: { eyebrow: 'Blog · Fuentes web', title: 'Estrategia de fuentes web', sub: 'Los cuatro pasos que siempre aplico, medidos en esta web.', chips: 'Autoalojar|woff2|Subconjunto|Preload', pill: '825 KB -> 65 KB', size: 62 },
    },
  },
  {
    en: '/en/projects/biglo', es: '/es/proyectos/biglo', priority: '0.6',
    crumb: { en: 'Biglo', es: 'Biglo' },
    seo: {
      en: { title: 'Biglo — Case Study | Miguel Payá Vañó', description: 'Case study: Biglo, a B2B logistics platform I built end-to-end with Vue, Node.js, TypeScript and MongoDB. 100/100 in Lighthouse, zero accessibility issues.' },
      es: { title: 'Biglo — Caso práctico | Miguel Payá Vañó', description: 'Caso práctico: Biglo, una plataforma logística B2B que desarrollé de principio a fin con Vue, Node.js, TypeScript y MongoDB. 100/100 en Lighthouse.' },
    },
    card: {
      name: 'biglo',
      en: { eyebrow: 'Case study', title: 'Biglo', sub: 'A B2B logistics platform I built end-to-end as its sole developer.', chips: 'Vue|Node|TypeScript|MongoDB|Tailwind', pill: '100/100 LIGHTHOUSE' },
      es: { eyebrow: 'Caso práctico', title: 'Biglo', sub: 'Una plataforma logística B2B que desarrollé de principio a fin, yo solo.', chips: 'Vue|Node|TypeScript|MongoDB|Tailwind', pill: '100/100 LIGHTHOUSE' },
    },
  },
  {
    en: '/en/projects/digitalando', es: '/es/proyectos/digitalando', priority: '0.6',
    crumb: { en: 'Digitalando', es: 'Digitalando' },
    seo: {
      en: { title: 'Digitalando — Case Study | Miguel Payá Vañó', description: 'Case study: Digitalando, a React digitalization platform. On its frontend team I shipped features, refactored UI and took SEO and accessibility to 100.' },
      es: { title: 'Digitalando — Caso práctico | Miguel Payá Vañó', description: 'Caso práctico: Digitalando, una plataforma de digitalización en React. En el equipo de frontend creé funcionalidades y llevé SEO y accesibilidad a 100.' },
    },
    card: {
      name: 'digitalando',
      en: { eyebrow: 'Case study', title: 'Digitalando', sub: 'A large-scale digitalization platform in React, where I cut the landing page LCP from 6.7s to 3.2s.', chips: 'React|REST API|Agile|i18n', pill: 'LCP 6.7s -> 3.2s' },
      es: { eyebrow: 'Caso práctico', title: 'Digitalando', sub: 'Una plataforma de digitalización a gran escala en React, donde bajé el LCP de la landing de 6,7s a 3,2s.', chips: 'React|API REST|Agile|i18n', pill: 'LCP 6,7s -> 3,2s' },
    },
  },
  {
    en: '/en/projects/portfolio', es: '/es/proyectos/portfolio', priority: '0.6',
    crumb: { en: 'miguelpv.dev', es: 'miguelpv.dev' },
    seo: {
      en: { title: 'miguelpv.dev — Case Study | Miguel Payá Vañó', description: 'Case study: miguelpv.dev, my portfolio, hand-built in vanilla HTML, CSS and JavaScript for speed, privacy and accessibility, served from Cloudflare Pages.' },
      es: { title: 'miguelpv.dev — Caso práctico | Miguel Payá Vañó', description: 'Caso práctico: miguelpv.dev, mi portfolio, hecho a mano con HTML, CSS y JavaScript puros: rápido, privado y accesible, y servido desde Cloudflare Pages.' },
    },
    card: {
      name: 'portfolio',
      en: { eyebrow: 'Case study', title: 'miguelpv.dev', sub: 'This site: hand-built in vanilla HTML, CSS and JavaScript. No framework, no trackers.', chips: 'HTML|CSS|JavaScript|Cloudflare', pill: 'LIGHTHOUSE 100 × 4' },
      es: { eyebrow: 'Caso práctico', title: 'miguelpv.dev', sub: 'Esta web: hecha a mano con HTML, CSS y JavaScript puros. Sin frameworks ni rastreadores.', chips: 'HTML|CSS|JavaScript|Cloudflare', pill: 'LIGHTHOUSE 100 × 4' },
    },
  },
  {
    en: '/en/projects/abogada-de-la-tierra', es: '/es/proyectos/abogada-de-la-tierra', priority: '0.6',
    crumb: { en: 'Abogada de la Tierra', es: 'Abogada de la Tierra' },
    seo: {
      en: { title: 'Abogada de la Tierra — Case Study | Miguel Payá Vañó', description: 'Case study: the website I designed and built for an administrative-law firm. Vanilla HTML, CSS and JS, a serverless Cloudflare contact form, and local SEO.' },
      es: { title: 'Abogada de la Tierra — Caso práctico | Miguel Payá Vañó', description: 'Caso práctico: la web que diseñé y desarrollé para un despacho de Derecho Administrativo. HTML, CSS y JS puros, formulario serverless y SEO local.' },
    },
    card: {
      name: 'abogada-de-la-tierra',
      en: { eyebrow: 'Case study · Client', title: 'Abogada de la Tierra', sub: 'The website I designed and built for an administrative-law firm in Alicante.', chips: 'HTML|CSS|JavaScript|Cloudflare|SEO', pill: 'FREELANCE', size: 80 },
      es: { eyebrow: 'Caso práctico · Cliente', title: 'Abogada de la Tierra', sub: 'La web que diseñé y desarrollé para un despacho de Derecho Administrativo en Alicante.', chips: 'HTML|CSS|JavaScript|Cloudflare|SEO', pill: 'FREELANCE', size: 80 },
    },
  },
  {
    en: '/en/projects/input-color-feedback', es: '/es/proyectos/input-color-feedback', priority: '0.6',
    crumb: { en: 'Input Color Feedback', es: 'Input Color Feedback' },
    seo: {
      en: { title: 'Input Color Feedback — Case Study | Miguel Payá Vañó', description: 'Case study: input-color-feedback, my dependency-free npm package that gives form inputs live colour and icon feedback. Pure CSS, accessible, ≈0.97 KB.' },
      es: { title: 'Input Color Feedback — Caso práctico | Miguel Payá Vañó', description: 'Caso práctico: input-color-feedback, mi paquete npm sin dependencias que da a los formularios feedback de color e icono en vivo. CSS puro, ≈0,97 KB.' },
    },
    card: {
      name: 'input-color-feedback',
      en: { eyebrow: 'Case study · Open source', title: 'Input Color Feedback', sub: 'Live colour and icon feedback for form inputs. Pure CSS, no JavaScript, published on npm.', chips: 'npm|CSS|Open Source|MIT', pill: '~0.97 KB', size: 80 },
      es: { eyebrow: 'Caso práctico · Open source', title: 'Input Color Feedback', sub: 'Feedback de color e icono en vivo para formularios. CSS puro, sin JavaScript, publicado en npm.', chips: 'npm|CSS|Open Source|MIT', pill: '~0,97 KB', size: 80 },
    },
  },
];


/** The HTML file that serves a URL: /en/ → en/index.html, /en/blog → en/blog.html. */
export function fileFor(url) {
  return url.endsWith('/') ? `${url.slice(1)}index.html` : `${url.slice(1)}.html`;
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