'use strict';
// ---------- battle state & rules ----------
let B = null;       // current battle
let CAMP = null;    // campaign progress (aid, upgrades, flags)

const inB = (x, y) => x >= 0 && y >= 0 && x < 8 && y < 8;
const TILEAT = (x, y) => B.tiles[y][x];
const bldAlive = t => !!BLD[t.t] && t.hp > 0;
const isWater = t => t.t === 'w' || t.t === 'o';
const unitAt = (x, y) => B.units.find(u => u.x === x && u.y === y && !u.dead);
const U = u => UNITS[u.type];
const isAir = u => U(u).cls === 'air';
const isVehicle = u => ['ha', 'la', 'soft'].includes(U(u).cls);
const ua = () => B.units.filter(u => u.team === 'ua' && !u.dead);
const ru = () => B.units.filter(u => u.team === 'ru' && !u.dead);

function mkUnit(type, x, y, xp = 0) {
  const d = UNITS[type], M = B.mission;
  const u = {
    id: B.nextId++, type, team: d.team, x, y, hp: d.hp, max: d.hp, moved: false, acted: false,
    face: (M.face && M.face[d.team]) || (d.team === 'ua' ? [1, 0] : [-1, 0]), aim: null, ammo: {}, prev: null,
    rx: x, ry: y, rz: 0, recoil: 0, flash: 0, alpha: 1, dead: false,
  };
  if (type === 't64') { u.hp = u.max = d.hp + CAMP.up.t64hp; }
  if (type === 'atgm') { u.ammo.jav = 2 + CAMP.up.jav; u.ammo.sting = 1 + CAMP.up.sting; }
  if (type === 'neptune') u.ammo.nep = 2;
  if (type === 'bmp2') { u.ammo.kon = 1; }
  u.xp = xp;
  const rank = rankOf(xp);
  if (rank.hp) { u.hp += rank.hp; u.max += rank.hp; }
  if (rank.move) u.move = d.move + rank.move;
  return u;
}
function defaultPicks(M) {
  const picks = [];
  for (const type of Object.keys(M.squad)) {
    const rec = CAMP.roster.find(r => r.type === type && !r.wrecked && M.pool.includes(r.type));
    if (rec && !picks.includes(rec)) picks.push(rec);
  }
  return picks;
}
function deploySpot(u, M) {
  for (const [x, y] of M.deploy) {
    if (unitAt(x, y) || moveCost(u, x, y) === Infinity) continue;
    return { x, y };
  }
  const [x, y] = M.deploy[0];
  return { x, y };
}
function newBattle(mi, picks) {
  const M = MISSIONS[mi];
  if (!picks) picks = defaultPicks(M);
  B = {
    mission: M, mi, squad: picks.slice(), turn: 1, maxTurn: M.turns, phase: 'deploy', tiles: [], units: [], marks: [], barrage: [],
    stats: { kills: 0, heli: 0, orlan: 0, naval: 0, armor: 0, cmd: 0, escaped: 0, evac: 0, civLost: 0, bldHit: 0, dmgTaken: 0 },
    nextId: 1, resetLeft: 1, tb2Left: 1 + CAMP.up.tb2, decals: [], debris: [], civNext: 0, snap: null, said: {}, deadRids: [],
  };
  for (let y = 0; y < 8; y++) {
    const row = [];
    for (let x = 0; x < 8; x++) { const t = M.map[y][x]; row.push(BLD[t] ? { t, hp: BLD[t].hp, max: BLD[t].hp } : { t }); }
    B.tiles.push(row);
  }
  const seenTypes = {};
  for (const rec of picks) {
    const u = mkUnit(rec.type, 0, 0, rec.xp || 0);
    let pos = null;
    if (M.squad[rec.type] && !seenTypes[rec.type]) pos = { x: M.squad[rec.type][0], y: M.squad[rec.type][1] };
    if (!pos || unitAt(pos.x, pos.y)) pos = deploySpot(u, M);
    u.x = pos.x; u.y = pos.y;
    u.rx = u.x; u.ry = u.y;
    seenTypes[rec.type] = true;
    u.rid = rec.rid;
    B.units.push(u);
  }
  for (const [type, x, y] of M.enemies) B.units.push(mkUnit(type, x, y));
  B.waves = M.waves.map(w => ({ turn: w.turn, units: w.units.slice() }));
  if (M.extraWaves) for (const [flag, ws] of Object.entries(M.extraWaves)) if (CAMP.flags[flag]) for (const w of ws) B.waves.push({ turn: w.turn, units: w.units.slice() });
  return B;
}
const spotRange = () => 3 + (CAMP.up.spot ? 2 : 0);

