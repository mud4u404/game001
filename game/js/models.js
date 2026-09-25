'use strict';
// ---------- voxel models ----------
// Model space: +x is the vehicle's front, z is up, one voxel = 2 art pixels across.
const C = {
  tire: '#1c1e20', hub: '#5b6166', glass: '#2a3d52', glassHi: '#7ea3c2', yel: '#f2c230', blue: '#2f6fd1', white: '#e8e8de',
  uaG: '#5f6c38', uaD: '#434b27', uaL: '#6f7d44', ruG: '#6b705a', ruD: '#4a4d3c', ruL: '#7a7f68',
  track: '#2a2b27', wheel: '#55574e', gun: '#343829', skin: '#d8b08a', era: '#737f48', eraR: '#80856b',
};
function wheels(v, xs, y) {
  for (const x of xs) for (const s of [-1, 1]) { v.box(x, x + 1, s * y, s * y, 0, 2, C.tire); v.set(x, s * y, 1, C.hub); }
}
function tracks(v, len, y) {
  for (const s of [-1, 1]) {
    v.box(-len, len, s * y, s * (y + 1), 0, 2, C.track);
    for (let x = -len + 2; x <= len - 2; x += 3) { v.paint(x, s * (y + 1), 1, C.wheel); v.paint(x + 1, s * (y + 1), 1, C.wheel); }
    v.paint(len, s * y, 1, C.wheel); v.paint(-len, s * y, 1, C.wheel);
  }
}
function soldier(v, ox, oy, o) {
  const P = o.pants || '#4b5a31', V = o.vest || '#627240', Hm = o.helmet || '#4d5a33';
  if (o.kneel) { v.box(ox - 1, ox, oy, oy + 1, 0, 0, P); v.box(ox, ox, oy, oy + 1, 1, 1, P); }
  else v.box(ox, ox, oy, oy + 1, 0, 2, P);
  const b = o.kneel ? 2 : 3;
  v.box(ox, ox + 1, oy, oy + 1, b, b + 3, V);
  v.set(ox + 1, oy + 1, b + 2, o.band || C.yel);
  v.set(ox + 1, oy, b + 2, o.band || C.yel);
  v.box(ox - 1, ox - 1, oy, oy + 1, b + 1, b + 3, o.pack || '#3f4a28');
  v.box(ox, ox + 1, oy, oy + 1, b + 4, b + 4, C.skin);
  v.box(ox, ox + 1, oy, oy + 1, b + 5, b + 5, Hm);
  v.set(ox + 2, oy, b + 5, Hm);
  return b;
}

