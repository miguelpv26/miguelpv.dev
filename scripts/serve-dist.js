/* serve-dist.js — an HTTP server for dist/ that answers the way Cloudflare
   Pages does: extensionless URLs (/en/projects → en/projects.html), directory
   indexes, the nearest 404.html for anything missing, and `/` redirecting to
   /en/ (in production the Cloudflare Worker picks /en/ or /es/ from
   Accept-Language). Headers from _headers are not applied.

   Used by preview.js (to look at the site) and audit-sizes.js (to measure it). */
import fs from 'fs';
import http from 'http';
import path from 'path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.map': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/** An http.Server (not yet listening) that serves the built site in `root`. */
export function serveDist(root) {
  return http.createServer((req, res) => {
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
  });
}