// ---------- movement ----------
function moveCost(u, x, y) {
  const t = TILEAT(x, y), d = U(u);
  if (bldAlive(t)) return Infinity;
  if (d.mob === 'air') return 1;
  if (d.mob === 'sea') return isWater(t) ? 1 : Infinity;
  if (t.wreck) return Infinity;
  if (d.mob === 'foot') return isWater(t) ? Infinity : 1;
  if (t.t === 'f' || t.t === 'd') return Infinity;
  if (isWater(t)) return d.amph ? 2 : Infinity;
  if (t.t === 'r' || t.t === 'R') return t.crater ? 2 : 1;
  return 2;
}
function reach(u, budget) {
  const mp = budget == null ? (u.move || U(u).move) : budget;
  const best = new Map([[u.x + ',' + u.y, { x: u.x, y: u.y, c: 0, prev: null }]]);
  const open = [{ x: u.x, y: u.y, c: 0 }];
  while (open.length) {
    open.sort((a, b) => a.c - b.c);
    const cur = open.shift();
    for (const [dx, dy] of DIRS) {
      const x = cur.x + dx, y = cur.y + dy;
      if (!inB(x, y)) continue;
      const c = cur.c + moveCost(u, x, y);
      if (c > mp) continue;
      const o = unitAt(x, y);
      if (o && o !== u && !isAir(u) && o.team !== u.team) continue;
      const k = x + ',' + y, prev = best.get(k);
      if (prev && prev.c <= c) continue;
      best.set(k, { x, y, c, prev: cur.x + ',' + cur.y });
      open.push({ x, y, c });
    }
  }
  // cannot end on an occupied tile
  for (const [k, v] of best) { const o = unitAt(v.x, v.y); if (o && o !== u) best.delete(k); }
  return best;
}
function pathFrom(map, x, y) {
  const out = []; let k = x + ',' + y;
  while (k) { const n = map.get(k); if (!n) break; out.unshift([n.x, n.y]); k = n.prev; }
  return out;
}

