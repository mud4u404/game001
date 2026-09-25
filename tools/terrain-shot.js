// Renders a synthetic coast (open sea / sand / river) and asserts the sea-movement rules.
// Usage: node tools/terrain-shot.js <outDir>   (after npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2];
if (!out) { console.error('usage: node tools/terrain-shot.js <outDir>'); process.exit(2); }
require('fs').mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '../game/index.html');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto(url);
  await page.waitForTimeout(800);
  const bad = await page.evaluate(`(() => {
    SPEED = 0.01; CAMP = freshCamp(); newBattle(1);
    for (let x = 0; x < 8; x++) { for (let y = 5; y <= 7; y++) B.tiles[y][x] = { t: 'o' }; B.tiles[4][x] = { t: 's' }; }
    SCENE = 'battle'; B.phase = 'player'; show('hud');
    const problems = [];
    const t72 = moveCost(mkUnit('t72', 0, 0), 0, 5);
    if (t72 !== Infinity) problems.push('T-72 外海消耗应为 Infinity，实际 ' + t72);
    const btr = moveCost(mkUnit('btr', 0, 0), 0, 5);
    if (btr !== 2) problems.push('BTR 两栖进入外海应为 2，实际 ' + btr);
    UNITS.testboat = { name: '测试艇', team: 'ru', cls: 'la', hp: 2, move: 4, mob: 'sea' };
    const boatSea = moveCost(mkUnit('testboat', 0, 7), 0, 5);
    if (boatSea !== 1) problems.push('测试艇外海消耗应为 1，实际 ' + boatSea);
    const boatSand = moveCost(mkUnit('testboat', 0, 7), 0, 4);
    if (boatSand !== Infinity) problems.push('测试艇沙滩消耗应为 Infinity，实际 ' + boatSand);
    const vdv = moveCost(mkUnit('vdv', 0, 0), 0, 4);
    if (vdv !== 1) problems.push('步兵沙滩消耗应为 1，实际 ' + vdv);
    return problems;
  })()`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/terrain.png` });
  await browser.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  console.log('TERRAIN OK');
})().catch(e => { console.error('TERRAIN-SHOT CRASHED', e); process.exit(2); });
// Guard against a hung page.
setTimeout(() => { console.error('TERRAIN-SHOT TIMEOUT'); process.exit(3); }, 60 * 1000).unref();