// --- Ukrainian units ---
function mT64() {
  const v = new Vox(), G = C.uaG, D = C.uaD;
  tracks(v, 8, 4);
  v.box(-7, 7, -3, 3, 1, 3, G);
  v.box(-8, 8, -5, 5, 3, 3, G);
  for (let x = -7; x <= 7; x += 2) { v.set(x, 5, 3, C.era); v.set(x, -5, 3, C.era); }
  v.box(-7, 5, -3, 3, 4, 4, G);
  v.box(6, 8, -3, 3, 4, 4, C.era);
  for (let y = -3; y <= 3; y += 2) v.paint(7, y, 4, D);
  for (const x of [-7, -5]) v.box(x, x, -3, 3, 4, 4, D);
  v.box(-9, -9, -3, -2, 3, 4, '#3b3d33'); v.box(-9, -9, 2, 3, 3, 4, '#3b3d33');
  v.ell(-1, 0, 4.3, 3.8, 5, 6, G); v.ell(-1, 0, 3.2, 2.8, 7, 7, G);
  for (let y = -3; y <= 3; y++) { v.set(3, y, 6, y & 1 ? C.era : D); v.set(3, y, 5, y & 1 ? D : C.era); }
  for (let y = -2; y <= 2; y++) v.set(1, y, 8, C.era);
  v.box(-6, -5, -2, 2, 5, 6, D);
  v.box(2, 12, 0, 0, 6, 6, C.gun); v.box(6, 7, 0, 0, 7, 7, '#3d4230'); v.set(13, 0, 6, '#1d1f18');
  v.box(-3, -2, 1, 2, 8, 8, D); v.box(-2, 1, 2, 2, 9, 9, '#2b2c25');
  v.box(-3, -3, -2, 2, 7, 7, C.yel);
  v.paint(-2, 4, 5, C.blue); v.paint(-1, 4, 5, C.blue); v.paint(-2, 4, 5, C.blue);
  return v;
}
function mAtgm() {
  const v = new Vox();
  const b = soldier(v, -3, -3, {});
  v.box(-6, 4, -1, -1, b + 3, b + 3, '#8f9a86'); v.set(4, -1, b + 3, '#2e332c'); v.set(-6, -1, b + 3, '#2e332c');
  v.box(0, 1, -2, -1, b + 4, b + 4, '#3d4436'); // command launch unit
  const b2 = soldier(v, 3, 2, { kneel: true });
  v.box(1, 7, 4, 4, b2 + 3, b2 + 3, '#6f7862'); v.set(7, 4, b2 + 3, '#2e332c'); v.set(3, 4, b2 + 2, '#2e332c');
  v.box(-3, -1, 3, 4, 0, 1, '#6b5a3a'); v.set(-2, 4, 1, C.yel);
  return v;
}
function mD30() {
  const v = new Vox(), G = C.uaG, D = C.uaD;
  for (let k = 1; k <= 8; k++) v.box(-k, -k, 0, 0, 0, k < 3 ? 1 : 0, D);
  for (let k = 1; k <= 7; k++) { const o = Math.round(k * 0.75); v.set(-k + 1, o, 0, D); v.set(-k + 1, -o, 0, D); }
  v.box(-2, 1, -2, 2, 1, 3, G);
  for (const s of [-1, 1]) { v.box(-1, 0, s * 3, s * 3, 0, 2, C.tire); v.set(-1, s * 3, 1, C.hub); }
  v.box(2, 2, -3, 3, 2, 5, G); v.box(2, 2, -1, 1, 3, 4, D);
  v.box(0, 1, -1, 1, 4, 4, D);
  v.box(2, 11, 0, 0, 4, 4, C.gun); v.box(12, 13, -1, 1, 3, 5, '#2b2e25'); v.set(13, 0, 4, '#15160f');
  v.box(-1, 1, -1, 1, 5, 5, G);
  soldier(v, -5, 3, {});
  v.box(-4, -2, -5, -4, 0, 1, '#7a6a44'); v.box(-4, -2, -5, -4, 2, 2, '#6b5a3a');
  v.set(0, 2, 3, C.yel); v.set(0, -2, 3, C.yel);
  return v;
}
function mTB2() {
  const v = new Vox(), G = '#9ba3a8';
  v.box(-4, 4, 0, 0, 0, 1, G); v.set(5, 0, 1, '#2a2d30');
  v.box(0, 1, -9, 9, 2, 2, G);
  v.box(-7, -5, 0, 0, 1, 1, G); v.box(-7, -7, -3, -2, 2, 3, G); v.box(-7, -7, 2, 3, 2, 3, G);
  v.set(3, 0, -1, '#2a2d30');
  return v;
}

function mMagura() {
  const v = new Vox();
  for (let x = -8; x <= 8; x++) {
    const half = x >= 8 ? 0 : x >= 6 ? 1 : 2;
    for (let y = -half; y <= half; y++) for (let z = 0; z <= 2; z++) v.set(x, y, z, z === 0 ? '#3a4046' : '#2a2f33');
  }
  v.box(-4, -4, 0, 0, 3, 6, '#1c1e20'); v.set(-4, 0, 7, '#6f93b3');
  v.box(-9, -9, 0, 0, 0, 1, '#15160f');
  v.box(-2, -2, -2, 2, 2, 2, C.yel);
  return v;
}
function mNeptune() {
  const v = new Vox();
  wheels(v, [-8, -5, -2, 6], 4);
  v.box(-10, 10, -3, 3, 1, 2, C.uaD);
  v.box(7, 11, -3, 3, 3, 8, C.uaG);
  v.box(11, 11, -2, 2, 6, 7, C.glass); v.set(11, -1, 7, C.glassHi);
  for (const s of [-1, 1]) v.box(8, 9, s * 3, s * 3, 6, 7, C.glass);
  v.box(8, 9, -3, 3, 8, 8, C.yel);
  for (let x = -9; x <= 4; x++) for (let y = -3; y <= 2; y++) for (let z = 4; z <= 9; z++)
    v.set(x, y, z, (y === -1 || z === 6) ? C.uaD : C.uaL);
  for (const y0 of [-3, 0]) for (const z0 of [4, 7]) v.box(-9, -9, y0, y0 + 1, z0, z0 + 1, '#1a1c18');
  v.box(5, 6, -3, 3, 3, 5, C.uaD);
  return v;
}