// ---------- targeting ----------
function lineHit(x0, y0, dir, w, shooter) {
  for (let k = 1; k <= w.range; k++) {
    const x = x0 + dir[0] * k, y = y0 + dir[1] * k;
    if (!inB(x, y)) return null;
    const t = TILEAT(x, y), o = unitAt(x, y);
    if (o && o !== shooter && (!isAir(o) || w.hitsAir)) return { x, y };
    if (bldAlive(t) || t.wreck) return { x, y };
    if (t.t === 'f' && !w.overForest) return { x, y };
  }
  return null;
}
function weaponTargets(u, wid) {
  const w = WEAPONS[wid], out = [];
  if (w.ammo && !(u.ammo[w.ammo] > 0)) return out;
  if (w.kind === 'line') for (const dir of DIRS) {
    for (let k = 1; k <= w.range; k++) {
      const x = u.x + dir[0] * k, y = u.y + dir[1] * k;
      if (!inB(x, y)) break;
      out.push({ x, y, dir });
      const h = lineHit(u.x, u.y, dir, w, u);
      if (h && h.x === x && h.y === y) break;
    }
  }
  else if (w.kind === 'lock') for (const o of B.units) { if (o.dead || o === u || !isVehicle(o)) continue; const d = dist(u, o); if (d >= w.min && d <= w.range) out.push({ x: o.x, y: o.y }); }
  else if (w.kind === 'aa') for (const o of B.units) { if (o.dead || !isAir(o)) continue; const d = dist(u, o); if (d >= w.min && d <= w.range) out.push({ x: o.x, y: o.y }); }
  else if (w.kind === 'arc') for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const d = Math.abs(x - u.x) + Math.abs(y - u.y);
    if (d < w.min || d > w.range) continue;
    if (!spotted(x, y, u)) continue;
    out.push({ x, y });
  }
  else if (w.kind === 'melee') for (const [dx, dy] of DIRS) { const x = u.x + dx, y = u.y + dy; if (inB(x, y)) out.push({ x, y, dir: [dx, dy] }); }
  else if (w.kind === 'naval') for (const o of B.units) { if (o.dead || o === u || U(o).mob !== 'sea') continue; const d = dist(u, o); if (d >= w.min && d <= w.range) out.push({ x: o.x, y: o.y }); }
  else if (w.kind === 'any') for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) out.push({ x, y });
  return out;
}
function spotted(x, y, shooter) { const r = spotRange(); return ua().some(o => o !== shooter && Math.abs(o.x - x) + Math.abs(o.y - y) <= r); }
function weaponEffects(u, wid, t) {
  const w = WEAPONS[wid];
  if (w.kind === 'line') { const h = lineHit(u.x, u.y, t.dir, w, u); return h ? [{ x: h.x, y: h.y, w: wid, push: w.push ? t.dir : null }] : []; }
  if (w.kind === 'arc') {
    const e = [{ x: t.x, y: t.y, w: wid }];
    for (const dir of DIRS) { const x = t.x + dir[0], y = t.y + dir[1]; if (inB(x, y)) e.push({ x, y, w: null, push: dir }); }
    return e;
  }
  return [{ x: t.x, y: t.y, w: wid }];
}
function dmgAgainst(wid, x, y) {
  const w = WEAPONS[wid], o = unitAt(x, y), t = TILEAT(x, y);
  if (o) {
    const cls = U(o).cls;
    if (cls === 'air' && !(w.dmg.air > 0)) return w.kind === 'arc' || w.kind === 'any' || wid === 'msta' ? 0 : 0;
    let d = w.dmg[cls] || 0;
    if (cls === 'inf' && t.t === 'f' && wid !== 'javelin' && d > 1) d -= 1;
    return d;
  }
  if (bldAlive(t)) return w.dmg.bld || 0;
  return 0;
}

// ---------- enemy intents ----------
function enemyAttackTiles(e) {
  if (!e.aim) return [];
  const d = U(e);
  if (d.atk === 'land') return [{ x: e.x, y: e.y, land: true }];
  const w = WEAPONS[d.atk], [dx, dy] = e.aim.dir;
  if (w.kind === 'line') { const h = lineHit(e.x, e.y, e.aim.dir, w, e); return h ? [{ x: h.x, y: h.y, w: d.atk }] : []; }
  if (w.kind === 'melee') { const x = e.x + dx, y = e.y + dy; return inB(x, y) ? [{ x, y, w: d.atk }] : []; }
  const out = [];
  for (const k of [e.aim.dist, e.aim.dist + 1]) { const x = e.x + dx * k, y = e.y + dy * k; if (inB(x, y)) out.push({ x, y, w: d.atk }); }
  return out;
}
function threats() {
  const out = [];
  for (const e of ru()) for (const t of enemyAttackTiles(e)) out.push(Object.assign({ e }, t));
  for (const b of B.barrage) out.push({ x: b.x, y: b.y, w: 'msta', barrage: true });
  return out;
}
function landable(x, y) { const t = TILEAT(x, y); return !bldAlive(t) && !t.wreck && ['.', 'r', 'R'].includes(t.t); }

