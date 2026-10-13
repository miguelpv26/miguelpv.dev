/* fingerprint-js.js — give the JS bundle a content-addressed filename and point
   every page at it.

   Pipeline:  terser writes assets/min/main.min.js (+ .map)
              →  hash its bytes  →  main.<hash>.min.js (+ .map)
              →  rewrite <script src> on every page
              →  delete the unhashed files and any stale hashes

   Why: the HTML revalidates on every request but the bundle was cached for four
   hours under a filename that never changed, so a fresh page could load a stale
   script. The toolbar on the projects hub ships `hidden` and is revealed by JS,
   so a stale bundle left it invisible — a deploy that looked half-applied.
   A content hash makes that impossible: new bytes, new URL. `_headers` may then
   serve /assets/min/* as immutable.

   The hash is taken from terser's output, which is deterministic, so a clean
   clone rebuilds the exact filename the committed HTML already references.
   Re-runnable. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const minDir = path.join(root, 'assets/min');

const PLAIN_JS = 'main.min.js';
const PLAIN_MAP = 'main.min.js.map';

const plainJsPath = path.join(minDir, PLAIN_JS);
if (!fs.existsSync(plainJsPath)) {
  console.error(`ERROR: ${PLAIN_JS} not found — run terser (npm run minify:js) first`);
  process.exit(1);
}

// 1. Hash terser's output. Eight hex chars is 4 billion buckets: plenty to make
//    an accidental collision between two builds of one file a non-event.
const bytes = fs.readFileSync(plainJsPath);
const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);

const hashedJs = `main.${hash}.min.js`;
const hashedMap = `${hashedJs}.map`;

// 2. Write the hashed pair, keeping the sourcemap link pointing at the hashed
//    map rather than the unhashed one we're about to delete.
let js = bytes.toString('utf8');
js = js.replace(new RegExp(`sourceMappingURL=${PLAIN_MAP.replace(/\./g, '\\.')}`), `sourceMappingURL=${hashedMap}`);
fs.writeFileSync(path.join(minDir, hashedJs), js);

const plainMapPath = path.join(minDir, PLAIN_MAP);
if (fs.existsSync(plainMapPath)) {
  const map = JSON.parse(fs.readFileSync(plainMapPath, 'utf8'));
  map.file = hashedJs;
  fs.writeFileSync(path.join(minDir, hashedMap), JSON.stringify(map));
}

// 3. Point every page at the new filename. Each page sits at a different depth,
//    so keep whatever prefix it already used (/, ../, ../../).
function htmlFilesUnder(dir) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFilesUnder(rel);
    return e.name.endsWith('.html') ? [rel] : [];
  });
}

const targets = [...htmlFilesUnder('en'), ...htmlFilesUnder('es'), '404.html'];
// prefix                     old filename, hashed or not
const tag = /(src="(?:\/|(?:\.\.\/)+)assets\/min\/)main(?:\.[0-9a-f]{8})?\.min\.js"/g;

let changed = 0;
const missing = [];

for (const rel of targets) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');

  if (!tag.test(before)) { missing.push(rel); continue; }
  tag.lastIndex = 0;

  const after = before.replace(tag, `$1${hashedJs}"`);
  if (after !== before) { fs.writeFileSync(file, after); changed++; }
}

if (missing.length) {
  console.error(`ERROR: no <script src="…/main[.hash].min.js"> found in:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

// 4. Drop the unhashed originals and any bundle left over from an earlier hash,
//    so assets/min/ only ever holds files it is safe to serve as immutable.
let removed = 0;
for (const name of fs.readdirSync(minDir)) {
  const stale = name === PLAIN_JS || name === PLAIN_MAP ||
    (/^main\.[0-9a-f]{8}\.min\.js(\.map)?$/.test(name) && name !== hashedJs && name !== hashedMap);
  if (stale) { fs.unlinkSync(path.join(minDir, name)); removed++; }
}

console.log(`JS bundle → ${hashedJs} (${bytes.length} bytes)`);
console.log(`Rewrote ${changed}/${targets.length} pages; removed ${removed} stale bundle file(s).`);
