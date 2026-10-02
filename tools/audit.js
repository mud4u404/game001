// Objective audit: for every mission, checks that each objective is actually reachable with the
// tools the player can bring: the target type actually spawns often enough, some weapon can hurt
// its damage class, ammo covers the required kills, and enough civilians exist for evacuation.
// Prints one OK / TIGHT / IMPOSSIBLE line per objective. TIGHT means zero slack (exact ammo or
// exact target count) — allowed, but reviewers should confirm it is intentional.
// Usage: node tools/audit.js [mission indexes, e.g. 0,2]
const { chromium } = require('playwright');
const path = require('path');

const AUDIT = () => {
  const AMMO0 = { atgm: { jav: 2, sting: 1 }, neptune: { nep: 2 }, tb2u: { maml: 2 }, bmp2: { kon: 1 } };
  const allRu = () => Object.keys(UNITS).filter(t => UNITS[t].team === 'ru');
  const STAT2TYPE = {
    heli: ['ka52', 'mi8'],
    naval: allRu().filter(t => UNITS[t].mob === 'sea'),
    armor: allRu().filter(t => UNITS[t].armor),
    cmd: ['cmd'], orlan: ['orlan'],
  };
  const out = [];
  for (let mi = 0; mi < MISSIONS.length; mi++) {
    const M = MISSIONS[mi];
    const spawns = {};
    for (const [t] of M.enemies) spawns[t] = (spawns[t] || 0) + 1;
    for (const w of M.waves || []) for (const [t] of w.units) spawns[t] = (spawns[t] || 0) + 1;
    // what the player can field: fixed squad + one of each pool type + loan counts
    const field = {};
    for (const t of Object.keys(M.squad)) field[t] = (field[t] || 0) + 1;
    for (const t of M.pool || []) field[t] = (field[t] || 0) + 1;
    for (const t of M.loan || []) field[t] = (field[t] || 0) + 1;
    const fakeB = { stats: { killed: {}, heli: 0, naval: 0, armor: 0, cmd: 0, orlan: 0, evac: 0, escaped: 0, bldHit: 0 }, units: [], tiles: Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ({ t: '.', hp: 1, max: 1 }))) };
    const rows = [];
    for (const o of M.objectives) {
      const r = o.eval(fakeB), max = r.max, src = o.eval.toString();
      const fail = m => rows.push(['IMPOSSIBLE', o.text, m]), tight = m => rows.push(['TIGHT', o.text, m]), ok = m => rows.push(['OK', o.text, m]);
      if (r.inverse) { rows.push(['—', o.text, `防御目标（允许 ${max} 次以内）`]); continue; }
      if (/stats\.evac/.test(src)) {
        const n = M.civ && M.civ.groups ? M.civ.groups.length : (Array.isArray(M.civ) ? M.civ.length : 0);
        n >= max ? ok(`平民 ${n} 批 ≥ ${max}`) : fail(`只有 ${n} 批平民，无法撤离 ${max} 批`);
        continue;
      }
      if (/crater/.test(src) || /crater/.test(o.text)) {
        const craters = Object.entries(UNITS).filter(([t, d]) => field[t] && d.weapons && d.weapons.some(wid => WEAPONS[wid].crater));
        craters.length ? ok(`可用 crater 武器：${craters.map(([t]) => UNITS[t].short).join('、')}`) : fail('编队里没有能留弹坑的武器');
        continue;
      }
      const nm = t => UNITS[t].short || UNITS[t].name;
      let types = null, generic = false;
      const km = src.match(/killed\.([a-z0-9]+)/);
      if (km) types = [km[1]];
      else for (const [k, v] of Object.entries(STAT2TYPE)) if (src.includes('stats.' + k)) { types = v; generic = true; }
      if (!types) { rows.push(['—', o.text, '非击杀类，跳过静态检查']); continue; }
      const details = [];
      let worst = 'OK';
      // generic stat counters accept any of the types; check the pool as a whole
      const spawnSum = types.reduce((s, t) => s + (spawns[t] || 0), 0);
      const classes = [...new Set(types.map(t => UNITS[t].cls))];
      const shooters = [];
      for (const [t, n] of Object.entries(field)) for (const wid of UNITS[t].weapons || []) {
        const w = WEAPONS[wid];
        if (classes.some(c => (w.dmg[c] || 0) > 0)) shooters.push({ unit: nm(t), w, shots: w.ammo ? (AMMO0[t] && AMMO0[t][w.ammo] || 0) * n : Infinity, dmg: c => Math.max(...classes.map(c2 => w.dmg[c2] || 0)) });
      }
      if (!shooters.length) { details.push(`无武器能伤害 ${types.map(nm).join('/')}`); worst = 'IMPOSSIBLE'; }
      else {
        const limited = shooters.filter(s => s.shots !== Infinity), unlimited = shooters.filter(s => s.shots === Infinity);
        // generic counters can pick the weakest valid target; use min hp across the pool for supply checks
        const minHp = generic ? Math.min(...types.map(t => UNITS[t].hp)) : Math.max(...types.map(t => UNITS[t].hp));
        const lmg = limited.reduce((s, x) => s + x.shots * (x.dmg ? 1 : 1), 0);
        const lmin = limited.reduce((s, x) => s + x.shots, 0); // shots needed if one shot = one kill at best
        if (spawnSum < max) { details.push(`目标只出现 ${spawnSum} 个（需 ${max}）：${types.map(t => `${nm(t)}×${spawns[t] || 0}`).join(' + ')}`); worst = 'IMPOSSIBLE'; }
        else if (!unlimited.length && lmin < max) { details.push(`弹药总发数 ${lmin} < ${max}（${limited.map(s => s.unit).join('、')}）`); worst = 'IMPOSSIBLE'; }
        else if (!unlimited.length && lmin === max && spawnSum === max) { details.push(`弹药 ${lmin} 发恰好 = 目标数 ${max}，零冗余（${limited.map(s => s.unit).join('、')}）`); if (worst === 'OK') worst = 'TIGHT'; }
        else if (spawnSum === max) { details.push(`目标恰好出现 ${spawnSum} 个，一个都不能漏（${types.map(t => `${nm(t)}×${spawns[t] || 0}`).join(' + ')}）`); if (worst === 'OK') worst = 'TIGHT'; }
        else details.push(`目标 ×${spawnSum}（需 ${max}）：${types.map(t => `${nm(t)}×${spawns[t] || 0}`).join(' + ')}；火力：${shooters.map(s => s.unit + (s.shots !== Infinity ? `×${s.shots}发` : '')).join('、')}`);
      }
      const mi8note = types.includes('mi8') ? '；注意米-8 落地放兵后即离场，只在其落地后的 1 个玩家回合内可攻击' : '';
      rows.push([worst, o.text, details.join('；') + mi8note]);
    }
    out.push({ mi, code: M.code, name: M.name, rows });
  }
  return out;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '../game/index.html') + '?2d');
  await page.waitForTimeout(1200);
  const list = process.argv[2] ? process.argv[2].split(',').map(Number) : await page.evaluate(() => MISSIONS.map((m, i) => i));
  await page.evaluate(`window.__AUDIT = ${AUDIT.toString()}`);
  const res = await page.evaluate(list => list.map(mi => window.__AUDIT()[mi]), list);
  for (const m of res) {
    console.log(`\n${m.code} ${m.name}`);
    for (const [verdict, text, why] of m.rows) console.log(`  [${verdict}] ${text}\n        ${why}`);
  }
  console.log('\nERRORS', errs.length ? errs.join('\n') : 'none');
  await browser.close();
})();
