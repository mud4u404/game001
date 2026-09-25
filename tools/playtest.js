// Automated playtest: drives the whole campaign with a simple bot, collects errors and screenshots.
// Usage: node tools/playtest.js [outDir]   (after npm install && npx playwright install chromium)
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || 'playtest-out';
require('fs').mkdirSync(out, { recursive: true });
const url = 'file://' + path.resolve(__dirname, '../game/index.html');

const BOT = async () => {
  const S = window.__sf, B = S.B;
  const val = (u, wid, t) => {
    let v = 0;
    for (const e of S.weaponEffects(u, wid, t)) {
      const o = S.unitAt(e.x, e.y), tile = B.tiles[e.y][e.x];
      if (e.w) {
        if (o) { const d = dmgAgainst(e.w, e.x, e.y); v += o.team === 'ru' ? d * 10 + (d >= o.hp ? 25 : 0) : -40; }
        else if (bldAlive(tile) && BLD[tile.t].civil) v -= 20;
        if (tile.t === 'R' && !tile.crater && WEAPONS[e.w].crater) v += 14;
      }
      if (e.push && o && o.team === 'ru') { const nx = o.x + e.push[0], ny = o.y + e.push[1]; if (inB(nx, ny) && B.tiles[ny][nx].t === 'w' && !UNITS[o.type].amph && UNITS[o.type].cls !== 'air') v += 40; }
    }
    return v;
  };
  for (const u of S.B.units.filter(u => u.team === 'ua' && !u.dead)) {
    if (S.B.phase !== 'player') return;
    let best = null;
    const map = S.reach(u), ox = u.x, oy = u.y;
    for (const p of map.values()) {
      u.x = p.x; u.y = p.y;
      for (const wid of UNITS[u.type].weapons) for (const t of S.weaponTargets(u, wid)) {
        const v = val(u, wid, t) + (S.threats().some(a => a.x === p.x && a.y === p.y) ? -8 : 0);
        if (!best || v > best.v) best = { v, x: p.x, y: p.y, wid, t };
      }
    }
    u.x = ox; u.y = oy;
    if (!best || best.v <= 0) continue;
    if (best.x !== u.x || best.y !== u.y) await S.playerMove(u, best.x, best.y);
    const t = S.weaponTargets(u, best.wid).find(q => q.x === best.t.x && q.y === best.t.y);
    if (t) await S.playerFire(u, best.wid, t);
  }
  if (S.B.phase === 'player' && S.B.tb2Left > 0) {
    const e = S.B.units.find(o => o.team === 'ru' && !o.dead && UNITS[o.type].cls !== 'air');
    if (e) await S.supportStrike({ x: e.x, y: e.y });
  }
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/01-title.png` });
  await page.evaluate(() => window.__sf.setSpeed(0.01));
  await page.click('#btnNew'); await page.waitForTimeout(600);
  await page.evaluate(() => window.__sf.setSpeed(1));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/02-campaign.png` });
  const log = [];
  const missionCount = await page.evaluate(() => MISSIONS.length);
  for (let m = 0; m < missionCount; m++) {
    await page.evaluate(() => { const C = window.__sf.CAMP; C.aid = Math.max(C.aid, 10); C.roster.forEach(r => { r.wrecked = false; }); });
    await page.click('#btnBrief'); await page.waitForTimeout(1600);
    if (m === 0) await page.screenshot({ path: `${out}/03-dialog.png` });
    await page.click('#btnSkip'); await page.waitForTimeout(300);
    if (m === 0) await page.screenshot({ path: `${out}/04-card.png` });
    await page.click('#btnDeploy'); await page.waitForTimeout(700);
    if (m === 0) await page.screenshot({ path: `${out}/05-deploy.png` });
    await page.evaluate(() => window.__sf.setSpeed(0.01));
    await page.click('#btnStart'); await page.waitForTimeout(800);
    await page.evaluate(() => window.__sf.setSpeed(1));
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${out}/1${m}-battle-start.png` });
    // select first unit and arm its weapon for a hover preview shot
    await page.evaluate(() => { const S = window.__sf; const u = S.B.units.find(v => v.team === 'ua'); selectUnit(u); mode = 'target'; renderHud(); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/1${m}-selected.png` });
    let turns = 0;
    while (await page.evaluate(() => window.__sf.SCENE) === 'battle' && turns < 8) {
      await page.evaluate(() => { sel = null; mode = null; });
      if (turns === 0) {
        // capture an attack animation mid-flight at normal speed
        const p = page.evaluate(BOT);
        for (let k = 0; k < 4; k++) { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/1${m}-anim${k}.png` }); }
        await p;
      } else {
        await page.evaluate(() => window.__sf.setSpeed(0.01));
        await page.evaluate(BOT);
      }
      await page.evaluate(() => window.__sf.setSpeed(0.01));
      await page.evaluate(() => window.__sf.enemyPhase());
      for (let k = 0; k < 40 && await page.evaluate(() => window.__sf.isBusy() && window.__sf.SCENE === 'battle'); k++) await page.waitForTimeout(100);
      await page.evaluate(() => window.__sf.setSpeed(1));
      turns++;
      if (turns === 2) { await page.waitForTimeout(500); await page.screenshot({ path: `${out}/1${m}-turn3.png` }); }
    }
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ scene: window.__sf.SCENE, stats: window.__sf.B.stats, aid: window.__sf.CAMP.aid, turn: window.__sf.B.turn }));
    log.push(st);
    await page.screenshot({ path: `${out}/2${m}-debrief.png` });
    if (st.scene === 'campaign' && await page.isVisible('#gameover')) { log.push('GAME OVER'); break; }
    await page.evaluate(() => { const b = document.querySelector('#shop .up:not([disabled])'); if (b) b.click(); });
    // chapter transitions play story cards; fast-forward them and wait for the map
    await page.evaluate(() => window.__sf.setSpeed(0.01));
    await page.click('#btnNext');
    for (let k = 0; k < 100 && !(await page.evaluate("window.__sf.SCENE === 'campaign' && !document.getElementById('campaign').hidden")); k++) await page.waitForTimeout(100);
    await page.evaluate(() => window.__sf.setSpeed(1));
    if (m < missionCount - 1) await page.screenshot({ path: `${out}/3${m}-campaign.png` });
  }
  await page.evaluate(() => window.__sf.setSpeed(0.01)); await page.waitForTimeout(800);
  console.log(JSON.stringify(log, null, 1));
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await browser.close();
  process.exitCode = errs.length ? 1 : 0;
})().catch(e => { console.error('PLAYTEST CRASHED', e); process.exit(2); });
// Guard against a stuck battle loop.
setTimeout(() => { console.error('PLAYTEST TIMEOUT'); process.exit(3); }, 8 * 60 * 1000).unref();
