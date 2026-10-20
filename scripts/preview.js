/* preview.js — serve dist/ locally, the way Cloudflare Pages serves it.

   Usage:  npm run build && npm run preview     → http://localhost:8080/en/

   Mirrors the parts of production that matter for a preview: extensionless
   URLs (/en/projects → en/projects.html), directory indexes, the nearest
   404.html for anything missing, and `/` redirecting to /en/ (in production the Cloudflare
   Worker picks /en/ or /es/ from Accept-Language). Headers from _headers are
   not applied. Set PORT to use another port. */
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { DIST } from './site.js';

const root = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST);
const port = Number(process.env.PORT) || 8080;

if (!fs.existsSync(root)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build first`);
  process.exit(1);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.map': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname === '/') {
    res.writeHead(302, { Location: '/en/' });
    res.end();
    return;
  }
  const base = path.join(root, pathname);
  if (!base.startsWith(root)) { res.writeHead(403); res.end(); return; }

  const file = [base, `${base}.html`, path.join(base, 'index.html')]
    .find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!file) {
    // Like Cloudflare Pages: the nearest 404.html up the tree (/en/… → en/404.html).
    const localized = path.join(root, pathname.split('/')[1] || '', '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    fs.createReadStream(fs.existsSync(localized) ? localized : path.join(root, '404.html')).pipe(res);
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Previewing ${DIST}/ at http://localhost:${port}/en/  (Ctrl+C to stop)`));