function scoreAttack(e, tiles) {
  let s = 0;
  for (const a of tiles) {
    if (a.land) continue;
    const v = unitAt(a.x, a.y), t = TILEAT(a.x, a.y), dmg = dmgAgainst(a.w, a.x, a.y);
    if (v && v !== e) { if (v.team === 'ua') s += 7 + dmg * 1.5; else if (v.team === 'ru') s -= 10; }
    else if (bldAlive(t) && BLD[t.t].civil) s += 9;
  }
  return s;
}
async function aiPlan() {
  const list = ru().sort((a, b) => a.id - b.id);
  for (const e of list) {
    if (e.dead) continue;
    const d = U(e), opts = [];
    if (d.atk === 'land') opts.push({ land: true });
    else if (d.atk) {
      const w = WEAPONS[d.atk];
      for (const dir of DIRS) {
        if (w.kind === 'grad') for (let k = w.min; k <= w.range; k++) opts.push({ dir, dist: k });
        else opts.push({ dir });
      }
    }
    const map = reach(e, B.mission.convoy && isVehicle(e) ? Math.min(2, d.move) : undefined), ox = e.x, oy = e.y;
    let best = null, bs = -1e9;
    for (const p of map.values()) {
      e.x = p.x; e.y = p.y;
      let base = Math.random() * 2;
      if (B.barrage.some(b => b.x === p.x && b.y === p.y)) base -= 4;
      if (B.marks.some(m => m.x === p.x && m.y === p.y)) base -= 3;
      if (B.mission.civ && B.mission.civ.path.some(([x, y]) => x === p.x && y === p.y)) base -= 4;
      if (B.mission.convoy && isVehicle(e)) base += (7 - p.x) * 3 + (p.x === 0 ? 30 : 0);
      if (d.spotter) base += ua().filter(o => dist(o, p) <= 2).length * 5 - (ua().some(o => o.type === 't64' && (o.x === p.x || o.y === p.y) && dist(o, p) <= 3) ? 4 : 0);
      if (!opts.length) { if (base > bs) { bs = base; best = { x: p.x, y: p.y, aim: null }; } continue; }
      for (const o of opts) {
        let s = base;
        if (o.land) {
          if (!landable(p.x, p.y)) continue;
          let dmin = 99;
          for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const t = TILEAT(x, y); if (bldAlive(t) && BLD[t.t].civil) dmin = Math.min(dmin, Math.abs(x - p.x) + Math.abs(y - p.y)); }
          s += 12 - dmin * 2 - ua().filter(u => dist(u, p) <= 1).length * 6;
        } else {
          e.aim = o;
          s += scoreAttack(e, enemyAttackTiles(e));
        }
        if (s > bs) { bs = s; best = { x: p.x, y: p.y, aim: o }; }
      }
    }
    e.x = ox; e.y = oy; e.aim = null;
    if (!best) continue;
    if (best.x !== e.x || best.y !== e.y) {
      const path = pathFrom(map, best.x, best.y);
      await animMove(e, path);
    }
    e.aim = best.aim;
    if (best.aim && best.aim.dir) e.face = best.aim.dir;
    renderHud();
  }
}

