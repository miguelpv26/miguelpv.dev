/* og-cards.js — render the 1200×630 social cards in assets/img/og/.

   Usage:  npm run og-cards                  # every card
           npm run og-cards -- biglo-en …    # just these (<card.name>-<locale>)

   The copy for each card lives with its page in data/site.js (`card`), so
   the image and its alt text (which build-html.js derives from the same copy)
   can't disagree. Each card is templates/og-card.html filled with that copy and
   screenshotted by a local headless Chrome or Edge. A tiny server on a random
   local port serves the template and the site's own subset fonts, so the cards
   are set in exactly the JetBrains Mono the site ships. Set BROWSER_PATH if
   your Chrome/Edge isn't in a standard location.

   Not part of `npm run build`: cards only change when their copy does.

   Card copy rules: titles in the page's own words; a subtitle that fits two
   lines; a pill only for a figure that won't go stale. The subset font has no
   arrow or "≈" glyphs — write "->" (the pill renders it as an arrow ligature)
   and "~". `chips` are |-separated; `size` overrides the 88px title (the template's
   header comment gives the most a title of a given length can take). */
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { PAGES, LOCALES, CARD_FOOTER } from './site.js';
import { findBrowser } from './browser.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets/img/og');

// <card.name>-<locale> → the template's parameters.
const CARDS = Object.fromEntries(
  PAGES.filter(page => page.card).flatMap(page =>
    LOCALES.map(locale => [`${page.card.name}-${locale}`, { ...page.card[locale], footer: CARD_FOOTER[locale] }])
  )
);

const requested = process.argv.slice(2);
const unknown = requested.filter(name => !(name in CARDS));
if (unknown.length) {
  console.error(`ERROR: no card named ${unknown.join(', ')}`);
  process.exit(1);
}
const names = requested.length ? requested : Object.keys(CARDS);

// Serve only what the card needs: the template and the font files.
const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const file = pathname === '/card' ? path.join(root, 'templates/og-card.html')
    : /^\/assets\/fonts\/[\w.-]+\.woff2$/.test(pathname) ? path.join(root, pathname)
    : null;
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'font/woff2' });
  fs.createReadStream(file).pipe(res);
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const browser = findBrowser();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'og-cards-'));
  fs.mkdirSync(outDir, { recursive: true });
  let failed = 0;

  for (const name of names) {
    const query = new URLSearchParams(Object.entries(CARDS[name]).map(([k, v]) => [k, String(v)]));
    const file = path.join(outDir, `${name}.png`);
    // Async on purpose: this same process serves the page the browser loads.
    const status = await new Promise(resolve => {
      const child = spawn(browser, [
        '--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`,
        '--window-size=1200,630', '--force-device-scale-factor=1', `--screenshot=${file}`,
        '--virtual-time-budget=3000', `http://127.0.0.1:${port}/card?${query}`,
      ], { stdio: 'ignore' });
      const timer = setTimeout(() => child.kill(), 30000);
      child.on('exit', code => { clearTimeout(timer); resolve(code); });
      child.on('error', () => { clearTimeout(timer); resolve(1); });
    });
    const ok = status === 0 && fs.existsSync(file);
    if (!ok) failed++;
    console.log(ok ? `${name}.png  ${Math.round(fs.statSync(file).size / 1024)} KB` : `${name}.png  FAILED`);
  }

  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
});
