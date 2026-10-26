/* audit-sizes.js — measure every responsive image in a real browser and check
   its `sizes` against the width the image is actually drawn at.

   Usage:  npm run build && npm run audit-sizes

   The `sizes` values come from the layout table in data/images.js, which
   restates the CSS as formulas. Nothing ties the two together except this
   audit: it loads every built page in a local headless Chrome/Edge (see
   browser.js), sweeps the viewport from 320px to 2560px — every 8px, plus both
   sides of every breakpoint in the CSS and in the table — and at each width
   compares, for every <picture>, the width its `sizes` resolves to with the
   width its image content occupies (the box, adjusted for object-fit). Run it
   after changing a padding, gap, column split or breakpoint the images sit in.

   Errors (exit 1): a `sizes` smaller than the drawn image anywhere — the
   browser would pick a file too small for the box. Warnings: a srcset whose
   largest candidate can't fill the box on a 2x screen although the master
   image could. Overestimates are reported, not failed: where a box's height
   follows the content (the hub rows), only its width is known.

   Images load normally: most boxes are sized by the CSS alone, but the hero's
   width follows the photo's own aspect at some widths, so a blocked image
   would measure a box that never exists. */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { PAGES, LOCALES, DIST, fileFor } from './site.js';
import { IMAGE_LAYOUTS, imageSize } from './images.js';
import { serveDist } from './serve-dist.js';
import { findBrowser } from './browser.js';

const root = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), DIST);
if (!fs.existsSync(root)) {
  console.error(`ERROR: ${DIST}/ not found — run npm run build first`);
  process.exit(1);
}

const MIN_WIDTH = 320, MAX_WIDTH = 2560, STEP = 8;
const TIMEOUT = 30000;

// Both sides of every breakpoint: the CSS's own (read from the inlined
// stylesheet) and the table's (some, like a grid gaining a column, aren't
// media queries at all).
const css = (fs.readFileSync(path.join(root, fileFor(PAGES[0].en)), 'utf8').match(/<style id="inline-css">([\s\S]*?)<\/style>/) || [])[1] || '';
const breakpoints = [
  ...[...css.matchAll(/\((?:max|min)-width:\s*([\d.]+)px\)/g)].map(m => Number(m[1])),
  ...Object.values(IMAGE_LAYOUTS).flatMap(layout => layout.ranges.map(range => range.max).filter(Boolean)),
];
const widths = new Set();
for (let w = MIN_WIDTH; w <= MAX_WIDTH; w += STEP) widths.add(w);
for (const b of breakpoints) for (const w of [Math.floor(b) - 1, Math.floor(b), Math.floor(b) + 1, Math.ceil(b) + 1]) widths.add(w);
const WIDTHS = [...widths].filter(w => w >= MIN_WIDTH && w <= MAX_WIDTH).sort((a, b) => a - b);

