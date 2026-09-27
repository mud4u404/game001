// Balance check: plays each mission many times with the playtest bot and with an idle player,
// and prints how often the primary objective is met, how many units are lost and which bonus
// objectives are reached. Usage: node tools/balance.js [runs per mission, default 8] [mission indexes, e.g. 0,1,2]
// Balance targets for chapter one are in docs/tasks (see the balance card); the bot is a greedy one-move
// player, so a careful human does better than it.
const { chromium } = require('playwright');
const path = require('path');
const RUNS = +(process.argv[2] || 8);

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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../game/index.html') + '?2d');
  await page.waitForTimeout(1200);
  await page.evaluate(`window.BOTF = ${BOT.toString()}`);
  const list = process.argv[3] ? process.argv[3].split(',').map(Number) : await page.evaluate(() => MISSIONS.map((m, i) => i));
  for (const mi of list) for (const pol of ['bot', 'idle']) {
    const runs = [];
    for (let r = 0; r < RUNS; r++) runs.push(await page.evaluate(async ([mi, pol]) => {
      SPEED = 0.0005;
      // a fresh campaign, with the unit a mission grants on the way (so every pool unit exists once)
      CAMP = freshCamp();
      const M = MISSIONS[mi];
      for (const t of M.pool) if (!CAMP.roster.some(r => r.type === t)) CAMP.roster.push({ rid: CAMP.nextRid++, type: t, wrecked: false, xp: 0 });
      const picks = CAMP.roster.filter(r => M.pool.includes(r.type)).slice(0, M.slots);
      newBattle(mi, picks); SCENE = 'battle'; lastResult = null;
      await startBattle();
      for (let k = 0; B.phase !== 'end' && k < 12; k++) {
        if (pol === 'bot') await BOTF();
        await enemyPhase();
      }
      await new Promise(r => setTimeout(r, 30));
      const R = lastResult;
      return { win: !!(R && R.win), wiped: R && R.reason === 'wiped', turn: B.turn, lost: picks.length - ua().length, dmg: B.stats.dmgTaken,
        objs: R ? R.objectives.map(o => o.done) : [], names: M.objectives.map(o => o.text) };
    }, [mi, pol]));
    const n = runs.length, pct = k => Math.round(100 * k / n) + '%', avg = f => (runs.reduce((s, r) => s + f(r), 0) / n).toFixed(1);
    const code = await page.evaluate(mi => MISSIONS[mi].code + ' ' + MISSIONS[mi].name, mi);
    console.log(`${code} [${pol}] 主要目标达成 ${pct(runs.filter(r => r.win).length)} · 全灭 ${pct(runs.filter(r => r.wiped).length)} · 平均损失单位 ${avg(r => r.lost)} · 平均受到伤害 ${avg(r => r.dmg)} · 平均结束回合 ${avg(r => r.turn)}`);
    runs[0].names.forEach((t, i) => console.log(`    ${pct(runs.filter(r => r.objs[i]).length)}  ${t}`));
  }
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();
