// 3D smoke test: loads every mission with the three.js renderer, screenshots the deploy phase and the
// first player turn, and fails on any page error. Prints SHOT3D OK when everything rendered.
// Usage: node tools/shot3d.js <outdir> [missionIndex]
// Software WebGL is slow in headless Chromium (about a second per frame), so this only waits a few frames.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = path.resolve(process.argv[2] || 'shot3d-out');
const only = process.argv[3] == null ? null : +process.argv[3];
const url = 'file://' + path.resolve(__dirname, '../game/index.html');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(3000);
  if (!await page.evaluate(() => V3.on)) { console.log('SHOT3D FAILED: WebGL renderer did not start'); await browser.close(); process.exit(1); }
  await page.screenshot({ path: `${out}/title.png` });
  const count = await page.evaluate(() => MISSIONS.length);
  for (let m = 0; m < count; m++) {
    if (only != null && m !== only) continue;
    await page.evaluate(mi => {
      SPEED = 0.01; CAMP = freshCamp(); CAMP.mission = mi; CAMP.aid = 40;
      for (const t of MISSIONS[mi].pool) if (!CAMP.roster.some(r => r.type === t)) CAMP.roster.push({ rid: CAMP.nextRid++, type: t, wrecked: false, xp: 0 });
      showBriefing(); showMissionCard();
      picked = CAMP.roster.filter(r => MISSIONS[mi].pool.includes(r.type)).slice(0, MISSIONS[mi].slots);
      renderPick();
    }, m);
    await page.click('#btnDeploy'); await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/m${m}-deploy.png` });
    await page.click('#btnStart'); await page.waitForTimeout(5000);
    await page.screenshot({ path: `${out}/m${m}-turn1.png` });
  }
  await browser.close();
  if (errs.length) { console.log('ERRORS\n' + errs.join('\n')); process.exit(1); }
  console.log('SHOT3D OK');
})();