// ---------- effects ----------
async function applyEffects(list, src) {
  for (const e of list) {
    if (e.w) await hitTile(e.x, e.y, e.w, src);
    if (e.push) { const v = unitAt(e.x, e.y); if (v) await pushUnit(v, e.push); }
  }
}
async function hitTile(x, y, wid, src) {
  const w = WEAPONS[wid], t = TILEAT(x, y), o = unitAt(x, y);
  const big = ['artillery', 'barrage', 'tb2', 'shell', 'javelin', 'atgm'].includes(w.fx);
  explode(x, y, big ? 2 : 1, o && isAir(o) ? U(o).alt : 0);
  if ((w.crater || wid === 'msta') && !bldAlive(t) && !isWater(t) && t.t !== 'd' && !t.crater) {
    t.crater = true; addDecal(x, y);
    if (t.t === 'R') bark('crater');
  }
  if (o) {
    const d = dmgAgainst(wid, x, y);
    if (d > 0) await damageUnit(o, d, src);
    else floatText(x, y, '无效', '#c9d2d8', o && isAir(o) ? U(o).alt : 0);
  } else if (bldAlive(t)) {
    const d = w.dmg.bld || 0;
    if (d > 0) damageBuilding(x, y, d);
  }
  await sleep(120);
}
function damageBuilding(x, y, d) {
  const t = TILEAT(x, y), info = BLD[t.t];
  t.hp = Math.max(0, t.hp - d);
  floatText(x, y, '-' + d, '#ffb199', 40);
  if (info.civil) {
    B.stats.bldHit++;
    toast(`${info.name} ${coord(x, y)} 被击中`, 'bad');
    shake(3);
  }
  if (t.hp === 0) { explode(x, y, 3, 10); AUDIO.crash(); }
}
async function damageUnit(o, d, src) {
  o.hp -= d; o.flash = 1;
  if (o.team === 'ua') B.stats.dmgTaken += d;
  floatText(o.x, o.y, '-' + d, o.team === 'ua' ? '#ff8a73' : '#fff1b0', isAir(o) ? U(o).alt : 0);
  AUDIO.hit();
  if (o.hp <= 0) await killUnit(o, src);
  else if (o.team === 'ua' && o.hp === 1) bark('hurt', o);
}
async function killUnit(o, src, how) {
  o.hp = 0; o.dead = true;
  const d = U(o);
  if (o.team === 'ru') {
    B.stats.kills++;
    if (o.type === 'ka52' || o.type === 'mi8') { B.stats.heli++; bark('heli'); }
    if (o.type === 'orlan') { B.stats.orlan++; bark('orlan'); }
    if (U(o).mob === 'sea') B.stats.naval++;
    if (d.armor) B.stats.armor++;
    if (o.type === 'cmd') { B.stats.cmd++; bark('cmd'); }
    if (src && src.team === 'ua' && src.xp !== undefined) src.xp++;
    toast(`${d.name} 被摧毁`, 'good');
    if (!B.said.firstKill) { B.said.firstKill = 1; bark('kill', src); }
  } else if (o.team === 'civ') {
    B.stats.civLost++;
    toast('一批平民遇难', 'bad');
  } else toast(how === 'expend' ? `${d.name} 完成攻击` : `${d.name} 被摧毁`, how === 'expend' ? '' : 'bad');
  if (o.rid) B.deadRids.push(o.rid);
  if (how === 'drown' || how === 'expend') { await animSink(o); }
  else if (d.cls === 'air') await animCrash(o);
  else if (isVehicle(o)) await animWreck(o);
  else { await tween(350, k => { o.alpha = 1 - k; }); }
  B.units = B.units.filter(u => u !== o);
  if (sel === o.id) { sel = null; mode = null; }
}
async function pushUnit(v, dir) {
  if (U(v).stable) return;
  const nx = v.x + dir[0], ny = v.y + dir[1];
  if (!inB(nx, ny)) return;
  const o = unitAt(nx, ny), t = TILEAT(nx, ny);
  const air = isAir(v);
  if (o || bldAlive(t) || (!air && (t.wreck || (t.t === 'f' && isVehicle(v)))) || U(v).mob === 'sea' && !isWater(t)) {
    await animBump(v, dir);
    AUDIO.hit(); shake(2);
    if (o) { await damageUnit(o, 1); if (!v.dead) await damageUnit(v, 1); }
    else if (bldAlive(t)) { damageBuilding(nx, ny, 1); await damageUnit(v, 1); }
    else await damageUnit(v, 1);
    return;
  }
  v.x = nx; v.y = ny;
  await tween(170, k => { v.rx = lerp(nx - dir[0], nx, k); v.ry = lerp(ny - dir[1], ny, k); }, EASE.out);
  if (isWater(t) && !air && !U(v).amph && U(v).mob !== 'sea') {
    toast(`${U(v).name} 落水沉没`, v.team === 'ru' ? 'good' : 'bad');
    await killUnit(v, null, 'drown');
  }
}