// --- Russian units ---
function mT72() {
  const v = new Vox(), G = C.ruG, D = C.ruD;
  tracks(v, 8, 4);
  v.box(-7, 7, -3, 3, 1, 3, G);
  v.box(-8, 8, -5, 5, 3, 3, G);
  v.box(-8, 7, -5, -5, 2, 2, '#3f4235'); v.box(-8, 7, 5, 5, 2, 2, '#3f4235');
  v.box(-7, 5, -3, 3, 4, 4, G);
  v.box(6, 8, -3, 3, 4, 4, C.eraR);
  for (const x of [-7, -5]) v.box(x, x, -3, 3, 4, 4, D);
  v.box(-9, -9, -3, -2, 3, 4, '#3b3d33'); v.box(-9, -9, 2, 3, 3, 4, '#3b3d33');
  v.ell(-1, 0, 4.4, 3.9, 5, 6, G); v.ell(-1, 0, 3.3, 2.9, 7, 7, G);
  for (let y = -4; y <= 4; y++) if (v.has(3, y, 6) || v.has(2, y, 6)) { v.set(3, y, 6, C.eraR); v.set(4, y, 5, C.eraR); }
  v.box(0, 1, -3, -2, 8, 9, '#3e4234');
  v.box(2, 12, 0, 0, 6, 6, '#3f4233'); v.box(6, 7, 0, 0, 7, 7, '#474a3a'); v.set(13, 0, 6, '#22231d');
  v.box(-3, -2, 1, 2, 8, 8, D); v.box(-2, 0, 2, 2, 9, 9, '#2b2c25');
  v.box(-2, -1, -3, 3, 7, 7, C.white);
  return v;
}
function mBtr(cmd) {
  const v = new Vox(), G = cmd ? '#667058' : '#6a7257', D = '#4b5040';
  wheels(v, [-7, -4, 1, 4], 4);
  v.box(-8, 7, -3, 3, 1, 4, G);
  v.box(8, 8, -3, 3, 1, 3, G); v.box(9, 9, -3, 3, 1, 2, G); v.box(10, 10, -2, 2, 1, 1, D);
  v.box(-7, 5, -3, 3, 5, 5, G);
  for (const s of [-1, 1]) { v.set(3, s * 3, 4, '#2b2e2a'); v.set(-2, s * 3, 3, D); v.set(-5, s * 3, 3, D); }
  if (cmd) {
    v.box(-6, -1, -2, 2, 6, 7, D);
    for (const [x, y] of [[-6, 2], [-4, -2], [2, 2]]) v.box(x, x, y, y, 6, 17, '#2a2c26');
    v.box(3, 4, -1, 0, 6, 6, '#2b2e2a');
  } else {
    v.box(-1, 1, -1, 1, 6, 7, D); v.box(2, 9, 0, 0, 7, 7, '#2b2e25'); v.box(-1, -1, 1, 2, 8, 8, '#2b2e25');
  }
  for (let y = -3; y <= 3; y++) v.paint(-4, y, 5, C.white);
  return v;
}
function mVdv() {
  const v = new Vox(), o = { pants: '#4f5c46', vest: '#5d6b4c', helmet: '#4c5942', band: C.white, pack: '#3e4636' };
  const b = soldier(v, -3, -3, o);
  v.box(-5, 4, -1, -1, b + 3, b + 3, '#52574a'); v.box(4, 5, -2, 0, b + 2, b + 4, '#4b5040');
  const b2 = soldier(v, 3, 1, Object.assign({ kneel: true }, o));
  v.box(3, 8, 3, 3, b2 + 2, b2 + 2, '#2b2e2a');
  soldier(v, -1, 4, o);
  return v;
}
function mGrad() {
  const v = new Vox(), G = '#626a52', D = '#454a38';
  wheels(v, [-7, -4, 5], 4);
  v.box(-9, 9, -3, 3, 1, 2, D);
  v.box(5, 9, -3, 3, 3, 8, G);
  v.box(9, 9, -2, 2, 6, 7, C.glass); v.set(9, -2, 7, C.glassHi);
  for (const s of [-1, 1]) v.box(6, 7, s * 3, s * 3, 6, 7, C.glass);
  v.box(10, 10, -3, 3, 1, 2, '#2b2e2a');
  v.paint(6, 3, 4, C.white); v.paint(7, 3, 5, C.white); v.paint(6, 3, 5, C.white); v.paint(7, 3, 4, C.white);
  v.box(-9, 4, -3, 3, 3, 3, D);
  for (let x = -8; x <= 3; x++) { const lift = Math.floor((x + 8) / 4); v.box(x, x, -4, 4, 4 + lift, 8 + lift, '#5a604a'); }
  for (let y = -4; y <= 4; y++) for (let z = 4; z <= 11; z++) if ((y + z) & 1) { v.paint(3, y, z, '#141612'); v.paint(-8, y, z, '#141612'); }
  return v;
}
function mKa52() {
  const v = new Vox(), G = '#4d5448', D = '#3a4036';
  v.box(-5, 6, -1, 1, 0, 3, G);
  v.box(7, 7, -1, 1, 0, 2, G); v.set(8, 0, 1, '#1e2226'); v.set(8, 0, 0, '#1e2226');
  v.box(3, 5, -1, 1, 4, 4, C.glass); v.set(5, -1, 4, C.glassHi); v.box(2, 2, -1, 1, 4, 4, G);
  v.box(-13, -6, 0, 0, 2, 3, G);
  v.box(-14, -13, 0, 0, 3, 8, D); v.box(-13, -12, -3, 3, 5, 5, D);
  v.box(0, 1, -5, 5, 2, 2, D);
  for (const s of [-1, 1]) { v.box(-1, 3, s * 4, s * 4, 1, 1, '#8a8f93'); v.set(3, s * 4, 1, '#2a2d30'); v.box(0, 2, s * 5, s * 5, 0, 1, '#6f7478'); }
  v.box(-3, 0, -1, 1, 4, 5, D);
  v.box(-1, -1, 0, 0, 6, 9, '#2a2d30');
  v.set(-14, 0, 4, '#b33a2a');
  return v;
}
function mMi8() {
  const v = new Vox(), G = '#5b6650', D = '#454d3c';
  v.box(-6, 6, -2, 2, 0, 5, G);
  v.box(7, 8, -2, 2, 0, 3, G); v.box(7, 8, -2, 2, 4, 4, C.glass); v.set(8, -1, 4, C.glassHi); v.box(9, 9, -1, 1, 1, 3, C.glass);
  for (let x = -4; x <= 4; x += 2) { v.paint(x, 2, 3, C.glass); v.paint(x, -2, 3, C.glass); }
  v.box(-3, 3, -1, 1, 6, 7, D);
  for (const s of [-1, 1]) v.box(-2, 2, s * 3, s * 3, 1, 2, D);
  v.box(-16, -7, 0, 0, 3, 4, G);
  v.box(-17, -16, 0, 0, 4, 9, D);
  v.box(0, 0, 0, 0, 8, 9, '#2a2d30');
  v.set(-16, 1, 6, '#b33a2a');
  for (const s of [-1, 1]) { v.box(4, 4, s * 2, s * 2, -1, -1, '#1d1f21'); v.box(-3, -3, s * 2, s * 2, -1, -1, '#1d1f21'); }
  return v;
}
function mOrlan() {
  const v = new Vox(), G = '#b9bdc0';
  v.box(-3, 4, 0, 0, 0, 1, G); v.set(5, 0, 0, '#2a2d30');
  v.box(0, 1, -8, 8, 2, 2, G);
  v.box(-7, -4, 0, 0, 1, 1, G); v.box(-7, -7, 0, 0, 2, 4, G); v.box(-7, -7, -3, 3, 2, 2, G);
  v.set(-2, 0, -1, '#2a2d30');
  return v;
}
function mCiv() {
  const v = new Vox();
  soldier(v, -3, -2, { pants: '#2f3440', vest: '#7a4a3a', helmet: '#3a2a22', band: '#7a4a3a', pack: '#5a4a3a' });
  soldier(v, 1, 2, { pants: '#3b3b3b', vest: '#3b4f6b', helmet: '#c9c2b0', band: '#3b4f6b', pack: '#3b4f6b' });
  v.box(3, 3, -2, -2, 0, 3, '#2f3440'); v.box(3, 4, -2, -1, 4, 5, '#8a3a4a'); v.box(3, 4, -2, -1, 6, 6, C.skin);
  v.box(-1, 0, -4, -4, 0, 2, '#5a3d28');
  return v;
}

