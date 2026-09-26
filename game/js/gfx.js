'use strict';
// ---------- canvases & sizing ----------
// The scene is drawn at a low "art" resolution and blitted with a whole-number scale,
// so every art pixel lands on an exact block of device pixels (no blur, no uneven pixels).
let W = 960, H = 540, OX = 480, OY = 130, PX = 2;
const TW = 40, TH = 20, DEPTH = 16;
const stage = document.getElementById('stage');
const dg = stage.getContext('2d');
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w || W; c.height = h || H; return c; };
const artC = mkCanvas(), layC = mkCanvas(), tintC = mkCanvas(), bgC = mkCanvas();
const ag = artC.getContext('2d'), lg = layC.getContext('2d'), tg = tintC.getContext('2d');
let g = ag;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function fitStage() {
  const dpr = window.devicePixelRatio || 1;
  const vw = window.innerWidth, vh = window.innerHeight;
  let k = Math.max(1, Math.round(vh * dpr / 540));
  while (k > 1 && vh * dpr / k < 450) k--;
  PX = k;
  W = Math.ceil(vw * dpr / k); H = Math.ceil(vh * dpr / k);
  for (const c of [artC, layC, tintC, bgC]) { c.width = W; c.height = H; }
  stage.width = W * k; stage.height = H * k;
  stage.style.width = (W * k / dpr) + 'px';
  stage.style.height = (H * k / dpr) + 'px';
  dg.imageSmoothingEnabled = false;
  OX = Math.floor(W / 2);
  OY = Math.floor((H - 336) / 2) + 26;
  buildBackground();
  if (typeof size3D === 'function') size3D();
}
// Screen position (CSS px) of an art-space point, for HTML overlays.
function artToCss(x, y) { const dpr = window.devicePixelRatio || 1; return [x * PX / dpr, y * PX / dpr]; }
function cssToArt(x, y) { const dpr = window.devicePixelRatio || 1; return [x * dpr / PX, y * dpr / PX]; }

// ---------- pixel primitives ----------
const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.floor(x), Math.floor(y), w, h); };
function fillDia(cx, cy, hw, c) {
  g.fillStyle = c; cx = Math.floor(cx); cy = Math.floor(cy);
  const top = cy - hw / 2;
  for (let r = 0; r < hw; r++) { const w = r < hw / 2 ? 2 * (r + 1) : 2 * (hw - r); g.fillRect(cx - w, top + r, 2 * w, 1); }
}
function outlineDia(cx, cy, hw, c, th) {
  th = th || 2; g.fillStyle = c; cx = Math.floor(cx); cy = Math.floor(cy);
  const top = cy - hw / 2;
  for (let r = 0; r < hw; r++) { const w = r < hw / 2 ? 2 * (r + 1) : 2 * (hw - r); g.fillRect(cx - w, top + r, th, 1); g.fillRect(cx + w - th, top + r, th, 1); }
}
function line(x0, y0, x1, y1, c, sz) {
  sz = sz || 1;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy; g.fillStyle = c;
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x0, y0, sz, sz);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(cx, cy, r, c) {
  g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -r; y <= r; y++) { const w = Math.round(Math.sqrt(r * r - y * y)); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); }
}
function ellipse(cx, cy, rx, ry, c) {
  g.fillStyle = c; cx = Math.round(cx); cy = Math.round(cy);
  for (let y = -ry; y <= ry; y++) { const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); g.fillRect(cx - w, cy + y, 2 * w + 1, 1); }
}
const GLYPH = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
  '!': '010010010000010', '-': '000000111000000', '+': '000010111010000', '?': '111001011000010',
};
function txt(s, x, y, c, k) {
  k = k || 2; g.fillStyle = c; let ox = Math.floor(x);
  for (const ch of String(s)) { const b = GLYPH[ch]; if (b) for (let i = 0; i < 15; i++) if (b[i] === '1') g.fillRect(ox + (i % 3) * k, Math.floor(y) + Math.floor(i / 3) * k, k, k); ox += 4 * k; }
}
const txtW = (s, k) => String(s).length * 4 * (k || 2) - (k || 2);
function badge(cx, cy, n, bg, border, fg) {
  cx = Math.round(cx); cy = Math.round(cy);
  const w = Math.max(17, txtW(n) + 10);
  R(cx - w / 2 - 1, cy - 9, w + 2, 18, '#0a0f14'); R(cx - w / 2, cy - 8, w, 16, border); R(cx - w / 2 + 2, cy - 6, w - 4, 12, bg);
  txt(n, cx - txtW(n) / 2, cy - 5, fg);
}

// ---------- iso projection ----------
function center(x, y) { return [OX + (x - y) * TW, OY + (x + y) * TH + TH]; }
function screenDir(dir) { const vx = (dir[0] - dir[1]) * TW, vy = (dir[0] + dir[1]) * TH, l = Math.hypot(vx, vy); return [vx / l, vy / l]; }
const rotXY = (x, y, d) => d[0] === 1 ? [x, y] : d[0] === -1 ? [-x, -y] : d[1] === 1 ? [-y, x] : [y, -x];
// Voxel (model space, facing +x) to screen offset from the tile centre.
function vproj(p, dir) { const [x, y] = rotXY(p[0], p[1], dir); return [(x - y) * 2, (x + y) - p[2] * 2]; }

