'use strict';
// ---------- UI selection state (shared with ui.js) ----------
let sel = null, mode = null, wsel = null, hover = null, busy = false;

// ---------- transient effects ----------
const PROJ = [], PARTS = [], FLOATS = [], FLASH = [];
let shakeAmt = 0;
function shake(a) { if (!reduced) shakeAmt = Math.max(shakeAmt, a); }
function addP(o) { if (PARTS.length < 900) PARTS.push(Object.assign({ vx: 0, vy: 0, g: 0, drag: 1, s: 2, life: 30, grow: 0, ground: null, kind: 'p' }, o, { max: o.life || 30 })); }
function addDecal(x, y, kind) { B.decals.push({ x, y, seed: Math.floor(Math.random() * 1e6), kind: kind || 'crater' }); }
const FIRE = ['#fff6c8', '#ffd35a', '#ff9a2e', '#e8521f', '#7a2a14'];
function explode(x, y, size, alt) {
  const [cx, cy0] = center(x, y), cy = cy0 - (alt || 0) - 6;
  FLASH.push({ x: cx, y: cy, r: 10 + size * 10, life: 10, max: 10 });
  for (let i = 0; i < 12 * size; i++) {
    const a = Math.random() * Math.PI * 2, s = 0.6 + Math.random() * (1.2 + size);
    addP({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 0.8, drag: 0.9, life: 14 + Math.random() * 16, kind: 'fire', s: 3 + Math.floor(Math.random() * 3) });
  }
  for (let i = 0; i < 6 * size; i++) addP({ x: cx + (Math.random() - 0.5) * 16, y: cy - Math.random() * 8, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.6, drag: 0.97, life: 50 + Math.random() * 40, kind: 'smoke', s: 4, grow: 0.12 });
  for (let i = 0; i < 5 * size; i++) {
    const a = -Math.PI * Math.random();
    addP({ x: cx, y: cy, vx: Math.cos(a) * (1 + Math.random() * 3), vy: Math.sin(a) * (2 + Math.random() * 3), g: 0.25, life: 40, kind: 'debris', s: 2, c: pick(['#2a2622', '#4a4038', '#6b5f52']), ground: cy0 + (Math.random() - 0.5) * 12 });
  }
  shake(size * 2);
  AUDIO.boom(size >= 2);
}
function puff(x, y, n, c) { for (let i = 0; i < n; i++) addP({ x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 4, vx: (Math.random() - 0.5) * 0.8, vy: -0.2 - Math.random() * 0.4, drag: 0.95, life: 30 + Math.random() * 20, kind: 'smoke', s: 3, grow: 0.08, c }); }
function dust(x, y, n) { const [cx, cy] = center(x, y); for (let i = 0; i < n; i++) addP({ x: cx + (Math.random() - 0.5) * 50, y: cy + (Math.random() - 0.5) * 16, vx: (Math.random() - 0.5) * 1.2, vy: -0.2 - Math.random() * 0.3, drag: 0.95, life: 40, kind: 'smoke', s: 3, grow: 0.1, c: '#8a7a5a' }); }
function splashAt(x, y) {
  const [cx, cy] = center(x, y);
  for (let i = 0; i < 30; i++) addP({ x: cx + (Math.random() - 0.5) * 30, y: cy - 4, vx: (Math.random() - 0.5) * 2.4, vy: -2 - Math.random() * 3.6, g: 0.18, life: 40, kind: 'p', s: 2 + (i % 2), c: i % 2 ? '#9cc7e0' : '#ffffff', ground: cy + 4 });
  AUDIO.splash();
}
function floatText(x, y, text, color, alt) {
  const [cx, cy] = center(x, y);
  FLOATS.push({ x: cx, y: cy - (alt || 0) - 34, text, color, life: 70, max: 70 });
}
function fly(o) {
  // o: {x0,y0,x1,y1,dur,arc,kind,ctrl:[x,y]}
  return new Promise(res => {
    const p = Object.assign({ k: 0, arc: 0 }, o);
    PROJ.push(p);
    tween(o.dur, k => { p.k = k; }, o.ease || EASE.lin).then(() => { PROJ.splice(PROJ.indexOf(p), 1); res(); });
  });
}
function projPos(p, k) {
  if (p.ctrl) { const a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * p.x0 + b * p.ctrl[0] + c * p.x1, a * p.y0 + b * p.ctrl[1] + c * p.y1]; }
  return [lerp(p.x0, p.x1, k), lerp(p.y0, p.y1, k) - Math.sin(k * Math.PI) * p.arc];
}

// ---------- unit render helpers ----------
function unitAlt(u) { const d = U(u); return d.alt ? d.alt + (reduced ? 0 : Math.sin(performance.now() / 260 + u.id) * 2) : 0; }
function unitSprite(u) { return sprite(u.type, UNIT_MODEL[u.type], u.face, u.team === 'ua' ? 1 : 2); }
function unitScreen(u) {
  const [cx, cy] = center(u.rx, u.ry);
  const [fx, fy] = screenDir(u.face);
  return [Math.round(cx - fx * u.recoil * 5), Math.round(cy - fy * u.recoil * 5 - unitAlt(u) - u.rz)];
}
function muzzlePos(u) { const [sx, sy] = unitScreen(u); const m = MUZZLE[u.type] || [0, 0, 4]; const [ox, oy] = vproj(m, u.face); return [sx + ox, sy + oy]; }
function wreckSprite(w) {
  const tank = w.type === 't72' || w.type === 't64';
  return sprite('wreck' + w.type, () => wreckify(tank ? hullOf(UNIT_MODEL[w.type]()) : UNIT_MODEL[w.type](), 7), w.face, 3);
}
function turretSprite(type, face) { return sprite('turret' + type, () => wreckify(turretOf(UNIT_MODEL[type]()), 9), face, 4); }

