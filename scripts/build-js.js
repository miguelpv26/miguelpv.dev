/* build-js.js — second build step, first half: concatenate the JS partials and
   minify them into the one bundle every page loads. fingerprint-js.js then
   content-hashes it.

   Pipeline:  assets/js/partials/*.js  →  concat (filename order)
              →  terser (drop console.*, mangle)
              →  dist/assets/min/main.min.js + main.min.js.map

   The partials are one classic script cut into files, not modules: they share
   one top-level scope, so a partial can call any function another declares.
   Top-level consts are the exception, since they don't exist until their file
   has run — which is why 08-init.js, the only file that starts anything, comes
   last. The source map names each partial, so devtools show the right file. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { minify } from 'terser';
import { DIST } from './site.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, DIST);
if (!fs.existsSync(dist)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build (build-html.js creates it)`);
  process.exit(1);
}

const partialsDir = 'assets/js/partials';
const partials = fs.readdirSync(path.join(root, partialsDir)).filter(f => f.endsWith('.js')).sort();
if (!partials.length) {
  console.error(`ERROR: no partials found in ${partialsDir}/`);
  process.exit(1);
}

// terser keeps the object's key order, and the keys become the map's sources.
const sources = Object.fromEntries(partials.map(f => [`${partialsDir}/${f}`, fs.readFileSync(path.join(root, partialsDir, f), 'utf8')]));
const out = await minify(sources, {
  compress: { drop_console: true },
  mangle: true,
  sourceMap: { filename: 'main.min.js', url: 'main.min.js.map' },
});

const minDir = path.join(dist, 'assets/min');
fs.mkdirSync(minDir, { recursive: true });
fs.writeFileSync(path.join(minDir, 'main.min.js'), out.code);
fs.writeFileSync(path.join(minDir, 'main.min.js.map'), out.map);
console.log(`Minified ${partials.length} partials into ${DIST}/assets/min/main.min.js (${out.code.length} bytes).`);