function mRaptor() {
  const v = new Vox();
  for (let x = -11; x <= 11; x++) {
    const half = x >= 11 ? 0 : x >= 10 ? 1 : x >= 9 ? 2 : 3;
    for (let y = -half; y <= half; y++) for (let z = 0; z <= 2; z++) v.set(x, y, z, z === 0 ? '#4a5057' : '#7b838a');
  }
  v.box(-3, 4, -2, 2, 3, 6, '#8a9299');
  for (let x = -3; x <= 4; x++) for (const s of [-1, 1]) v.set(x, s * 2, 5, C.glass);
  for (let y = -2; y <= 2; y++) { v.set(4, y, 5, C.glass); v.set(-3, y, 5, C.glass); }
  v.box(0, 0, 0, 0, 7, 11, '#2a2d30'); v.box(0, 0, -2, 2, 10, 10, '#2a2d30');
  v.box(6, 7, -1, 1, 3, 4, '#5b6166'); v.box(8, 12, 0, 0, 4, 4, '#2b2e2a');
  v.box(-8, -5, 3, 3, 2, 2, C.white); v.box(-8, -5, -3, -3, 2, 2, C.white);
  return v;
}

// --- wrecks: burnt, broken copies of the live model ---
function wreckify(vox, seed) {
  const out = new Vox(), burnt = ['#26221f', '#332c26', '#43372c', '#4d3a2a', '#2c2a28'];
  for (const [x, y, z, c] of vox.m.values()) {
    const h = hash(seed, x * 7 + y, z);
    if (z > 3 && h < 0.18) continue;
    out.set(x, y, z, h < 0.03 ? '#ff7a2a' : burnt[Math.floor(hash(x, y + seed, z) * burnt.length)]);
  }
  return out;
}
// Tanks lose their turret when the ammunition cooks off.
const hullOf = v => v.filter(p => p[2] <= 4);
const turretOf = v => v.filter(p => p[2] >= 5).shift(0, 0, -5);

