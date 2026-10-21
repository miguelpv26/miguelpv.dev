/* browser.js — find a local Chrome or Edge for the scripts that drive one
   headless (og-cards.js, audit-sizes.js). BROWSER_PATH overrides discovery. */
import fs from 'fs';

export function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  const found = candidates.find(p => p && fs.existsSync(p));
  if (!found) {
    console.error('ERROR: no Chrome/Edge found — set BROWSER_PATH');
    process.exit(1);
  }
  return found;
}