// ---------- animations used by the rules ----------
async function animMove(u, path) {
  if (path.length < 2) return;
  const air = isAir(u), foot = U(u).mob === 'foot';
  if (!air && !foot && u.team !== 'civ') AUDIO.move();
  if (air) {
    const [x0, y0] = path[0], [x1, y1] = path[path.length - 1];
    u.face = faceToward({ x: x0, y: y0, face: u.face }, { x: x1, y: y1 });
    u.x = x1; u.y = y1;
    await tween(140 * path.length, k => { u.rx = lerp(x0, x1, k); u.ry = lerp(y0, y1, k); });
    return;
  }
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    u.face = [bx - ax, by - ay];
    u.x = bx; u.y = by;
    await tween(foot ? 150 : 120, k => { u.rx = lerp(ax, bx, k); u.ry = lerp(ay, by, k); }, EASE.lin);
    if (!foot && hash(bx, by, 1) < 0.6) dust(bx, by, 2);
  }
}
async function animBump(v, dir) {
  const x = v.x, y = v.y;
  await tween(90, k => { v.rx = x + dir[0] * 0.3 * k; v.ry = y + dir[1] * 0.3 * k; }, EASE.out);
  await tween(120, k => { v.rx = x + dir[0] * 0.3 * (1 - k); v.ry = y + dir[1] * 0.3 * (1 - k); }, EASE.out);
}
function muzzleFlash(u, big) {
  const [mx, my] = muzzlePos(u);
  FLASH.push({ x: mx, y: my, r: big ? 14 : 8, life: 6, max: 6, star: true });
  puff(mx, my, big ? 8 : 4, '#c9c4b8');
}
async function recoil(u) { await tween(60, k => { u.recoil = k; }, EASE.out); tween(260, k => { u.recoil = 1 - k; }, EASE.out); }
function targetPoint(t, fallbackU) {
  const [cx, cy] = center(t.x, t.y), o = unitAt(t.x, t.y);
  return [cx, cy - (o && isAir(o) ? unitAlt(o) : 0) - 8];
}
async function animAttack(u, wid, t, tiles) {
  const w = WEAPONS[wid], hit = tiles && tiles[0] && tiles[0].w ? tiles[0] : null;
  let [x1, y1] = hit ? targetPoint(hit) : targetPoint(t);
  if (!hit && w.kind === 'line') { const r = Math.min(w.range, 8); const ex = clamp(u.x + t.dir[0] * r, -1, 8), ey = clamp(u.y + t.dir[1] * r, -1, 8); [x1, y1] = center(ex, ey); y1 -= 8; }
  const [x0, y0] = muzzlePos(u);
  switch (w.fx) {
    case 'shell':
      AUDIO.cannon(); muzzleFlash(u, true); recoil(u); shake(2);
      await fly({ x0, y0, x1, y1, dur: 150, kind: 'shell' });
      break;
    case 'mg': {
      AUDIO.mg(); muzzleFlash(u, false);
      let last;
      for (let i = 0; i < 5; i++) { last = fly({ x0, y0, x1: x1 + (Math.random() - 0.5) * 10, y1: y1 + (Math.random() - 0.5) * 6, dur: 160, kind: 'tracer' }); await sleep(60); }
      await last;
      break;
    }
    case 'javelin':
      AUDIO.launch(); puff(x0, y0, 6, '#d8d4c8');
      await fly({ x0, y0, x1, y1, dur: 950, kind: 'missile', ctrl: [lerp(x0, x1, 0.7), Math.min(y0, y1) - 150], ease: EASE.inOut });
      break;
    case 'stinger':
      AUDIO.launch(); puff(x0, y0, 5, '#d8d4c8');
      await fly({ x0, y0, x1, y1, dur: 520, kind: 'missile', ctrl: [lerp(x0, x1, 0.4), Math.min(y0, y1) - 60] });
      break;
    case 'artillery':
      AUDIO.howitzer(); muzzleFlash(u, true); recoil(u); shake(3);
      setTimeout(() => AUDIO.whistle(0.7), 250 * SPEED);
      await fly({ x0, y0, x1, y1, dur: 900, kind: 'shellArc', arc: 170 });
      break;
    case 'rpg':
      AUDIO.launch(); puff(x0, y0, 5, '#d8d4c8');
      await fly({ x0, y0, x1, y1, dur: 260, kind: 'rocket' });
      break;
    case 'atgm':
      AUDIO.launch(); puff(x0, y0, 4, '#d8d4c8');
      await fly({ x0, y0, x1, y1, dur: 480, kind: 'missile' });
      break;
    case 'grad': {
      AUDIO.rockets(); muzzleFlash(u, false);
      let last;
      for (let i = 0; i < 6; i++) {
        const tt = tiles[i % tiles.length], [tx, ty] = targetPoint(tt);
        last = fly({ x0, y0, x1: tx + (Math.random() - 0.5) * 20, y1: ty + (Math.random() - 0.5) * 10, dur: 700, kind: 'rocket', arc: 120 });
        await sleep(90);
      }
      await last;
      break;
    }
  }
}
async function animBarrage(hits) {
  AUDIO.whistle(1.1);
  await sleep(500);
  await Promise.all(hits.map((h, i) => new Promise(res => setTimeout(async () => {
    const [cx, cy] = center(h.x, h.y);
    await fly({ x0: cx + 60, y0: cy - 360, x1: cx, y1: cy - 6, dur: 420, kind: 'shellArc' });
    res();
  }, i * 180 * SPEED))));
}
async function animTB2(t) {
  const [cx, cy] = center(t.x, t.y);
  const plane = { x: -40, y: cy - 190, kind: 'tb2' };
  PROJ.push(plane);
  AUDIO.tone(140, 1.6, 'sawtooth', 0.03);
  tween(1600, k => { plane.x = lerp(-60, W + 60, k); }, EASE.lin).then(() => PROJ.splice(PROJ.indexOf(plane), 1));
  await sleep(1600 * ((cx + 60) / (W + 120)) - 350);
  await fly({ x0: cx - 30, y0: cy - 190, x1: cx, y1: cy - 6, dur: 450, kind: 'bomb', ease: EASE.in });
}
async function animWreck(o) {
  const t = TILEAT(o.x, o.y);
  explode(o.x, o.y, 3, 0);
  if (t.t === 'w') { splashAt(o.x, o.y); await tween(500, k => { o.rz = -k * 14; o.alpha = 1 - k; }); return; }
  t.wreck = { type: o.type, face: o.face.slice(), seed: o.id };
  if (o.type === 't72' || o.type === 't64') {
    const d = pick(DIRS), [sx, sy] = screenDir(d);
    const deb = { type: o.type, face: pick(DIRS), x: o.x, y: o.y, ox: 0, oy: 0, z: 0 };
    B.debris.push(deb);
    await tween(700, k => { deb.ox = sx * 26 * k; deb.oy = sy * 26 * k; deb.z = Math.sin(k * Math.PI) * 70; }, EASE.lin);
    shake(3); dust(o.x, o.y, 6);
  } else await sleep(250);
}
async function animCrash(o) {
  const t = TILEAT(o.x, o.y), alt = U(o).alt;
  AUDIO.crash();
  let spin = 0;
  await tween(750, k => {
    o.rz = -alt * k * k;
    const s = Math.floor(k * 10);
    if (s !== spin) { spin = s; o.face = DIRS[[0, 2, 1, 3][s % 4]]; const [sx, sy] = unitScreen(o); puff(sx, sy - 6, 2, '#333'); }
  }, EASE.lin);
  explode(o.x, o.y, 3, 0);
  if (t.t === 'w') splashAt(o.x, o.y);
  else if (!bldAlive(t) && !t.wreck) t.wreck = { type: o.type, face: o.face.slice(), seed: o.id, air: true };
}
async function animSink(o) {
  splashAt(o.x, o.y);
  await tween(700, k => { o.rz = -k * 16; o.alpha = 1 - k; });
}
async function animLanding(e) {
  const alt = U(e).alt;
  AUDIO.noiseBurst(1.2, 600, 200, 1, 0.3);
  await tween(600, k => { e.rz = -(alt - 8) * k; }, EASE.inOut);
  dust(e.x, e.y, 14);
  let n = 0;
  for (const [dx, dy] of DIRS) {
    if (n >= 2) break;
    const x = e.x + dx, y = e.y + dy;
    if (!inB(x, y) || unitAt(x, y) || !landable(x, y)) continue;
    const v = mkUnit('vdv', x, y); v.face = [dx, dy];
    B.units.push(v); n++;
    await tween(260, k => { v.alpha = k; v.rx = lerp(e.x, x, k); v.ry = lerp(e.y, y, k); });
  }
  toast(n ? `米-8 降下了 ${n} 个空降兵班` : '米-8 找不到降落点，撤离', n ? 'bad' : 'good');
  await tween(700, k => { e.rz = -(alt - 8) * (1 - k) + k * 40; e.alpha = 1 - k; });
  e.dead = true;
  B.units = B.units.filter(u => u !== e);
}
async function animArrive(n) {
  if (isAir(n)) { n.alpha = 0; await tween(500, k => { n.alpha = k; n.rz = (1 - k) * 60; }); return; }
  dust(n.x, n.y, 8);
  n.alpha = 0;
  await tween(400, k => { n.alpha = k; });
}