// ---------- player actions ----------
async function playerMove(u, x, y) {
  const map = reach(u), n = map.get(x + ',' + y);
  if (!n) return false;
  u.prev = { x: u.x, y: u.y, face: u.face.slice() };
  const path = pathFrom(map, x, y);
  u.moved = true;
  busy = true;
  await animMove(u, path);
  busy = false;
  return true;
}
async function playerFire(u, wid, t) {
  const w = WEAPONS[wid];
  busy = true;
  const eff = weaponEffects(u, wid, t);
  const dir = t.dir || faceToward(u, t);
  u.face = dir;
  if (w.ammo) u.ammo[w.ammo]--;
  u.acted = true; u.moved = true; u.prev = null;
  sel = u.id; mode = null;
  renderHud();
  await animAttack(u, wid, t, eff);
  const xpBefore = u.xp;
  await applyEffects(eff, u);
  if (w.selfDestruct) u.xp = xpBefore; // 撞击自毁的无人艇不计经验
  if (w.selfDestruct && !u.dead) await killUnit(u, null, 'expend');
  busy = false;
  afterAction();
}
async function supportStrike(t) {
  busy = true; B.tb2Left--; mode = null;
  renderHud();
  await animTB2(t);
  await applyEffects([{ x: t.x, y: t.y, w: 'tb2' }], null);
  busy = false;
  afterAction();
}
function faceToward(u, t) {
  const dx = t.x - u.x, dy = t.y - u.y;
  if (!dx && !dy) return u.face;
  return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
}
function afterAction() {
  if (checkDefeat()) return;
  renderHud();
  if (B.phase === 'player' && ua().every(u => u.acted) && !B.said.allDone) { B.said.allDone = 1; hint('所有单位都已行动 · 按“结束回合”'); }
}
function checkDefeat() {
  if (!ua().length) { endMission('wiped'); return true; }
  return false;
}
function snapshot() {
  const keep = B.mission;
  B.mission = null;
  B.snap = null;
  const s = JSON.stringify(B);
  B.mission = keep;
  return { s };
}
function restoreSnapshot(snap) {
  const keep = B.mission, left = B.resetLeft - 1;
  B = JSON.parse(snap.s);
  B.mission = keep; B.resetLeft = left;
  for (const u of B.units) { u.rx = u.x; u.ry = u.y; }
  B.snap = snap;
}

