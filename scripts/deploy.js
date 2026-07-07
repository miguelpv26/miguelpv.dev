import archiver from 'archiver';
import { createWriteStream } from 'fs';

const SITE_ORIGIN = 'https://miguelpv.dev';

/**
 * Today's date (YYYY-MM-DD, local time) for the sitemap <lastmod>.
 * This project isn't tracked in git, so every deploy simply stamps "now".
 */
function today() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buildSitemap() {
  // No git history to consult — stamp the current deploy date on every URL.
  const lastMod = today();

  // Each group is one page available in both locales (an English URL and its
  // Spanish twin). x-default resolves to the English URL. To publish a new
  // case study, just add a line here — both <url> entries and their reciprocal
  // hreflang alternates are generated automatically.
  const GROUPS = [
    { en: '/en/',               es: '/es/',                priority: '1.0' },
    { en: '/en/projects',       es: '/es/proyectos',       priority: '0.8' },
    { en: '/en/projects/biglo',       es: '/es/proyectos/biglo',       priority: '0.6' },
    { en: '/en/projects/digitalando', es: '/es/proyectos/digitalando', priority: '0.6' },
    { en: '/en/projects/portfolio',   es: '/es/proyectos/portfolio',   priority: '0.6' },
    { en: '/en/projects/abogada-de-la-tierra', es: '/es/proyectos/abogada-de-la-tierra', priority: '0.6' },
    { en: '/en/projects/input-color-feedback', es: '/es/proyectos/input-color-feedback', priority: '0.6' },
  ];

  const altLinksFor = group =>
    [
      ['en', group.en],
      ['es', group.es],
      ['x-default', group.en],
    ]
      .map(([lang, path]) => `      <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_ORIGIN}${path}" />`)
      .join('\n');

  const urlBlock = (loc, group) => `  <url>
    <loc>${SITE_ORIGIN}${loc}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${group.priority}</priority>
${altLinksFor(group)}
  </url>`;

  const blocks = [
    // Root language-negotiation endpoint shares the homepage's alternates.
    urlBlock('/', GROUPS[0]),
  ];

  for (const group of GROUPS) {
    blocks.push(urlBlock(group.en, group));
    blocks.push(urlBlock(group.es, group));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

${blocks.join('\n\n')}

</urlset>
`;
}

const output = createWriteStream('miguelpv_dev.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log(`miguelpv_dev.zip created — ${kb} KB`);
});

archive.on('error', err => { throw err; });

archive.pipe(output);

// Pages content (referenced by HTML)
archive.directory('en/', 'en');
archive.directory('es/', 'es');
archive.directory('assets/min/', 'assets/min');
archive.directory('assets/img/', 'assets/img');
archive.directory('assets/fonts/', 'assets/fonts');
archive.directory('assets/pdf/', 'assets/pdf');
archive.file('site.webmanifest', { name: 'site.webmanifest' });
archive.file('site.es.webmanifest', { name: 'site.es.webmanifest' });
archive.file('robots.txt', { name: 'robots.txt' });
archive.file('_headers', { name: '_headers' });
archive.file('404.html', { name: '404.html' });

// Sitemap is generated at deploy time so lastmod reflects actual git history.
archive.append(buildSitemap(), { name: 'sitemap.xml' });

archive.finalize();