// ---------- voxel sprites ----------
const vkey = (x, y, z) => ((x + 128) << 16) | ((y + 128) << 8) | (z + 128);
class Vox {
  constructor() { this.m = new Map(); }
  set(x, y, z, c) { this.m.set(vkey(x, y, z), [x, y, z, c]); return this; }
  box(x0, x1, y0, y1, z0, z1, c) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.set(x, y, z, c); return this; }
  has(x, y, z) { return this.m.has(vkey(x, y, z)); }
  get(x, y, z) { return this.m.get(vkey(x, y, z)); }
  del(x, y, z) { this.m.delete(vkey(x, y, z)); }
  paint(x, y, z, c) { const v = this.m.get(vkey(x, y, z)); if (v) v[3] = c; }
  ell(cx, cy, rx, ry, z0, z1, c) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      if ((x - cx) ** 2 / (rx * rx) + (y - cy) ** 2 / (ry * ry) <= 1) for (let z = z0; z <= z1; z++) this.set(x, y, z, c);
    return this;
  }
  filter(fn) { const v = new Vox(); for (const p of this.m.values()) if (fn(p)) v.set(p[0], p[1], p[2], p[3]); return v; }
  shift(dx, dy, dz) { const v = new Vox(); for (const p of this.m.values()) v.set(p[0] + dx, p[1] + dy, p[2] + dz, p[3]); return v; }
}
function bake(vox, dir, seed) {
  const m = new Map(), list = [];
  for (const [x, y, z, c] of vox.m.values()) { const [rx, ry] = rotXY(x, y, dir); const v = [rx, ry, z, c]; m.set(vkey(rx, ry, z), v); list.push(v); }
  const vis = list.filter(([x, y, z]) => !(m.has(vkey(x + 1, y, z)) && m.has(vkey(x, y + 1, z)) && m.has(vkey(x, y, z + 1))));
  vis.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[2] - b[2]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y, z] of vis) {
    const sx = (x - y) * 2 - 2, sy = (x + y) - z * 2 - 2;
    x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx + 4); y1 = Math.max(y1, sy + 4);
  }
  if (!vis.length) { x0 = y0 = 0; x1 = y1 = 1; }
  const c = mkCanvas(x1 - x0, y1 - y0), cg = c.getContext('2d');
  for (const [x, y, z, col] of vis) {
    const sx = (x - y) * 2 - 2 - x0, sy = (x + y) - z * 2 - 2 - y0;
    const n = (hash(x + seed, y * 3 + 1, z) - 0.5) * 0.08;
    // Light from the upper left: top face bright, +y face mid, +x face dark.
    const ao = m.has(vkey(x, y, z + 2)) ? -0.04 : 0;
    cg.fillStyle = shade(col, 0.16 + n + ao); cg.fillRect(sx, sy, 4, 2);
    cg.fillStyle = shade(col, n); cg.fillRect(sx, sy + 2, 2, 2);
    cg.fillStyle = shade(col, -0.26 + n); cg.fillRect(sx + 2, sy + 2, 2, 2);
  }
  return { c, ox: x0, oy: y0, w: x1 - x0, h: y1 - y0 };
}
const SPR = new Map();
function sprite(key, build, dir, seed) {
  const k = key + ':' + dir.join(',');
  let s = SPR.get(k);
  if (!s) { s = bake(build(), dir, seed || 0); SPR.set(k, s); }
  return s;
}
const blit = (s, cx, cy) => g.drawImage(s.c, Math.round(cx + s.ox), Math.round(cy + s.oy));

// ---------- tweens ----------
// Game logic awaits these; the frame loop advances them.
const TWEENS = [];
function tween(dur, update, easeFn) {
  return new Promise(res => {
    if (SPEED <= 0.02 || dur <= 0) { update(1); res(); return; }
    TWEENS.push({ t0: performance.now(), dur: dur * SPEED, update, ease: easeFn || EASE.inOut, res });
  });
}
function stepTweens(now) {
  for (let i = TWEENS.length - 1; i >= 0; i--) {
    const tw = TWEENS[i], k = clamp((now - tw.t0) / tw.dur, 0, 1);
    tw.update(tw.ease(k));
    if (k >= 1) { TWEENS.splice(i, 1); tw.res(); }
  }
}

// ---------- background: a topographic war-room map under the floating diorama ----------
function buildBackground() {
  const c = bgC.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1c2c38'); grad.addColorStop(0.55, '#121d27'); grad.addColorStop(1, '#0b1219');
  c.fillStyle = grad; c.fillRect(0, 0, W, H);
  // value noise contour lines
  const S = 6, gw = Math.ceil(W / S) + 2, gh = Math.ceil(H / S) + 2;
  const nz = (x, y) => {
    let v = 0, a = 1, f = 1 / 26;
    for (let o = 0; o < 3; o++) {
      const X = x * f, Y = y * f, xi = Math.floor(X), yi = Math.floor(Y), xf = X - xi, yf = Y - yi;
      const s = t => t * t * (3 - 2 * t);
      const h00 = hash(xi, yi, o), h10 = hash(xi + 1, yi, o), h01 = hash(xi, yi + 1, o), h11 = hash(xi + 1, yi + 1, o);
      v += a * lerp(lerp(h00, h10, s(xf)), lerp(h01, h11, s(xf)), s(yf));
      a *= 0.5; f *= 2;
    }
    return v / 1.75;
  };
  const field = [];
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) field.push(nz(i * S, j * S));
  c.fillStyle = 'rgba(120,160,180,.10)';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const i = Math.floor(x / S), j = Math.floor(y / S), fx = (x % S) / S, fy = (y % S) / S;
    const a = field[j * gw + i], b = field[j * gw + i + 1], d = field[(j + 1) * gw + i], e = field[(j + 1) * gw + i + 1];
    const v = lerp(lerp(a, b, fx), lerp(d, e, fx), fy) * 14;
    if (Math.abs(v - Math.round(v)) < 0.045) c.fillRect(x, y, 1, 1);
  }
  // grid ticks like a staff map
  c.fillStyle = 'rgba(150,180,200,.07)';
  for (let x = 0; x < W; x += 48) c.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += 48) c.fillRect(0, y, W, 1);
}