// ---------- turn flow ----------
async function startBattle() {
  B.phase = 'enemy'; busy = true;
  renderHud();
  await aiPlan();
  markWaves(); markBarrage(); spawnCivilians();
  B.phase = 'player'; busy = false;
  B.snap = snapshot();
  banner(`第 1 回合`, 'player');
  renderHud();
  bark('start');
}
async function enemyPhase() {
  if (B.phase !== 'player' || busy) return;
  B.phase = 'enemy'; busy = true; sel = null; mode = null;
  renderHud();
  banner('敌军行动', 'enemy'); AUDIO.alarm();
  await sleep(900);
  // 1. artillery barrage
  if (B.barrage.length) {
    const hits = B.barrage.slice(); B.barrage = [];
    await animBarrage(hits);
    for (const h of hits) { await hitTile(h.x, h.y, 'msta', null); if (checkDefeat()) return; }
    renderHud();
  }
  // 2. enemy attacks in order
  for (const e of ru().sort((a, b) => a.id - b.id)) {
    if (e.dead || !e.aim) continue;
    const d = U(e), tiles = enemyAttackTiles(e);
    if (d.atk === 'land') { await animLanding(e); e.aim = null; renderHud(); continue; }
    if (!tiles.length) { e.aim = null; continue; }
    await animAttack(e, d.atk, tiles[0], tiles);
    for (const tt of tiles) { await hitTile(tt.x, tt.y, tt.w, e); if (checkDefeat()) return; }
    e.aim = null;
    renderHud();
    await sleep(160);
  }
  // 3. civilians move along the evacuation route
  if (B.mission.civ) await moveCivilians();
  // 4. convoy vehicles on the west edge break through
  if (B.mission.convoy) for (const e of ru()) if (isVehicle(e) && e.x === 0) {
    B.stats.escaped++;
    toast(`${U(e).name} 冲出了伏击圈`, 'bad');
    await tween(400, k => { e.rx = -k * 1.2; e.alpha = 1 - k; });
    B.units = B.units.filter(u => u !== e);
  }
  // 5. reinforcements
  for (const m of B.marks) {
    const o = unitAt(m.x, m.y);
    const air = UNITS[m.type].cls === 'air';
    if (o && !air) {
      if (o.team === 'ua') toast(`${U(o).name} 堵住了敌军增援`, 'good');
      await damageUnit(o, 1);
      continue;
    }
    let x = m.x, y = m.y;
    if (o) { const alt = freeNear(x, y); if (!alt) continue; x = alt.x; y = alt.y; }
    const n = mkUnit(m.type, x, y);
    B.units.push(n);
    await animArrive(n);
  }
  B.marks = [];
  if (checkDefeat()) return;
  if (B.turn >= B.maxTurn || (!ru().length && !B.waves.some(w => w.turn > B.turn))) { await sleep(400); endMission('done'); return; }
  // 6. enemies move and aim for next turn
  await aiPlan();
  B.turn++;
  markWaves(); markBarrage(); spawnCivilians();
  for (const u of ua()) { u.moved = false; u.acted = false; u.prev = null; }
  B.phase = 'player'; busy = false;
  B.said.allDone = 0;
  B.snap = snapshot();
  banner(`第 ${B.turn} 回合`, 'player'); AUDIO.turn();
  renderHud();
  bark('turn');
}
function freeNear(x, y) {
  for (const [dx, dy] of DIRS.concat([[1, 1], [-1, -1], [1, -1], [-1, 1]])) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && !unitAt(nx, ny) && !bldAlive(TILEAT(nx, ny))) return { x: nx, y: ny }; }
  return null;
}
function markWaves() {
  B.marks = [];
  for (const w of B.waves) if (w.turn === B.turn) for (const [type, x, y] of w.units) B.marks.push({ type, x, y });
}
function markBarrage() {
  const br = B.mission.barrage;
  B.barrage = [];
  if (!br || B.turn < br.from || B.turn > B.maxTurn) return;
  const orlan = ru().some(e => U(e).spotter);
  const n = br.count + (orlan ? 1 : 0), used = new Set();
  const us = ua();
  for (let i = 0; i < n && us.length; i++) {
    let tgt = null;
    if (orlan) { const cand = us.filter(u => !used.has(u.x + ',' + u.y)); if (cand.length) { const u = pick(cand); tgt = { x: u.x, y: u.y }; } }
    if (!tgt) {
      const u = pick(us), opts = [];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (Math.abs(x - u.x) + Math.abs(y - u.y) > 2 || isWater(TILEAT(x, y)) || used.has(x + ',' + y)) continue;
        const o = unitAt(x, y); if (o && o.team === 'ru') continue;
        opts.push({ x, y });
      }
      if (opts.length) tgt = pick(opts);
    }
    if (tgt) { used.add(tgt.x + ',' + tgt.y); B.barrage.push(tgt); }
  }
}
function spawnCivilians() {
  const cv = B.mission.civ;
  if (!cv) return;
  while (B.civNext < cv.groups.length && cv.groups[B.civNext] <= B.turn) {
    // spawn at the path start, or sidestep to path[1]/path[2] while enemies squat there
    let at = null;
    for (let idx = 0; idx < Math.min(3, cv.path.length); idx++) {
      const [x, y] = cv.path[idx];
      if (!unitAt(x, y)) { at = { x, y, idx }; break; }
    }
    if (!at) break;
    const c = mkUnit('civ', at.x, at.y); c.face = [-1, 0]; c.pathIdx = at.idx;
    B.units.push(c);
    B.civNext++;
    if (at.idx > 0) toast('平民绕开敌军，从旁边的路口出发', '');
  }
}
async function moveCivilians() {
  const cv = B.mission.civ;
  const civs = B.units.filter(u => u.team === 'civ' && !u.dead).sort((a, b) => b.pathIdx - a.pathIdx);
  for (const c of civs) {
    for (let s = 0; s < cv.speed; s++) {
      const ni = c.pathIdx + 1;
      if (ni >= cv.path.length) {
        B.stats.evac++;
        toast('一批平民安全过河', 'good'); bark('evac');
        await tween(500, k => { c.rx = c.x - k * 1.4; c.alpha = 1 - k; });
        c.dead = true; B.units = B.units.filter(u => u !== c);
        break;
      }
      // civilians slip past Ukrainian soldiers but cannot get past the enemy or stop on an occupied tile
      let ti = ni;
      while (ti < cv.path.length) { const o = unitAt(...cv.path[ti]); if (!o) break; if (o.team !== 'ua') { ti = -1; break; } ti++; }
      if (ti < 0) break;
      if (ti >= cv.path.length) { c.pathIdx = cv.path.length - 1; continue; }
      const steps = cv.path.slice(c.pathIdx, ti + 1);
      c.pathIdx = ti;
      await animMove(c, steps);
    }
  }
}