// ---------- terrain ----------
const TCOL = {
  '.': ['#8c7a55', '#4a3d2d', '#5c4b37'],
  r:   ['#77756f', '#4a3d2d', '#5c4b37'],
  R:   ['#8e8e88', '#4a3d2d', '#5c4b37'],
  f:   ['#5f5e42', '#4a3d2d', '#5c4b37'],
  B:   ['#85827a', '#4a3d2d', '#5c4b37'],
  w:   ['#2f6a92', '#1a3a50', '#224860'],
};
const isRoadT = (x, y) => inB(x, y) && ['r', 'd', 'R'].includes(TILEAT(x, y).t);
function drawTile(x, y, t) {
  const sx = OX + (x - y) * TW, sy = OY + (x + y) * TH, cx = sx, cy = sy + TH;
  const tile = TILEAT(x, y);
  const key = BLD[tile.t] ? 'B' : tile.t === 'd' ? 'w' : tile.t;
  const [top, lc, rc] = TCOL[key];
  if (y === 7) for (let c = 0; c < 40; c++) {
    const yt = sy + 1 + Math.floor(20 + c / 2);
    R(sx - 40 + c, yt, 1, DEPTH, lc); R(sx - 40 + c, yt, 1, 3, shade(top, -0.3));
    if (hash(x, c, 5) < 0.12) R(sx - 40 + c, yt + 6 + Math.floor(hash(c, x, 6) * 8), 2, 1, '#3a3024');
  }
  if (x === 7) for (let d = 0; d < 40; d++) {
    const yt = sy + 1 + Math.floor(40 - (d + 1) / 2);
    R(sx + d, yt, 1, DEPTH, rc); R(sx + d, yt, 1, 3, shade(top, -0.4));
    if (hash(y, d, 7) < 0.12) R(sx + d, yt + 6 + Math.floor(hash(d, y, 8) * 8), 2, 1, '#43382a');
  }
  fillDia(cx, cy, 40, top);
  if (key === 'w') {
    const landL = inB(x - 1, y) && !['w', 'd'].includes(TILEAT(x - 1, y).t);
    const landU = inB(x, y - 1) && !['w', 'd'].includes(TILEAT(x, y - 1).t);
    for (let r = 0; r < 20; r++) {
      if (landL) { R(sx - 2 * (r + 1), sy + r, 8, 1, '#1d4260'); R(sx - 2 * (r + 1), sy + r, 2, 1, '#cfd8dc'); }
      if (landU) { R(sx + 2 * (r + 1) - 8, sy + r, 8, 1, '#1d4260'); R(sx + 2 * (r + 1) - 2, sy + r, 2, 1, '#cfd8dc'); }
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.sin(t * 1.6 + hash(x, y, i) * 6.28);
      if (a < 0.2) continue;
      const r = 6 + Math.floor(hash(x, y, i + 9) * 28), w = r < 20 ? 2 * (r + 1) : 2 * (40 - r);
      const px = cx - w + 6 + Math.floor(hash(y, x, i) * Math.max(1, 2 * w - 16));
      R(px, sy + r, 6, 1, a > 0.7 ? '#a6cfe6' : '#5f9ac0');
    }
    return;
  }
  const n = key === 'r' ? 40 : key === 'R' ? 30 : 80;
  for (let i = 0; i < n; i++) {
    const r = 2 + Math.floor(hash(x, y, i) * 36), w = r < 20 ? 2 * (r + 1) : 2 * (40 - r);
    const px = cx - w + 2 + Math.floor(hash(y, x, i + 3) * Math.max(1, 2 * w - 6));
    const k = hash(x + 11, y, i);
    let c, len = 2;
    if (key === '.') { c = k < 0.3 ? '#dfe5e8' : k < 0.66 ? '#a8905c' : k < 0.85 ? '#6d5c40' : '#9aa35a'; len = k < 0.3 ? 4 : 2; }
    else if (key === 'r') c = k < 0.5 ? '#86847e' : '#605e58';
    else if (key === 'R') c = k < 0.5 ? '#a09f99' : '#7b7a74';
    else if (key === 'f') c = k < 0.35 ? '#dfe5e8' : '#474630';
    else c = k < 0.5 ? '#918e85' : '#6c6961';
    R(px, sy + r, len, 1, c);
  }
  if (key === 'r') {
    const alongX = isRoadT(x - 1, y) || isRoadT(x + 1, y), alongY = isRoadT(x, y - 1) || isRoadT(x, y + 1);
    for (let s = -18; s <= 18; s++) {
      if ((Math.floor((s + 18) / 5) & 1)) continue;
      if (alongX) R(cx + s * 2 - 1, cy + s, 2, 1, '#d8d2b8');
      if (alongY) R(cx - s * 2 - 1, cy + s, 2, 1, '#d8d2b8');
    }
  }
  if (key === 'R') {
    // runway along x: outer edge lines, and a dashed centre line on the shared edge of rows 2 and 3
    const up = inB(x, y - 1) && TILEAT(x, y - 1).t === 'R', dn = inB(x, y + 1) && TILEAT(x, y + 1).t === 'R';
    for (let k = 2; k < 19; k++) {
      if (!up) R(cx + 2 * k - 1, cy - 20 + k + 3, 2, 1, '#e2e0d6');
      if (!dn) R(cx - 40 + 2 * k + 1, cy + k - 3, 2, 1, '#e2e0d6');
      else if (Math.floor(k / 4) % 2 === 0) R(cx - 40 + 2 * k + 1, cy + k, 2, 1, '#e8e6dc');
    }
    for (let k = 4; k < 36; k += 6) R(cx - 40 + k + 18 - 1, cy - 9 + k / 2, 2, 1, '#77766f');
  }
}
function drawDecal(d) {
  const [cx, cy] = center(d.x, d.y);
  const ox = Math.round((hash(d.seed, 1, 1) - 0.5) * 20), oy = Math.round((hash(d.seed, 2, 2) - 0.5) * 8);
  ellipse(cx + ox, cy + oy, 13, 6, '#4a3f33');
  ellipse(cx + ox, cy + oy, 10, 4, '#2a241d');
  ellipse(cx + ox, cy + oy + 1, 6, 2, '#1a1612');
  for (let i = 0; i < 12; i++) { const a = hash(d.seed, i, 3) * 6.28, r = 14 + hash(d.seed, i, 4) * 6; R(cx + ox + Math.cos(a) * r, cy + oy + Math.sin(a) * r * 0.45, 2, 1, '#3b3228'); }
}

