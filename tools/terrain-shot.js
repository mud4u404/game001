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
  const bad = await page.evaluate(`(async () => {
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
    // naval rules: neptune locks sea targets only, seaRam rams and self-destructs
    const nep = mkUnit('neptune', 3, 3); B.units.push(nep);
    const rap = mkUnit('raptor', 3, 7); B.units.push(rap);
    const tank = mkUnit('t72', 5, 3); B.units.push(tank);
    const nt = weaponTargets(nep, 'neptune');
    if (!nt.some(p => p.x === 3 && p.y === 7)) problems.push('海王星应能锁定 (3,7) 的猛禽艇');
    if (nt.some(p => p.x === 5 && p.y === 3)) problems.push('海王星不应锁定 (5,3) 的地面目标');
    if (nep.ammo.nep !== 2) problems.push('海王星弹药应为 2，实际 ' + nep.ammo.nep);
    const mg = mkUnit('magura', 3, 6); B.units.push(mg);
    await playerFire(mg, 'seaRam', weaponTargets(mg, 'seaRam').find(p => p.x === 3 && p.y === 7));
    if (!rap.dead) problems.push('猛禽艇应被撞击摧毁');
    if (!mg.dead) problems.push('无人艇撞击后应自毁');
    if (B.stats.kills !== 1) problems.push('击杀数应为 1，实际 ' + B.stats.kills);
    // squad-driven roster: swap in the chapter-2 sea squad and rebuild the battle
    window.__origSquad = MISSIONS[1].squad;
    MISSIONS[1].squad = { magura: [2, 6], neptune: [3, 3], atgm: [4, 3] };
    newBattle(1);
    for (let x = 0; x < 8; x++) { for (let y = 5; y <= 7; y++) B.tiles[y][x] = { t: 'o' }; B.tiles[4][x] = { t: 's' }; }
    SCENE = 'battle'; B.phase = 'player'; show('hud');
    selectUnit(B.units.find(u => u.type === 'magura')); renderHud();
    const chips = document.querySelectorAll('#roster .rchip').length;
    if (chips !== 3) problems.push('名单应为 3 项，实际 ' + chips);
    const rosterText = document.getElementById('roster').innerText;
    for (const name of ['无人艇', '海王星', '标枪/毒刺']) if (!rosterText.includes(name)) problems.push('名单缺少 ' + name);
    return problems;
  })()`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/terrain.png` });
  await page.screenshot({ path: `${out}/squad.png` });
  await page.evaluate('MISSIONS[1].squad = window.__origSquad');
  await browser.close();
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  console.log('TERRAIN OK');
  console.log('NAVAL OK');
  console.log('SQUAD OK');
})().catch(e => { console.error('TERRAIN-SHOT CRASHED', e); process.exit(2); });
// Guard against a hung page.
setTimeout(() => { console.error('TERRAIN-SHOT TIMEOUT'); process.exit(3); }, 60 * 1000).unref();