// ---------- mission end ----------
function endMission(reason) {
  if (B.phase === 'end') return;
  B.phase = 'end'; busy = false; sel = null; mode = null;
  const M = B.mission;
  const res = { reason, objectives: [], aid: 0, consequence: null };
  const lostAll = reason === 'wiped';
  for (const o of M.objectives) {
    const r = o.eval(B), done = !lostAll && (r.inverse ? r.cur <= r.max : r.cur >= r.max);
    res.objectives.push({ text: o.text, kind: o.kind, done, reward: o.reward, r });
    if (done) res.aid += o.reward;
  }
  const primaryOk = res.objectives.filter(o => o.kind === 'primary').every(o => o.done);
  res.win = primaryOk;
  if (!lostAll) {
    const c = M.consequence(B);
    if (c) { res.consequence = c; CAMP.flags[c.flag] = true; }
  }
  res.civilians = 0;
  for (const row of B.tiles) for (const t of row) if (bldAlive(t)) res.civilians += BLD[t.t].pop;
  res.civilians += B.stats.evac * 40;
  res.stats = Object.assign({}, B.stats);
  // promotions: compare each surviving unit's rank against its record's rank at battle start
  res.promotions = [];
  for (const rec of B.squad) {
    const u = B.units.find(v => v.rid === rec.rid);
    if (!u || u.dead) continue;
    const r0 = rankOf(rec.xp || 0), r1 = rankOf(u.xp || 0);
    if (RANKS.indexOf(r1) > RANKS.indexOf(r0)) {
      const dup = B.squad.filter(q => q.type === rec.type).length > 1;
      res.promotions.push(`${CHARS[UNITS[rec.type].pilot].call}${dup ? ' #' + rec.rid : ''}（${UNITS[rec.type].short}）晋升为${r1.name}。`);
      rec.xp = u.xp;
    }
  }
  for (const rec of B.squad) {
    const u = B.units.find(v => v.rid === rec.rid);
    if (u && !u.dead) rec.xp = u.xp || 0;
  }
  if (primaryOk) AUDIO.win(); else AUDIO.lose();
  showDebrief(res);
}
