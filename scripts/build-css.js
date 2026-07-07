/* build-css.js — concatenate the CSS partials, minify, and INLINE the result
   into every HTML page to remove the render-blocking stylesheet request.
   Also keeps the strict-CSP style-src hash in _headers in sync.

   Pipeline:  assets/css/partials/*.css  →  concat (filename order = cascade)
              →  rewrite font url()s to root-absolute  →  clean-css minify
              →  write assets/min/style.min.css (artifact/fallback)
              →  inline into <style id="inline-css"> on every page
              →  sha256(inlined css) → _headers style-src

   The inlined string, the written artifact and the hashed string are the same
   bytes, so the CSP hash always matches what the browser sees. Re-runnable. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import CleanCSS from 'clean-css';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 1. Concatenate partials in filename order (order matters — CSS cascade).
const partialsDir = path.join(root, 'assets/css/partials');
const partials = fs.readdirSync(partialsDir).filter(f => f.endsWith('.css')).sort();
if (!partials.length) {
  console.error('ERROR: no partials found in assets/css/partials/');
  process.exit(1);
}
let raw = partials.map(f => fs.readFileSync(path.join(partialsDir, f), 'utf8')).join('\n');

// 2. The CSS is inlined into pages living at different depths (/en/,
//    /en/projects/, /404.html …), so the @font-face url()s — written relative
//    to assets/css/ — must become root-absolute to resolve everywhere.
raw = raw.replace(/url\((['"]?)\.\.\/fonts\//g, 'url($1/assets/fonts/');

// 3. Minify (clean-css level 1, same as the old CLI step). rebase:false leaves
//    our already-absolute url()s untouched.
const out = new CleanCSS({ rebase: false }).minify(raw);
if (out.errors.length) { console.error(out.errors); process.exit(1); }
const css = out.styles;

// 4. Keep a built artifact (fallback / easy diffing). No source map: it would
//    add a sourceMappingURL comment and change the hashed bytes.
fs.mkdirSync(path.join(root, 'assets/min'), { recursive: true });
fs.writeFileSync(path.join(root, 'assets/min/style.min.css'), css);

// 5. Inline into every page.
const hash = "'sha256-" + crypto.createHash('sha256').update(css, 'utf8').digest('base64') + "'";

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
const styleBlock = '<style id="inline-css">' + css + '</style>';
let changed = 0;

for (const rel of targets) {
  const file = path.join(root, rel);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  if (/<style id="inline-css">[\s\S]*?<\/style>/.test(html)) {
    // Already inlined — refresh the contents.
    html = html.replace(/<style id="inline-css">[\s\S]*?<\/style>/, styleBlock);
  } else {
    // First run — replace the external stylesheet <link> with the inline block.
    const link = /<link\b[^>]*rel="stylesheet"[^>]*style\.min\.css[^>]*>/;
    if (!link.test(html)) {
      console.warn(`SKIP (no stylesheet link or inline marker): ${rel}`);
      continue;
    }
    html = html.replace(link, styleBlock);
  }

  // The render-blocking request is gone, so drop its preload too (font preloads,
  // which don't reference style.min.css, are left untouched).
  html = html.replace(/[ \t]*<link\b[^>]*rel="preload"[^>]*style\.min\.css[^>]*>\r?\n/g, '');

  if (html !== before) { fs.writeFileSync(file, html); changed++; }
}

// 6. Sync the CSP style-src hash.
const headersPath = path.join(root, '_headers');
let headers = fs.readFileSync(headersPath, 'utf8');
const styleSrc = /style-src 'self' 'sha256-[A-Za-z0-9+/=]+'/;
if (!styleSrc.test(headers)) {
  console.error("ERROR: \"style-src 'self' 'sha256-…'\" not found in _headers");
  process.exit(1);
}
headers = headers.replace(styleSrc, `style-src 'self' ${hash}`);
fs.writeFileSync(headersPath, headers);

console.log(`Inlined ${css.length} bytes of CSS into ${changed}/${targets.length} pages.`);
console.log(`CSP style-src hash → ${hash}`);
