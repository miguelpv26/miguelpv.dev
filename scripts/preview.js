/* preview.js — serve dist/ locally, the way Cloudflare Pages serves it.

   Usage:  npm run build && npm run preview     → http://localhost:8080/en/

   Mirrors the parts of production that matter for a preview (see
   serve-dist.js): extensionless URLs, directory indexes, the nearest 404.html,
   and `/` redirecting to /en/. Headers from _headers are not applied. Set PORT
   to use another port. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DIST } from './site.js';
import { serveDist } from './serve-dist.js';

const root = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST);
const port = Number(process.env.PORT) || 8080;

if (!fs.existsSync(root)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build first`);
  process.exit(1);
}

serveDist(root).listen(port, () => console.log(`Previewing ${DIST}/ at http://localhost:${port}/en/  (Ctrl+C to stop)`));