/** A minimal Chrome DevTools Protocol client: one page target, every call bounded by TIMEOUT. */
async function connect(port) {
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const call = pending.get(msg.id);
    if (!call) return;
    pending.delete(msg.id);
    clearTimeout(call.timer);
    msg.error ? call.reject(new Error(`${call.method}: ${msg.error.message}`)) : call.resolve(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, TIMEOUT);
    pending.set(id, { method, resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}

// Runs in the page: every <picture> whose srcset has a `sizes`, its box, its
// object-fit, and the width that `sizes` resolves to at this viewport — the
// first entry whose media condition matches, its length measured on a probe.
const MEASURE = `(async () => {
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:0;top:0;height:0;visibility:hidden';
  document.body.append(probe);
  const resolve = sizes => {
    for (const entry of sizes.split(/,(?![^(]*\\))/).map(s => s.trim())) {
      const [, condition, length] = /^(.*?)\\s*(calc\\(.*\\)|[^\\s]+)$/.exec(entry);
      if (condition && !matchMedia(condition).matches) continue;
      probe.style.width = length;
      return probe.getBoundingClientRect().width;
    }
  };
  const out = [...document.querySelectorAll('picture')].flatMap(picture => {
    const source = picture.querySelector('source[sizes], img[sizes]');
    if (!source) return [];
    const img = picture.querySelector('img');
    const box = img.getBoundingClientRect();
    return [{ box: [box.width, box.height], fit: getComputedStyle(img).objectFit, resolved: resolve(source.getAttribute('sizes')) }];
  });
  probe.remove();
  return out;
})()`;

// Runs in the page once: what each measured <picture> shows, for the report
// and for the image's aspect (its widest candidate is the image at full size).
const DESCRIBE = `[...document.querySelectorAll('picture')].flatMap(picture => {
  const source = picture.querySelector('source[sizes], img[sizes]');
  if (!source) return [];
  const candidates = source.getAttribute('srcset').trim().split(/\\s*,\\s*/).map(c => c.split(/\\s+/));
  const widest = candidates.sort((a, b) => parseInt(b[1], 10) - parseInt(a[1], 10))[0];
  return [{ widest: new URL(widest[0], location.href).pathname, master: new URL(picture.querySelector('img').getAttribute('src'), location.href).pathname }];
})`;

const server = serveDist(root);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-sizes-'));
const chrome = spawn(findBrowser(), [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank',
], { stdio: 'ignore' });

const errors = [], warnings = [], report = [];
let cdp;
try {
  // With port 0, Chrome picks a free port and writes it to DevToolsActivePort.
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; !fs.existsSync(portFile) || !fs.readFileSync(portFile, 'utf8').trim(); i++) {
    if (i > 300) throw new Error('the browser did not start');
    await new Promise(r => setTimeout(r, 100));
  }
  cdp = await connect(Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]));

  for (const page of PAGES) for (const locale of LOCALES) {
    const url = page[locale];
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: base + url });
    // The previous page can still answer "complete" until the new one commits.
    const loaded = `location.pathname === ${JSON.stringify(url)} && document.readyState === 'complete'`;
    for (let i = 0; !(await cdp.evaluate(loaded)); i++) {
      if (i > 300) throw new Error(`${url} did not finish loading`);
      await new Promise(r => setTimeout(r, 100));
    }
    const pictures = await cdp.evaluate(DESCRIBE);
    if (!pictures.length) continue;
    // Steady-state layout only: cards animate their padding (transition: all)
    // after a breakpoint, and the sweep would catch them mid-transition. And
    // every slide laid out: a slider's hidden slides are display:none until it
    // starts, and the ones far down the page haven't.
    await cdp.evaluate(`document.head.append(Object.assign(document.createElement('style'), { textContent: '*,*::before,*::after{transition:none!important;animation:none!important}[data-slide]{display:block!important}' }))`);

    const facts = pictures.map(({ widest, master }) => {
      const full = imageSize(path.join(root, widest));
      return { name: path.posix.basename(master), widest: full.width, aspect: full.width / full.height, master: imageSize(path.join(root, master)).width, worst: Infinity, worstAt: 0, over: 0, maxNeed: 0 };
    });
    for (const width of WIDTHS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      const measured = await cdp.evaluate(MEASURE);
      measured.forEach(({ box: [w, h], fit, resolved }, i) => {
        const fact = facts[i];
        // The width the image's content is drawn at, inside its box.
        const need = fit === 'contain' ? Math.min(w, h * fact.aspect) : fit === 'cover' ? Math.max(w, h * fact.aspect) : w;
        if (!need) return;
        fact.maxNeed = Math.max(fact.maxNeed, need);
        const ratio = resolved / need;
        if (ratio < fact.worst) { fact.worst = ratio; fact.worstAt = width; fact.worstS = resolved; fact.worstNeed = need; }
        if (ratio > fact.over) { fact.over = ratio; fact.overAt = width; }
      });
    }
    for (const fact of facts) {
      const where = `${fileFor(url)} ${fact.name}`;
      if (!fact.maxNeed) {
        errors.push(`${where}: never laid out at any width, so it wasn't measured`);
        continue;
      }
      // Half a pixel of slack for subpixel layout.
      if (fact.worstNeed - fact.worstS > 0.5) {
        errors.push(`${where}: at a ${fact.worstAt}px viewport sizes resolves to ${fact.worstS.toFixed(1)}px, but the image is drawn ${fact.worstNeed.toFixed(1)}px wide`);
      }
      const wanted = Math.min(fact.master, 2 * fact.maxNeed);
      if (fact.widest < 0.98 * wanted) {
        warnings.push(`${where}: a 2x screen draws it up to ${Math.round(2 * fact.maxNeed)}px wide, the largest candidate is ${fact.widest}px and the master ${fact.master}px — add a larger rung`);
      }
      report.push({ where, worst: fact.worst, worstAt: fact.worstAt, over: fact.over, overAt: fact.overAt });
    }
    console.log(`${fileFor(url)}: ${facts.length} pictures x ${WIDTHS.length} widths`);
  }
} finally {
  cdp?.close();
  chrome.kill();
  server.close();
  // Chrome may hold the profile for a moment after it's killed.
  await new Promise(r => setTimeout(r, 500));
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const worst = report.reduce((a, b) => (b.worst < a.worst ? b : a));
const over = report.reduce((a, b) => (b.over > a.over ? b : a));
for (const w of warnings) console.warn(`warn   ${w}`);
for (const e of errors) console.error(`ERROR  ${e}`);
const summary = `${report.length} pictures: sizes ÷ drawn width ranges ${worst.worst.toFixed(3)} (${worst.where} @${worst.worstAt}px)`
  + ` – ${over.over.toFixed(2)} (${over.where} @${over.overAt}px)`;
if (errors.length) {
  console.error(`\naudit-sizes: ${errors.length} picture(s) unmeasured or whose sizes undershoots — ${summary}.`);
  process.exit(1);
}
console.log(`\naudit-sizes: OK — ${summary}${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
