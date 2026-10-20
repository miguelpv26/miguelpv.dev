/* build-css.js — third build step: concatenate the CSS partials, minify, and
   INLINE the result into every page in dist/ to remove the render-blocking
   stylesheet request. Also writes the strict-CSP style-src hash into
   dist/_headers.

   Pipeline:  assets/css/partials/*.css  →  concat (filename order = cascade)
              →  rewrite font url()s to root-absolute  →  clean-css minify
              →  plain fallbacks before color-mix() / dvh declarations
              →  inline into <style id="inline-css"> on every page in dist/
              →  sha256(inlined css) → dist/_headers style-src

   The inlined string and the hashed string are the same bytes, so the CSP hash
   always matches what the browser sees. The source pages keep an empty
   <style id="inline-css"></style> and the source _headers a placeholder hash;
   only dist/ holds the real thing. Needs dist/ (run via `npm run build`). */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import CleanCSS from 'clean-css';
import { DIST } from './site.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, DIST);
if (!fs.existsSync(dist)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build (build-html.js creates it)`);
  process.exit(1);
}

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
const css = addFallbacks(out.styles, raw);

// 3b. Fallbacks for browsers that predate color-mix() (Chrome 111 / Firefox 113 /
//     Safari 16.2) or dvh units. A browser drops a declaration whose value it
//     can't parse and keeps the previous one, so each such declaration gets a
//     plain twin written just before it:
//       border-color:rgba(22,198,12,.3);border-color:color-mix(in srgb,var(--color-primary) 30%,transparent)
//     Modern browsers apply the second line exactly as before; older ones keep
//     the first. The twin is computed from the :root tokens, so it can never
//     drift from the source. Every mix in the partials is "colour N% with
//     transparent" or two opaque colours, and both have an exact sRGB result —
//     the fallback renders identically, not approximately. Anything this can't
//     resolve fails the build rather than shipping a silently wrong colour.
function addFallbacks(minified, source) {
  const rootBlock = source.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootBlock) throw new Error('addFallbacks: no :root block in the partials');
  const tokens = {};
  for (const [, name, value] of rootBlock[1].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim();

  const resolve = (v, depth = 0) => {
    if (depth > 10) throw new Error(`addFallbacks: var() cycle in "${v}"`);
    return v.replace(/var\(--([\w-]+)\)/g, (m, name) => {
      if (!(name in tokens)) throw new Error(`addFallbacks: unknown token --${name}`);
      return resolve(tokens[name], depth + 1);
    }).trim();
  };

  const parseColor = s => {
    s = s.trim().toLowerCase();
    if (s === 'transparent') return [0, 0, 0, 0];
    let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
      const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
      return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1);
    }
    m = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    throw new Error(`addFallbacks: can't parse colour "${s}"`);
  };

  const fmt = ([r, g, b, a]) => {
    const [R, G, B] = [r, g, b].map(Math.round);
    if (a >= 0.9995) return '#' + [R, G, B].map(n => n.toString(16).padStart(2, '0')).join('');
    return `rgba(${R},${G},${B},${String(+a.toFixed(3)).replace(/^0\./, '.')})`;
  };

  // color-mix(in srgb, A [p%], B [q%]) — premultiplied-alpha interpolation in sRGB.
  const mix = args => {
    const parts = args.split(/,(?![^(]*\))/).map(p => p.trim());
    if (parts.length !== 3 || parts[0] !== 'in srgb') throw new Error(`addFallbacks: unsupported color-mix(${args})`);
    const stop = p => {
      const m = p.match(/^(.*?)(?:\s+([\d.]+)%)?$/);
      return { c: parseColor(resolve(m[1])), p: m[2] === undefined ? null : +m[2] / 100 };
    };
    const a = stop(parts[1]), b = stop(parts[2]);
    if (a.p === null && b.p === null) a.p = b.p = 0.5;
    else if (a.p === null) a.p = 1 - b.p;
    else if (b.p === null) b.p = 1 - a.p;
    const alpha = a.c[3] * a.p + b.c[3] * b.p;
    if (alpha === 0) return [0, 0, 0, 0];
    const ch = i => (a.c[i] * a.c[3] * a.p + b.c[i] * b.c[3] * b.p) / alpha;
    return [ch(0), ch(1), ch(2), alpha];
  };

  // Replace each color-mix(…) in a value (balanced parentheses) with its result.
  const unmix = value => {
    let outv = '', i = 0;
    for (let at; (at = value.indexOf('color-mix(', i)) !== -1;) {
      let depth = 0, j = at + 'color-mix'.length;
      for (; j < value.length; j++) {
        if (value[j] === '(') depth++;
        else if (value[j] === ')' && --depth === 0) break;
      }
      outv += value.slice(i, at) + fmt(mix(value.slice(at + 'color-mix('.length, j)));
      i = j + 1;
    }
    return outv + value.slice(i);
  };

  let mixes = 0, dvh = 0;
  const result = minified.replace(/([{;])([\w-]+):([^;{}]*)(?=[;}])/g, (decl, lead, prop, value) => {
    const hasMix = value.includes('color-mix(');
    const hasDvh = /\ddvh\b/.test(value);
    if (!hasMix && !hasDvh) return decl;
    let fallback = value;
    if (hasMix) { fallback = unmix(fallback); mixes++; }
    if (hasDvh) { fallback = fallback.replace(/(\d)dvh\b/g, '$1vh'); dvh++; }
    return `${lead}${prop}:${fallback};${prop}:${value}`;
  });
  console.log(`Fallbacks: ${mixes} color-mix() and ${dvh} dvh declarations.`);
  return result;
}

// 4. Inline into every page in dist/.
const hash = "'sha256-" + crypto.createHash('sha256').update(css, 'utf8').digest('base64') + "'";

function htmlFilesUnder(dir) {
  const abs = path.join(dist, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap(e => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFilesUnder(rel);
    return e.name.endsWith('.html') ? [rel] : [];
  });
}

const targets = [...htmlFilesUnder('en'), ...htmlFilesUnder('es'), '404.html'];
const styleBlock = '<style id="inline-css">' + css + '</style>';

for (const rel of targets) {
  const file = path.join(dist, rel);
  const html = fs.readFileSync(file, 'utf8');
  if (!/<style id="inline-css">[\s\S]*?<\/style>/.test(html)) {
    console.error(`ERROR: ${rel} has no <style id="inline-css"></style> block to fill`);
    process.exit(1);
  }
  fs.writeFileSync(file, html.replace(/<style id="inline-css">[\s\S]*?<\/style>/, () => styleBlock));
}

// 5. Write the CSP style-src hash into dist/_headers (the source keeps a placeholder).
const headersPath = path.join(dist, '_headers');
let headers = fs.readFileSync(headersPath, 'utf8');
const styleSrc = /style-src 'self' 'sha256-[^']*'/;
if (!styleSrc.test(headers)) {
  console.error("ERROR: \"style-src 'self' 'sha256-…'\" not found in _headers");
  process.exit(1);
}
headers = headers.replace(styleSrc, `style-src 'self' ${hash}`);
fs.writeFileSync(headersPath, headers);

console.log(`Inlined ${css.length} bytes of CSS into ${targets.length} pages in ${DIST}/.`);
console.log(`CSP style-src hash → ${hash}`);
