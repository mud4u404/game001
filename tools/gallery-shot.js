// Renders the model gallery page and saves a full-page screenshot for review.
// Usage: node tools/gallery-shot.js <outDir>   (after npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
if (!out) { console.error('usage: node tools/gallery-shot.js <outDir>'); process.exit(2); }
require('fs').mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(__dirname, 'gallery.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/gallery.png`, fullPage: true });
  await browser.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  console.log(`saved ${out}/gallery.png`);
  process.exitCode = 0;
})().catch(e => { console.error('GALLERY-SHOT CRASHED', e); process.exit(2); });
// Guard against a hung page.
setTimeout(() => { console.error('GALLERY-SHOT TIMEOUT'); process.exit(3); }, 60 * 1000).unref();