const UNIT_MODEL = { t64: mT64, atgm: mAtgm, d30: mD30, t72: mT72, btr: () => mBtr(false), cmd: () => mBtr(true), vdv: mVdv, grad: mGrad, ka52: mKa52, mi8: mMi8, orlan: mOrlan, civ: mCiv, magura: mMagura, neptune: mNeptune, raptor: mRaptor };
const MUZZLE = { t64: [13, 0, 6], t72: [13, 0, 6], d30: [13, 0, 4], btr: [9, 0, 7], atgm: [4, -1, 6], vdv: [4, -1, 6], grad: [3, 0, 10], ka52: [3, 4, 1], neptune: [-9, 0, 7], raptor: [12, 0, 4] };

// --- buildings & props ---
function mApt(seed, dmg) {
  const v = new Vox(), W1 = '#cbc5b5', P = '#b2ac9c', RF = '#7d796f';
  const X0 = -8, X1 = 7, Y0 = -6, Y1 = 5, HT = 19;
  const wall = (x, y, z, onX) => ((onX ? y : x) % 4 === 0 || z % 5 === 0) ? P : W1;
  for (let z = 0; z <= HT; z++) {
    for (let x = X0; x <= X1; x++) { v.set(x, Y0, z, wall(x, Y0, z)); v.set(x, Y1, z, wall(x, Y1, z)); }
    for (let y = Y0; y <= Y1; y++) { v.set(X0, y, z, wall(X0, y, z, 1)); v.set(X1, y, z, wall(X1, y, z, 1)); }
  }
  v.box(X0, X1, Y0, Y1, HT + 1, HT + 1, RF);
  for (let x = X0; x <= X1; x++) { v.set(x, Y0, HT + 2, '#9a958a'); v.set(x, Y1, HT + 2, '#9a958a'); }
  for (let y = Y0; y <= Y1; y++) { v.set(X0, y, HT + 2, '#9a958a'); v.set(X1, y, HT + 2, '#9a958a'); }
  v.box(-3, 0, -3, 0, HT + 2, HT + 4, '#a8a293');
  v.box(4, 4, 1, 1, HT + 2, HT + 8, '#3a3f44'); v.box(3, 5, 1, 1, HT + 7, HT + 7, '#3a3f44');
  const lit = (a, b) => hash(seed, a, b) < (dmg ? 0.1 : 0.5) ? '#f7d774' : '#2d3440';
  for (let f = 0; f < 4; f++) {
    const z = f * 5 + 2;
    for (let x = X0 + 1; x + 1 < X1; x += 3) { const c = lit(x, z); v.paint(x, Y1, z, c); v.paint(x + 1, Y1, z, c); v.paint(x, Y1, z + 1, c); v.paint(x + 1, Y1, z + 1, c); }
    for (let y = Y0 + 1; y + 1 < Y1; y += 3) { const c = lit(y + 40, z); v.paint(X1, y, z, c); v.paint(X1, y + 1, z, c); v.paint(X1, y, z + 1, c); v.paint(X1, y + 1, z + 1, c); }
    if (f > 0) for (const x of [X0 + 1, 2]) { v.box(x, x + 3, Y1 + 1, Y1 + 1, z - 1, z - 1, '#9c978a'); v.box(x, x + 3, Y1 + 1, Y1 + 1, z, z, '#8a857a'); }
  }
  v.box(-1, 0, Y1, Y1, 0, 3, '#3a2e24'); v.box(-2, 1, Y1 + 1, Y1 + 2, 4, 4, '#8b877c');
  if (dmg) {
    for (let i = 0; i < 40; i++) {
      const y = Y0 + Math.floor(hash(seed, i, 7) * (Y1 - Y0)), z = 6 + Math.floor(hash(seed, i, 8) * 12);
      v.paint(X1, y, z, hash(seed, i, 9) < 0.5 ? '#1c1a17' : '#3a342d');
    }
    v.box(X1, X1, -2, 1, 11, 14, '#0f0e0c');
    for (let x = 3; x <= X1; x++) for (let y = 1; y <= Y1; y++) for (let z = HT - 1; z <= HT + 2; z++) v.del(x, y, z);
    for (let x = 3; x <= X1; x++) for (let y = 1; y <= Y1; y++) v.set(x, y, HT - 2, '#1b1917');
  }
  return v;
}
const HOUSE_WALL = ['#dcc79c', '#b9cbd6', '#cfd9b4', '#e5d7a8', '#d8c0c0'];
const HOUSE_ROOF = [['#8f3b2a', '#a2472f'], ['#5d666c', '#6d777d'], ['#3f6150', '#4a705d']];
function mHouse(seed, dmg) {
  const v = new Vox(), WL = HOUSE_WALL[Math.floor(hash(seed, 1, 1) * HOUSE_WALL.length)];
  const [RA, RB] = HOUSE_ROOF[Math.floor(hash(seed, 2, 2) * HOUSE_ROOF.length)];
  v.box(-6, 5, -5, 4, 0, 0, '#8d7b62');
  v.box(-6, 5, -5, 4, 1, 6, WL);
  const win = dmg ? '#2d3440' : '#f7d774';
  for (const x of [-4, 1]) { v.box(x, x + 1, 4, 4, 3, 4, win); v.box(x - 1, x + 2, 5, 5, 2, 2, '#f0ece2'); }
  for (const y of [-3, 1]) v.box(5, 5, y, y + 1, 3, 4, win);
  v.box(-1, -1, 4, 4, 1, 3, '#5a3d28');
  for (let k = 0; k <= 5; k++) {
    v.box(-7, 6, -6 + k, 5 - k, 7 + k, 7 + k, k % 2 ? RB : RA);
    if (k < 5) { v.box(-6, -6, -5 + k, 4 - k, 7 + k, 7 + k, WL); v.box(5, 5, -5 + k, 4 - k, 7 + k, 7 + k, WL); }
  }
  v.box(2, 3, -3, -2, 10, 14, '#7a4a3a');
  for (let x = -8; x <= 7; x += 3) v.box(x, x, 8, 8, 0, 2, '#6b5238');
  v.box(-8, 7, 8, 8, 1, 1, '#6b5238');
  if (dmg) { v.box(-2, 1, -1, 1, 10, 12, '#15130f'); for (let x = -2; x <= 1; x++) for (let y = -1; y <= 1; y++) v.del(x, y, 12); }
  return v;
}
function mChurch() {
  const v = new Vox(), WH = '#e7e3d8', GOLD = '#e3b341', BL = '#3b6fb6';
  v.box(-6, 5, -6, 5, 0, 11, WH);
  for (const x of [-4, 1]) v.box(x, x + 1, 5, 5, 4, 8, BL);
  for (const y of [-4, 1]) v.box(5, 5, y, y + 1, 4, 8, BL);
  v.box(-1, 0, 5, 5, 0, 4, '#6a4a2f');
  v.box(-7, 6, -7, 6, 12, 12, '#9aa6ae');
  v.box(-3, 2, -3, 2, 13, 20, WH);
  v.box(2, 2, -1, 0, 16, 18, BL); v.box(-1, 0, 2, 2, 16, 18, BL);
  v.box(-3, 2, -3, 2, 21, 21, '#9aa6ae');
  v.box(-2, 1, -2, 1, 22, 23, BL);
  for (let x = -4; x <= 3; x++) for (let y = -4; y <= 3; y++) for (let z = 24; z <= 30; z++)
    if (((x + 0.5) ** 2 + (y + 0.5) ** 2) / 10.5 + ((z - 25) ** 2) / 20 <= 1) v.set(x, y, z, GOLD);
  v.box(-1, -1, -1, -1, 30, 35, GOLD); v.box(-2, 0, -1, -1, 33, 33, GOLD);
  return v;
}
function mSub() {
  const v = new Vox(), T1 = '#9aa0a3', FIN = '#7c8286', ST = '#3d4248';
  v.box(-9, 8, -9, 8, 0, 0, '#8e9392');
  for (const [x0, y0] of [[-8, -8], [2, -8]]) {
    v.box(x0, x0 + 5, y0, y0 + 5, 1, 6, T1);
    for (let y = y0; y <= y0 + 5; y += 2) for (let z = 2; z <= 5; z++) v.paint(x0 + 5, y, z, FIN);
    for (let x = x0; x <= x0 + 5; x += 2) for (let z = 2; z <= 5; z++) v.paint(x, y0 + 5, z, FIN);
    for (const dx of [1, 4]) { v.box(x0 + dx, x0 + dx, y0 + 2, y0 + 2, 7, 9, '#b8864a'); v.set(x0 + dx, y0 + 2, 10, '#c9d2d8'); }
  }
  for (const [lx, ly] of [[-3, 1], [2, 1], [-3, 6], [2, 6]]) v.box(lx, lx, ly, ly, 1, 30, ST);
  for (let z = 4; z <= 30; z += 5) { v.box(-3, 2, 1, 1, z, z, ST); v.box(-3, 2, 6, 6, z, z, ST); v.box(-3, -3, 1, 6, z, z, ST); v.box(2, 2, 1, 6, z, z, ST); }
  v.box(-8, 7, 3, 4, 28, 28, ST);
  for (const x of [-8, -4, 3, 7]) v.box(x, x, 3, 3, 25, 27, '#c9d2d8');
  v.box(8, 8, -2, 0, 1, 3, C.yel); v.set(8, -1, 2, '#1a1a1a');
  return v;
}
function mHangar(seed, dmg) {
  const v = new Vox(), RF = '#8d949a', RB = '#747b81', WL = '#a3a8a6';
  for (let y = -8; y <= 7; y++) {
    const top = Math.floor(7 + 7 * Math.sqrt(Math.max(0, 1 - ((y + 0.5) / 8.5) ** 2)));
    for (let x = -9; x <= 8; x++) {
      for (let z = 0; z <= top; z++) {
        const edge = x === -9 || x === 8 || y === -8 || y === 7 || z === top;
        if (edge) v.set(x, y, z, z === top ? (x % 3 === 0 ? RB : RF) : WL);
      }
    }
  }
  v.box(8, 8, -5, 4, 0, 8, '#2a2f35');
  for (let y = -5; y <= 4; y += 2) v.paint(8, y, 8, '#f2c230');
  v.box(-2, 1, 7, 7, 0, 3, '#2a2f35');
  if (dmg) for (let i = 0; i < 30; i++) { const x = -8 + Math.floor(hash(seed, i, 1) * 16), y = -6 + Math.floor(hash(seed, i, 2) * 12); for (let z = 10; z <= 15; z++) v.del(x, y, z); v.set(x, y, 7, '#1b1917'); }
  return v;
}
function mRubble(seed) {
  const v = new Vox(), cols = ['#8a857b', '#6f6a61', '#5a5148', '#9a9488', '#6b4a3a'];
  for (let x = -8; x <= 7; x++) for (let y = -7; y <= 6; y++) {
    const d = Math.hypot(x, y) / 10, h = Math.floor(hash(seed, x, y) * 5 * Math.max(0, 1 - d)) + (d < 0.9 ? 1 : 0);
    for (let z = 0; z < h; z++) v.set(x, y, z, d < 0.3 && z === h - 1 ? '#1f1c19' : cols[Math.floor(hash(seed, x + 30, y + z) * cols.length)]);
  }
  v.box(-2, -2, 1, 1, 2, 6, '#6b4a3a'); v.box(3, 3, -2, -2, 1, 5, '#6b4a3a');
  return v;
}
function pine(v, px, py, H, seed) {
  v.box(px, px, py, py, 0, 2, '#5a3d28');
  for (let z = 3; z <= H; z++) {
    const band = (z - 3) % 4, r = (H - z) * 0.33 + 0.6 + (band === 0 ? 0.6 : 0);
    v.ell(px, py, r, r, z, z, band < 2 ? '#2c4a31' : '#3b5f3d');
  }
  for (let z = 3; z <= H; z += 4) for (let x = px - 4; x <= px + 4; x++) for (let y = py - 4; y <= py + 4; y++)
    if (v.has(x, y, z) && !v.has(x, y, z + 1) && hash(seed, x, y + z) < 0.55) v.paint(x, y, z, '#e3e9ec');
  v.set(px, py, H + 1, '#e3e9ec');
}
function birch(v, px, py, H, seed) {
  for (let z = 0; z <= H; z++) v.set(px, py, z, hash(seed, z, 3) < 0.25 ? '#2a2a2a' : '#e6e2d6');
  for (let z = Math.floor(H * 0.45); z <= H + 2; z++) {
    const r = 2.6 - Math.abs(z - H * 0.8) * 0.25;
    for (let x = Math.floor(px - r); x <= px + r; x++) for (let y = Math.floor(py - r); y <= py + r; y++)
      if ((x - px) ** 2 + (y - py) ** 2 <= r * r && hash(seed, x * 5 + y, z) < 0.45) v.set(x, y, z, hash(x, y, z) < 0.5 ? '#6b5334' : '#8a6a3f');
  }
}
function mForest(seed) {
  const v = new Vox();
  const spots = [[-5, -4], [5, -2], [-2, 5], [6, 6]];
  spots.forEach(([px, py], i) => {
    if (i === 3 && hash(seed, 9, 9) < 0.5) return;
    const H = 12 + Math.floor(hash(seed, i, 1) * 7);
    if (hash(seed, i, 4) < 0.3) birch(v, px, py, H - 2, seed + i); else pine(v, px, py, H, seed + i);
  });
  return v;
}
function mBridgeRuin(foot) {
  const v = new Vox(), CON = '#8a8680', DK = '#5c5953';
  for (let x = -10; x <= 9; x++) {
    if (x >= -2 && x <= 1) continue;
    const jag = Math.abs(x + 0.5) < 5;
    for (let y = -5; y <= 5; y++) { if (jag && hash(x, y, 3) < 0.35) continue; v.box(x, x, y, y, 0, 1, CON); }
    v.set(x, -5, 2, DK); v.set(x, 5, 2, DK);
  }
  for (const x of [-8, 6]) v.box(x, x + 1, -3, 3, -6, -1, '#6f6b65');
  v.box(-2, 1, -4, 4, -4, -3, '#77736c');
  if (foot) { v.box(-3, 2, -1, 1, -1, -1, '#7a5a3a'); for (let x = -3; x <= 2; x += 2) v.paint(x, 0, -1, '#5e432a'); v.box(-3, 2, 1, 1, 0, 0, '#4a3a2a'); }
  return v;
}
function mCrate(seed) {
  const v = new Vox();
  v.box(-3, 2, -2, 1, 0, 2, '#6b5a3a'); v.box(-3, 2, -2, 1, 3, 3, '#7a6a44');
  return v;
}