// ---------- props ----------
function propDrawables(t, out) {
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const tl = TILEAT(x, y), [cx, cy] = center(x, y), seed = x * 8 + y + B.mi * 64;
    if (tl.t === 'f') out.push({ d: x + y, f: () => blit(sprite('forest' + seed, () => mForest(seed), [1, 0], seed), cx, cy) });
    else if (tl.t === 'd') out.push({ d: x + y - 0.5, f: () => blit(sprite('bridgeRuin', () => mBridgeRuin(true), [1, 0]), cx, cy) });
    else if (BLD[tl.t]) out.push({ d: x + y, f: () => drawBuilding(x, y, t, seed) });
    if (tl.wreck) { const w = tl.wreck; out.push({ d: x + y + 0.05, f: () => blit(wreckSprite(w), cx, cy) }); }
  }
  for (const deb of B.debris) { const [cx, cy] = center(deb.x, deb.y); out.push({ d: deb.x + deb.y + 0.2, f: () => blit(turretSprite(deb.type, deb.face), cx + deb.ox, cy + deb.oy - deb.z) }); }
}
function drawBuilding(x, y, t, seed) {
  const tile = TILEAT(x, y), [cx, cy] = center(x, y);
  const st = tile.hp <= 0 ? 'x' : tile.hp < tile.max ? 'd' : 'n';
  let build;
  if (st === 'x') build = () => mRubble(seed);
  else if (tile.t === 'b') build = () => mApt(seed, st === 'd');
  else if (tile.t === 'h') build = () => mHouse(seed, st === 'd');
  else if (tile.t === 'H') build = () => mHangar(seed, st === 'd');
  else if (tile.t === 'c') build = mChurch;
  else build = mSub;
  blit(sprite(`${tile.t}${st}${seed}`, build, [1, 0], seed), cx, cy);
}

