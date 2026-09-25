// Renders the campaign map for both chapters and asserts the chapter title/list.
// Usage: node tools/campaign-shot.js <outDir>   (after npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
if (!out) { console.error('usage: node tools/campaign-shot.js <outDir>'); process.exit(2); }
require('fs').mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '../game/index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto(url);
  await page.waitForTimeout(800);
  await page.evaluate('SPEED = 0.01; CAMP = freshCamp(); showCampaign();');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/kyiv.png` });
  const bad = await page.evaluate(`(() => {
    MISSIONS.push(Object.assign({}, MISSIONS[0], { id: 'test2', code: '2-1', name: '测试任务', chapter: 1, mapPos: [0.56, 0.54] }));
    CAMP.mission = MISSIONS.length - 1;
    showCampaign();
    const problems = [];
    if (document.getElementById('cTitle').textContent !== '战区二 · 黑海') problems.push('cTitle 应为 战区二 · 黑海，实际 ' + document.getElementById('cTitle').textContent);
    if (document.querySelectorAll('#cList .mrow').length !== 1) problems.push('cList 应只有 1 行任务');
    return problems;
  })()`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/odesa.png` });
  await browser.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  console.log('CAMPAIGN OK');
})().catch(e => { console.error('CAMPAIGN-SHOT CRASHED', e); process.exit(2); });
// Guard against a hung page.
setTimeout(() => { console.error('CAMPAIGN-SHOT TIMEOUT'); process.exit(3); }, 60 * 1000).unref();
