import archiver from 'archiver';
import { execFileSync } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { SITE_ORIGIN, PAGES, DIST, fileFor } from './site.js';

if (!existsSync(DIST)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run deploy (it builds first)`);
  process.exit(1);
}

/** Today's date (YYYY-MM-DD, local time). */
function today() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The date a page last changed, for its sitemap <lastmod>. Google only trusts
 * lastmod when it's consistently accurate, so stamping every URL with the deploy
 * date teaches it to ignore the field. Instead: a page with uncommitted changes
 * is being shipped right now, so it gets today; otherwise it gets the date of
 * the last commit that touched it. The source page is what's dated, and it only
 * changes when its content does — CSS and template edits land in dist/ alone.
 */
function lastModified(file) {
  const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
  try {
    if (git(['status', '--porcelain', '--', file])) return today();
    return git(['log', '-1', '--format=%cs', '--', file]) || today();
  } catch {
    return today(); // no git available — fall back to the deploy date
  }
}

function buildSitemap() {
  // x-default resolves to the English URL. The root path is deliberately not
  // listed: it's a noindex 302 to /en/ or /es/ (cloudflare/worker.js), and a
  // sitemap should only list canonical, indexable URLs.
  const altLinksFor = page =>
    [
      ['en', page.en],
      ['es', page.es],
      ['x-default', page.en],
    ]
      .map(([lang, path]) => `      <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_ORIGIN}${path}" />`)
      .join('\n');

  const urlBlock = (loc, page) => `  <url>
    <loc>${SITE_ORIGIN}${loc}</loc>
    <lastmod>${lastModified(fileFor(loc))}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${page.priority}</priority>
${altLinksFor(page)}
  </url>`;

  const blocks = PAGES.flatMap(page => [urlBlock(page.en, page), urlBlock(page.es, page)]);

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

// The whole built site, exactly as `npm run build` assembled it (the list of
// what ships lives in build-html.js), at the root of the zip.
archive.directory(`${DIST}/`, false);

// Generated at deploy time from data/site.js, dated from git (see lastModified).
archive.append(buildSitemap(), { name: 'sitemap.xml' });

archive.finalize();