// ---------- units ----------
function drawUnitBase(u, t) {
  const [cx0, cy] = center(u.rx, u.ry), cx = Math.round(cx0), air = isAir(u);
  const a = u.alpha;
  if (a < 0.05) return;
  g.globalAlpha = a;
  fillDia(cx, cy, air ? 20 : 30, 'rgba(0,0,0,.35)');
  if (u.team !== 'civ' || true) {
    const ring = u.team === 'civ' ? '#e8e6dc' : sel === u.id ? (Math.floor(t * 4) % 2 ? '#fff1b0' : '#f2c230') : u.team === 'ua' ? (u.acted && B.phase === 'player' ? '#7d8c99' : '#4aa3ff') : '#ff4a2b';
    if (!air) { outlineDia(cx, cy, 36, ring); outlineDia(cx, cy, 34, ring); }
    else outlineDia(cx, cy, 22, ring);
  }
  g.globalAlpha = 1;
}
function drawRotor(cx, cy, r, ang, blades, c) {
  for (let i = 0; i < blades; i++) {
    const a = ang + i * Math.PI * 2 / blades;
    line(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5, c, 2);
  }
}
// 1-based rank among aiming enemies (id ascending) — the order they act in enemyPhase.
function actionOrder(u) {
  if (!B || B.phase !== 'player' || u.team !== 'ru' || u.dead || !u.aim) return 0;
  let n = 0;
  for (const e of ru()) if (e.aim && e.id <= u.id) n++;
  return n;
}
function drawUnit(u, t) {
  if (u.alpha < 0.05) return;
  const s = unitSprite(u);
  const [sx, sy] = unitScreen(u);
  const dim = u.team === 'ua' && u.acted && B.phase === 'player';
  g.globalAlpha = u.alpha * (dim ? 0.62 : 1);
  blit(s, sx, sy);
  if (u.flash > 0) { g.globalAlpha = u.flash; g.globalCompositeOperation = 'lighter'; blit(s, sx, sy); g.globalCompositeOperation = 'source-over'; }
  const spin = t * 38;
  if (u.type === 'ka52') { drawRotor(sx, sy - 16, 30, spin, 3, 'rgba(20,22,24,.8)'); drawRotor(sx, sy - 19, 30, -spin + 0.5, 3, 'rgba(20,22,24,.8)'); }
  if (u.type === 'mi8') { drawRotor(sx, sy - 18, 34, spin, 5, 'rgba(20,22,24,.7)'); const [tx, ty] = vproj([-17, 1, 7], u.face); drawRotor(sx + tx, sy + ty, 7, -spin * 1.5, 3, 'rgba(20,22,24,.8)'); }
  if (u.type === 'orlan') { const [tx, ty] = vproj([-8, 0, 1], u.face); drawRotor(sx + tx, sy + ty, 5, spin * 2, 2, 'rgba(20,22,24,.8)'); }
  g.globalAlpha = u.alpha;
  if (u.team !== 'civ') {
    const tw = u.max * 8 - 2, hx = sx - Math.floor(tw / 2), hy = Math.round(sy + s.oy - 12);
    R(hx - 2, hy - 2, tw + 4, 9, '#0b1210');
    for (let i = 0; i < u.max; i++) {
      R(hx + i * 8, hy, 6, 5, i < u.hp ? (u.team === 'ua' ? '#7bd650' : '#ff6b4f') : '#2a3a33');
      if (i < u.hp) R(hx + i * 8, hy, 6, 1, u.team === 'ua' ? '#b8f59a' : '#ffb3a3');
    }
    const on = actionOrder(u);
    if (on) {
      const bw = on >= 10 ? txtW(on, 2) + 6 : 14, bx = hx - 6 - bw, by = hy - 5;
      R(bx, by, bw, 14, '#ff4a2b'); R(bx + 1, by + 1, bw - 2, 12, '#3a0e06');
      txt(on, bx + (bw - txtW(on, 2)) / 2, by + 2, '#ffe0d6', 2);
    }
  }
  g.globalAlpha = 1;
}

