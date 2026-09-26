// Screenshots one 3D model from tools/model3d.html.
// Usage: node tools/model-shot.js <outdir> <MODEL3D key>   ->  <outdir>/<key>.png, prints MODEL OK
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = path.resolve(process.argv[2] || 'model-out');
const key = process.argv[3] || 't64';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, 'model3d.html') + '?m=' + encodeURIComponent(key));
  await page.waitForFunction(() => window.MODEL_READY === true, null, { timeout: 60000 }).catch(() => errs.push('model3d.html did not finish'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${key.replace(/[^\w-]/g, '_')}.png` });
  await browser.close();
  if (errs.length) { console.log('ERRORS\n' + errs.join('\n')); process.exit(1); }
  console.log('MODEL OK');
})();