// ---------- overlays ----------
function hatch(x, y, col) {
  const sx = OX + (x - y) * TW, sy = OY + (x + y) * TH;
  g.fillStyle = col;
  for (let r = 2; r < 38; r++) { const w = r < 20 ? 2 * (r + 1) : 2 * (40 - r); for (let px = sx - w + 4; px < sx + w - 4; px++) if (((px + sy + r) >> 3) & 1) g.fillRect(px, sy + r, 1, 1); }
}
function currentPreview() {
  const su = sel != null ? B.units.find(u => u.id === sel) : null;
  if (!hover || B.phase !== 'player') return null;
  if (mode === 'support') return { tiles: [{ x: hover.x, y: hover.y }], eff: [{ x: hover.x, y: hover.y, w: 'tb2' }] };
  if (!su || mode !== 'target' || !wsel) return null;
  const ts = weaponTargets(su, wsel), ht = ts.find(p => p.x === hover.x && p.y === hover.y);
  if (!ht) return null;
  return { eff: weaponEffects(su, wsel, ht), ht };
}

// ---------- main battle render ----------
function renderBattle(now, opts) {
  const t = now / 1000;
  opts = opts || {};
  g.drawImage(bgC, 0, 0);
  fillDia(OX, OY + 160 + 36, 336, 'rgba(0,0,0,.35)');
  for (const u of B.units) { if (!u.moving) { u.flash = Math.max(0, u.flash - 0.05); } }

  for (let s = 0; s < 15; s++) for (let x = 0; x < 8; x++) { const y = s - x; if (y >= 0 && y < 8) drawTile(x, y, t); }
  for (const d of B.decals) drawDecal(d);

  const pulse = reduced ? 0.5 : (Math.sin(t * 5) + 1) / 2;
  if (!opts.clean) {
    if (B.phase === 'deploy') for (const [x, y] of B.mission.deploy) { const [cx, cy] = center(x, y); fillDia(cx, cy, 40, 'rgba(74,163,255,.18)'); outlineDia(cx, cy, 40, 'rgba(124,192,255,.6)'); }
    for (const m of B.marks) { hatch(m.x, m.y, UNITS[m.type].cls === 'air' ? 'rgba(255,120,90,.45)' : 'rgba(242,194,48,.55)'); const [cx, cy] = center(m.x, m.y); outlineDia(cx, cy, 40, UNITS[m.type].cls === 'air' ? '#ff7a5a' : '#f2c230'); }
    const su = sel != null ? B.units.find(u => u.id === sel) : null;
    if (su && mode === 'move' && B.phase === 'player') for (const p of reach(su).values()) { if (p.x === su.x && p.y === su.y) continue; const [cx, cy] = center(p.x, p.y); fillDia(cx, cy, 40, 'rgba(74,163,255,.30)'); outlineDia(cx, cy, 40, '#7cc0ff'); }
    if (su && mode === 'target' && wsel && B.phase === 'player') {
      const w = WEAPONS[wsel];
      if (w.kind === 'arc') { const r = spotRange(); for (const o of ua()) { if (o === su) continue; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (Math.abs(x - o.x) + Math.abs(y - o.y) <= r) { const [cx, cy] = center(x, y); fillDia(cx, cy, 40, 'rgba(120,200,255,.06)'); } } }
      for (const p of weaponTargets(su, wsel)) { const [cx, cy] = center(p.x, p.y); fillDia(cx, cy, 40, 'rgba(242,194,48,.16)'); outlineDia(cx, cy, 40, 'rgba(242,194,48,.85)'); }
    }
    if (mode === 'support' && B.phase === 'player') for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const [cx, cy] = center(x, y); outlineDia(cx, cy, 40, 'rgba(242,194,48,.35)'); }
    const pv = currentPreview();
    if (pv) for (const e of pv.eff) { const [cx, cy] = center(e.x, e.y); fillDia(cx, cy, 40, e.w ? 'rgba(255,170,40,.55)' : 'rgba(255,220,120,.22)'); }
    if (B.phase !== 'deploy') for (const a of threats()) {
      const [cx, cy] = center(a.x, a.y);
      if (a.land) { fillDia(cx, cy, 40, `rgba(255,140,60,${0.18 + pulse * 0.15})`); outlineDia(cx, cy, 40, '#ff8a3a'); outlineDia(cx, cy, 20, '#ff8a3a'); continue; }
      fillDia(cx, cy, 40, `rgba(255,74,43,${0.2 + pulse * 0.2})`); outlineDia(cx, cy, 40, '#ff4a2b'); outlineDia(cx, cy, 24, 'rgba(255,120,90,.9)');
    }
    if (hover) { const [cx, cy] = center(hover.x, hover.y); outlineDia(cx, cy, 40, 'rgba(255,255,255,.9)'); }
  }
  for (const u of B.units) drawUnitBase(u, t);

  // objects on their own layer, painter's order, then outlined
  const dr = [];
  propDrawables(t, dr);
  for (const u of B.units) dr.push({ d: u.rx + u.ry + 0.1 + (isAir(u) ? 0.3 : 0), f: () => drawUnit(u, t) });
  lg.clearRect(0, 0, W, H);
  g = lg;
  dr.sort((a, b) => a.d - b.d).forEach(o => o.f());
  g = ag;
  tg.globalCompositeOperation = 'source-over';
  tg.clearRect(0, 0, W, H); tg.drawImage(layC, 0, 0);
  tg.globalCompositeOperation = 'source-in';
  tg.fillStyle = '#0a0f14'; tg.fillRect(0, 0, W, H);
  for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]]) ag.drawImage(tintC, ox, oy);
  ag.drawImage(layC, 0, 0);

  if (!opts.clean && B.phase !== 'deploy') drawIntents(pulse);
  const pv = !opts.clean && currentPreview();
  if (pv) for (const e of pv.eff) {
    const [cx, cy] = center(e.x, e.y);
    if (e.w) { const d = dmgAgainst(e.w, e.x, e.y), o = unitAt(e.x, e.y); if (d > 0 || o) badge(cx, cy - 4 - (o && isAir(o) ? unitAlt(o) : 0), d, '#3a2c06', o && d >= o.hp ? '#ffffff' : '#f2c230', '#fff4c6'); }
    if (e.push && unitAt(e.x, e.y) && !U(unitAt(e.x, e.y)).stable) { const [vx, vy] = screenDir(e.push); const x0 = cx + vx * 8, y0 = cy + vy * 8 - 4, x1 = cx + vx * 30, y1 = cy + vy * 30 - 4; line(x0, y0, x1, y1, '#0a0f14', 5); line(x0 + 1, y0 + 1, x1 + 1, y1 + 1, '#f2c230', 3); R(x1 - 3, y1 - 3, 8, 8, '#fff1b0'); }
  }
  drawFx(now);
  // burning wrecks and damaged buildings keep smoking
  if (!reduced && Math.random() < 0.5) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const tl = TILEAT(x, y), [cx, cy] = center(x, y);
    if (tl.wreck && Math.random() < 0.12) addP({ x: cx + (Math.random() - 0.5) * 12, y: cy - 10, vx: 0.25, vy: -0.5, drag: 0.99, life: 90, kind: 'smoke', s: 3, grow: 0.08, c: '#2b2b2b' });
    if (tl.wreck && Math.random() < 0.08) addP({ x: cx + (Math.random() - 0.5) * 10, y: cy - 8, vx: 0, vy: -0.6, life: 14, kind: 'fire', s: 2 });
    if (BLD[tl.t] && tl.hp < tl.max && Math.random() < 0.1) addP({ x: cx + (Math.random() - 0.5) * 20, y: cy - (tl.hp > 0 ? (tl.t === 'b' ? 44 : 26) : 8), vx: 0.3, vy: -0.6, drag: 0.99, life: 90, kind: 'smoke', s: 4, grow: 0.08, c: '#303030' });
  }
}
function drawIntents(pulse) {
  for (const e of ru()) {
    if (!e.aim) continue;
    const d = U(e), tiles = enemyAttackTiles(e);
    const [ex, ey] = unitScreen(e);
    for (const a of tiles) {
      const [tx, ty] = center(a.x, a.y);
      if (a.land) { badge(tx, ty - 4, '!', '#3a1a06', '#ff8a3a', '#ffe0c0'); continue; }
      const w = WEAPONS[a.w];
      if (w.kind === 'grad') {
        for (let i = 1; i < 20; i++) { const k = i / 20, x = ex + (tx - ex) * k, y = ey - 6 + (ty - ey) * k - Math.sin(k * Math.PI) * 80; if (i % 2) { R(x - 1, y - 1, 5, 5, '#0a0f14'); R(x, y, 3, 3, '#ff6a4a'); } }
      } else if (w.kind === 'line') {
        const n = Math.max(Math.abs(a.x - e.x), Math.abs(a.y - e.y));
        for (let i = 1; i < n; i++) { const [px, py] = center(e.x + e.aim.dir[0] * i, e.y + e.aim.dir[1] * i); const lift = isAir(e) ? unitAlt(e) * (1 - i / n) : 0; R(px - 4, py - 4 - lift, 8, 8, '#0a0f14'); R(px - 3, py - 3 - lift, 6, 6, '#ff5a3a'); }
      } else {
        const [vx, vy] = screenDir(e.aim.dir);
        line(ex + vx * 12, ey - 6 + vy * 12, ex + vx * 30, ey - 2 + vy * 30, '#0a0f14', 5);
        line(ex + vx * 12 + 1, ey - 5 + vy * 12, ex + vx * 30 + 1, ey - 1 + vy * 30, '#ff4a2b', 3);
      }
      const dmg = dmgAgainst(a.w, a.x, a.y), tgt = unitAt(a.x, a.y);
      if (dmg > 0 || tgt) badge(tx, ty - 4 - (tgt && isAir(tgt) ? unitAlt(tgt) : 0), dmg, '#3a0e06', '#ff4a2b', '#ffe0d6');
    }
  }
  for (const b of B.barrage) {
    const [cx, cy] = center(b.x, b.y);
    outlineDia(cx, cy, 40, pulse > 0.5 ? '#ff4a2b' : '#ffb199'); outlineDia(cx, cy, 16, '#ff4a2b');
    const dmg = dmgAgainst('msta', b.x, b.y);
    badge(cx, cy - 4, dmg || '!', '#3a0e06', pulse > 0.5 ? '#ffb199' : '#ff4a2b', '#ffffff');
    line(cx - 10, cy - 30, cx - 4, cy - 16, '#ff4a2b', 2); line(cx + 2, cy - 34, cx + 5, cy - 18, '#ff4a2b', 2);
  }
}
function drawFx(now) {
  for (const p of PROJ) {
    if (p.kind === 'tb2') { blit(sprite('tb2', mTB2, [1, 0]), p.x, p.y); continue; }
    const [x, y] = projPos(p, p.k), [bx, by] = projPos(p, Math.max(0, p.k - 0.06));
    if (p.kind === 'shell') { line(bx, by, x, y, '#fff1b0', 2); R(x - 2, y - 2, 4, 4, '#ffffff'); }
    else if (p.kind === 'tracer') { line(bx, by, x, y, '#ffcf5a', 2); }
    else if (p.kind === 'missile' || p.kind === 'rocket') {
      R(x - 2, y - 2, 4, 4, '#dcdcd4'); R(bx - 2, by - 2, 4, 4, '#ffb13a');
      if (Math.random() < 0.9) addP({ x: bx, y: by, vx: (Math.random() - 0.5) * 0.3, vy: -0.1, drag: 0.96, life: 40, kind: 'smoke', s: 3, grow: 0.06, c: '#cfcac0' });
    }
    else if (p.kind === 'shellArc' || p.kind === 'bomb') { R(x - 2, y - 2, 5, 5, '#1c1c1c'); R(x - 1, y - 1, 2, 2, '#6a6a6a'); }
  }
  for (let i = FLASH.length - 1; i >= 0; i--) {
    const f = FLASH[i]; f.life--;
    if (f.life <= 0) { FLASH.splice(i, 1); continue; }
    const k = f.life / f.max;
    if (f.star) { g.globalAlpha = k; disc(f.x, f.y, Math.round(f.r * 0.5), '#fff6c8'); line(f.x - f.r, f.y, f.x + f.r, f.y, '#ffd35a', 2); line(f.x, f.y - f.r * 0.6, f.x, f.y + f.r * 0.6, '#ffd35a', 2); }
    else { g.globalAlpha = k * 0.9; disc(f.x, f.y, Math.round(f.r * (1.4 - k * 0.6)), '#ffd35a'); disc(f.x, f.y, Math.round(f.r * (0.9 - k * 0.3)), '#fff6c8'); }
    g.globalAlpha = 1;
  }
  for (let i = PARTS.length - 1; i >= 0; i--) {
    const p = PARTS[i];
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; p.life--; p.s += p.grow;
    if (p.ground != null && p.y > p.ground) { p.y = p.ground; p.vy *= -0.3; p.vx *= 0.6; }
    if (p.life <= 0) { PARTS.splice(i, 1); continue; }
    const k = p.life / p.max;
    let c = p.c;
    if (p.kind === 'fire') c = FIRE[Math.min(FIRE.length - 1, Math.floor((1 - k) * FIRE.length))];
    if (p.kind === 'smoke') { g.globalAlpha = Math.min(0.75, k * 1.2); c = c || '#5a5a5a'; }
    else g.globalAlpha = Math.min(1, k * 2);
    const s = Math.round(p.s);
    R(p.x - s / 2, p.y - s / 2, s, s, c);
  }
  g.globalAlpha = 1;
  g.font = 'bold 12px "Noto Sans SC", sans-serif';
  for (let i = FLOATS.length - 1; i >= 0; i--) {
    const f = FLOATS[i]; f.life--;
    if (f.life <= 0) { FLOATS.splice(i, 1); continue; }
    const k = 1 - f.life / f.max, y = f.y - EASE.out(Math.min(1, k * 2)) * 16;
    g.globalAlpha = f.life < 20 ? f.life / 20 : 1;
    if (/^[-+0-9]+$/.test(f.text)) { const w = txtW(f.text, 3); txt(f.text, f.x - w / 2 + 2, y + 2, '#0a0f14', 3); txt(f.text, f.x - w / 2, y, f.color, 3); }
    else { g.fillStyle = '#0a0f14'; g.fillText(f.text, f.x - 12 + 1, y + 11); g.fillStyle = f.color; g.fillText(f.text, f.x - 12, y + 10); }
    g.globalAlpha = 1;
  }
}

// ---------- weather ----------
const flakes = Array.from({ length: 140 }, () => ({ x: Math.random() * 2000, y: Math.random() * 1200, s: 0.3 + Math.random() * 0.7, p: Math.random() * 6, z: Math.random() < 0.3 ? 2 : 1 }));
function drawSnow(t) {
  if (reduced) return;
  for (const f of flakes) { f.y += f.s; f.x += Math.sin(t + f.p) * 0.25; if (f.y > H) { f.y = -2; f.x = Math.random() * W; } if (f.x < W) R(f.x, f.y, f.z, f.z, 'rgba(235,242,248,.8)'); }
}
