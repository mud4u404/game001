'use strict';
// ---------- 3D battlefield ----------
// Tiles, buildings, props and units are rendered with three.js on the #gl canvas under the 2D art canvas.
// The orthographic camera reproduces the 2:1 projection of center() exactly, so picking and every 2D
// overlay (intents, HP pips, particles, text) still line up. Tile highlights are painted into a floor
// texture so they sit under the units. If WebGL is unavailable the game keeps the old 2D renderer.
const TS = 20;                    // world units per tile
const KA = 2 * Math.SQRT2;        // art px per screen unit (40 art px per tile step / 14.14 units)
const KY = KA * Math.cos(Math.PI / 6);  // art px per world unit of height
const V3 = { on: false };

function init3D() {
  try {
    // ?2d forces the old renderer (the logic playtest uses it: software WebGL is too slow headless)
    if (!window.THREE || /[?&]2d\b/.test(location.search)) return;
    const canvas = document.getElementById('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(1);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.94;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    // soft sky gradient for reflections and fill light
    const env = new THREE.Scene(), eg = new THREE.SphereGeometry(50, 32, 16), col = [];
    const top = lin('#b9d3ee'), mid = lin('#8b98a3'), bot = lin('#3b3328'), p = eg.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 50, c = y > 0 ? mid.clone().lerp(top, y) : mid.clone().lerp(bot, -y); col.push(c.r, c.g, c.b); }
    eg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    env.add(new THREE.Mesh(eg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.02).texture;
    scene.add(new THREE.HemisphereLight(lin('#dce9f7'), lin('#40362a'), 0.42));
    // light from the upper left of the screen, as in the old voxel shading
    const sun = new THREE.DirectionalLight(lin('#ffeed8'), 2.3);
    sun.position.set(-40, 90, 50); sun.target.position.set(70, 0, 70);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 1, far: 320 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    scene.add(sun, sun.target);
    const bgTex = new THREE.CanvasTexture(bgC); bgTex.encoding = THREE.sRGBEncoding;
    scene.background = bgTex;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    const board = new THREE.Group(), units = new THREE.Group();
    scene.add(board, units);
    // floor overlay: 64 px per tile, drawn every frame
    const floorC = mkCanvas(512, 512), fg = floorC.getContext('2d');
    const floorTex = new THREE.CanvasTexture(floorC); floorTex.encoding = THREE.sRGBEncoding; floorTex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8 * TS, 8 * TS), new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false, toneMapped: false }));
    floor.rotation.x = -HALF_PI; floor.position.set(3.5 * TS, 0.12, 3.5 * TS); floor.renderOrder = 2;
    scene.add(floor);
    // fixed pool of point lights for explosions and burning wrecks (a constant light count avoids shader recompiles)
    const flashes = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(lin('#ffb257'), 0, 90, 2); scene.add(l); flashes.push({ l, t0: 0, dur: 1, peak: 0 }); }
    Object.assign(V3, { flashes, fires: [] });
    Object.assign(V3, { on: true, canvas, renderer, scene, cam, sun, bgTex, board, units, floorC, fg, floorTex, tiles: new Map(), objs: new Map(), battle: null, decals: 0 });
  } catch (e) {
    console.warn('3D renderer unavailable, using 2D', e);
    V3.on = false;
  }
}

// ---------- camera: art space <-> world ----------
function size3D() {
  if (!V3.on) return;
  V3.renderer.setSize(W * PX, H * PX, false);
  V3.canvas.style.width = stage.style.width; V3.canvas.style.height = stage.style.height;
  V3.bgTex.needsUpdate = true;
}
function place3D() {
  const cam = V3.cam;
  cam.left = -W / (2 * KA); cam.right = W / (2 * KA); cam.top = H / (2 * KA); cam.bottom = -H / (2 * KA);
  cam.updateProjectionMatrix();
  // ground point under the middle of the art canvas, in tile coordinates
  const d = (W / 2 - OX) / TW, s = (H / 2 - OY - TH) / TH, tx = (s + d) / 2, ty = (s - d) / 2;
  const el = Math.PI / 6, az = Math.PI / 4, R = 800;
  const tgt = new THREE.Vector3(tx * TS, 0, ty * TS);
  cam.position.set(tgt.x + Math.cos(el) * Math.sin(az) * R, Math.sin(el) * R, tgt.z + Math.cos(el) * Math.cos(az) * R);
  cam.lookAt(tgt);
}
// art-space offset (dx, dy px on the ground) -> world offset
function artToWorld(dx, dy) { const a = dx / TW, b = dy / TH; return [(a + b) / 2 * TS, (b - a) / 2 * TS]; }

// ---------- voxel fallback ----------
const VOXGEO = new Map();
function voxGroup(key, build) {
  let src = VOXGEO.get(key);
  if (!src) {
    const vox = build(), list = [];
    for (const p of vox.m.values()) {
      const [x, y, z] = p;
      if (vox.has(x + 1, y, z) && vox.has(x - 1, y, z) && vox.has(x, y + 1, z) && vox.has(x, y - 1, z) && vox.has(x, y, z + 1) && vox.has(x, y, z - 1)) continue;
      list.push(p);
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0.02, envMapIntensity: 0.5 }), Math.max(1, list.length));
    const m = new THREE.Matrix4(), c = new THREE.Color();
    list.forEach(([x, y, z, col], i) => {
      m.makeTranslation(x, z + 0.5, y); mesh.setMatrixAt(i, m);
      c.copy(lin(col)).multiplyScalar(0.94 + hash(x, y, z) * 0.12); mesh.setColorAt(i, c);
    });
    if (!list.length) mesh.count = 0;
    mesh.castShadow = mesh.receiveShadow = true;
    src = mesh; VOXGEO.set(key, src);
  }
  const g = new THREE.Group(), m = src.clone();
  g.add(m);
  g.scale.set(1, 2 / KY, 1);   // old voxels were 2 art px tall
  return g;
}

// ---------- models ----------
const MODELCACHE = new Map();
function modelFor(key, build3, buildVox) {
  let src = MODELCACHE.get(key);
  if (!src) { src = build3 ? build3() : voxGroup('v:' + key, buildVox); MODELCACHE.set(key, src); }
  return src.clone(true);
}
// Hand-built infantry is drawn 1.3x life size so squads stay readable next to vehicles (voxel fallbacks are already oversized).
const INF_SCALE = 1.3;
function unitModel(type) {
  const o = modelFor('u:' + type, MODEL3D[type], UNIT_MODEL[type]);
  if (MODEL3D[type] && UNITS[type] && UNITS[type].cls === 'inf') o.scale.multiplyScalar(INF_SCALE);
  return o;
}
// Height of a unit model in art px, for placing the HP bar.
const TOPPX = new Map();
function unitTopPx(type) {
  let v = TOPPX.get(type);
  if (v == null) { const b = new THREE.Box3().setFromObject(unitModel(type)); v = b.max.y * KY; TOPPX.set(type, v); }
  return v;
}
// Per-instance materials so alpha, dimming and hit flashes can be set per unit.
function ownMaterials(obj) {
  const mats = [];
  obj.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.userData.base = o.material.color.clone();
    mats.push(o.material);
  });
  return mats;
}
const BURNT = () => new THREE.MeshStandardMaterial({ color: lin('#2b2723'), roughness: 1, metalness: 0.1 });
function charred(obj) {
  const m = BURNT();
  obj.traverse(o => { if (o.isMesh) { o.material = m; if (o.isInstancedMesh && o.instanceColor) { o.instanceColor = null; } } });
  return obj;
}
function wreckModel(w) {
  const o = unitModel(w.type);
  const t = o.getObjectByName('turret');
  if (t) t.visible = false;
  else if (!MODEL3D[w.type]) return modelFor('wk:' + w.type, null, () => wreckify((w.type === 't72' || w.type === 't64') ? hullOf(UNIT_MODEL[w.type]()) : UNIT_MODEL[w.type](), 7));
  return charred(o);
}
function turretModel(type) {
  if (MODEL3D[type]) { const o = unitModel(type), t = o.getObjectByName('turret'); if (t) { const g = new THREE.Group(); t.position.set(0, 0, 0); g.add(t); return charred(g); } }
  return modelFor('tu:' + type, null, () => wreckify(turretOf(UNIT_MODEL[type]()), 9));
}
function buildingModel(tile, seed) {
  const st = tile.hp <= 0 ? 'x' : tile.hp < tile.max ? 'd' : 'n';
  const b3 = MODEL3D['bld:' + tile.t];
  if (st === 'x') return modelFor('rubble' + (seed % 6), MODEL3D['bld:rubble'] && (() => MODEL3D['bld:rubble'](seed)), () => mRubble(seed));
  const dmg = st === 'd';
  const key = `b:${tile.t}${st}${tile.t === 'b' || tile.t === 'h' || tile.t === 'H' ? seed : ''}`;
  let vox;
  if (tile.t === 'b') vox = () => mApt(seed, dmg);
  else if (tile.t === 'h') vox = () => mHouse(seed, dmg);
  else if (tile.t === 'H') vox = () => mHangar(seed, dmg);
  else if (tile.t === 'c') vox = mChurch;
  else vox = mSub;
  return modelFor(key, b3 && (() => b3(seed, dmg)), vox);
}

// ---------- tiles ----------
const TILE3 = {
  '.': '#8c7a55', r: '#6a6964', R: '#66665f', f: '#5f5e42', w: '#2d6592', o: '#245a82', s: '#c9b88a', d: '#2d6592', B: '#85827a',
};
function tileSig(x, y) {
  const t = TILEAT(x, y);
  return `${t.t}|${t.hp}|${t.crater ? 1 : 0}|${t.wreck ? t.wreck.type + t.wreck.face : ''}`;
}
// T-34: ground details per tile type, all deterministic via hash, max 15 meshes per tile.
function tileDetails(g, x, y, t, seed) {
  const SNOW = mat3('#edf1f3', 0.75), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  const SH = mat3('#55544f', 0.9), POT = mat3('#3c3b37', 1), DSN = mat3('#c9ccc8', 0.85);
  const FUR = mat3('#6d5c40', 0.95), TUFT = mat3('#8a7a4a', 0.9), LOG = mat3('#5a4632', 0.9), BUSH = mat3('#2f4a33', 0.9);
  const RIP = mat3('#d6c79c', 0.95), PEB = mat3('#8d8a80', 0.9), DRIFT = mat3('#7a6a58', 0.9), LAMP = mat3('#f2c230', 0.4, 0, { emissive: lin('#f0ad3a'), emissiveIntensity: 0.7 });
  const NOSEA = (tx, ty) => {
    if (!inB(tx, ty)) return false;
    const nt = TILEAT(tx, ty);
    return !isWater(nt) && nt.t !== 'd';
  };
  const flat = (geo, m, px, py, pz, rx, ry, rz) => { const o = part(g, geo, m, px, py, pz, rx, ry, rz); o.castShadow = false; return o; };
  const edges = [];
  // grid x is world x, grid y is world z
  if (NOSEA(x, y - 1)) edges.push([0, -9.3]);
  if (NOSEA(x, y + 1)) edges.push([0, 9.3]);
  if (NOSEA(x - 1, y)) edges.push([-9.3, 0]);
  if (NOSEA(x + 1, y)) edges.push([9.3, 0]);
  if (isWater(t) || t.t === 'd') {
    // foam along every land edge, plus a tilted mud bank hiding the seam
    for (const [ex, ez] of edges) {
      // an edge at x = +-9.3 runs along z, one at z = +-9.3 along x; the bank rises toward the land side
      const alongZ = ex !== 0;
      flat(new THREE.BoxGeometry(alongZ ? 1.2 : 19, 0.12, alongZ ? 19 : 1.2), mat3('#e6eef2', 0.6, 0, { transparent: true, opacity: 0.75 }), ex * 0.97, -1.72, ez * 0.97);
      flat(new THREE.BoxGeometry(alongZ ? 2.2 : 19.4, 0.25, alongZ ? 19.4 : 2.2), mat3('#5a4a36', 0.95), ex * 1.02, -1.55, ez * 1.02, alongZ ? 0 : (ez > 0 ? -0.6 : 0.6), 0, alongZ ? (ex > 0 ? 0.6 : -0.6) : 0);
    }
    if (t.t === 'w') for (let k = 0; k < 2 + Math.floor(hash(x, y, 31) * 3); k++) {
      const ice = flat(cyl(0.8 + hash(x, y, 40 + k) * 1.0, 0.8 + hash(x, y, 41 + k) * 0.8, 0.14, 9), mat3('#dfe9ee', 0.5), -7 + hash(x, y, 42 + k) * 14, -1.75, -7 + hash(y, x, 43 + k) * 14);
      ice.rotation.y = hash(x, y, 44 + k) * 3;
    }
    if (t.t === 'o') for (let k = 0; k < 2 + Math.floor(hash(x, y, 45) * 2); k++)
      flat(new THREE.BoxGeometry(3 + hash(x, y, 46 + k) * 3, 0.08, 0.4), mat3('#e6eef2', 0.6, 0, { transparent: true, opacity: 0.6 }), -6 + hash(x, y, 50 + k) * 12, -1.7, -6 + hash(y, x, 51 + k) * 12);
    return;
  }
  if (t.t === 'r') {
    const alongX = isRoadT(x - 1, y) || isRoadT(x + 1, y), alongY = isRoadT(x, y - 1) || isRoadT(x, y + 1);
    const SH = mat3('#55544f', 0.9), POT = mat3('#3c3b37', 1), DSN = mat3('#c9ccc8', 0.85);
    if (alongX || !alongY) for (const ez of [-8.8, 8.8]) {
      flat(new THREE.BoxGeometry(19.6, 0.06, 1.4), SH, 0, 0.04, ez);
      for (let k = 0; k < 2 + Math.floor(hash(x, y, 60 + ez) * 3); k++) flat(sph(0.5 + hash(x, ez, 61 + k) * 0.45, 10, 6), DSN, -8 + hash(ez, x, 62 + k) * 16, 0.12, ez + (hash(x, y, 63 + k) - 0.5) * 1.4).scale.y = 0.45;
    }
    if (alongY || !alongX) for (const ex of [-8.8, 8.8]) {
      flat(new THREE.BoxGeometry(1.4, 0.06, 19.6), SH, ex, 0.04, 0);
      for (let k = 0; k < 2 + Math.floor(hash(x, y, 64 + ex) * 3); k++) flat(sph(0.5 + hash(ex, x, 65 + k) * 0.45, 10, 6), DSN, ex + (hash(x, y, 66 + k) - 0.5) * 1.4, 0.12, -8 + hash(ex, y, 67 + k) * 16).scale.y = 0.45;
    }
    for (let k = 0; k < Math.floor(hash(x, y, 70) * 3); k++)
      flat(cyl(0.5 + hash(x, y, 71 + k) * 0.4, 0.6 + hash(x, y, 72 + k) * 0.4, 0.06, 10), POT, -7 + hash(x, y, 73 + k) * 14, 0.05, -7 + hash(y, x, 74 + k) * 14);
    return;
  }
  if (t.t === 'R') {
    const up = inB(x, y - 1) && TILEAT(x, y - 1).t === 'R', dn = inB(x, y + 1) && TILEAT(x, y + 1).t === 'R';
    for (const [ez, has] of [[-9.3, !up], [9.3, !dn]]) {
      if (!has) continue;
      for (let k = 0; k < 3; k++) {
        const lx = -6.5 + k * 6.5;
        flat(cyl(0.09, 0.11, 0.5, 8), DKS, lx, 0.25, ez);
        part(g, sph(0.16, 10, 8), LAMP, lx, 0.58, ez).castShadow = false;
      }
    }
    return;
  }
  if (t.t === '.') {
    const alongX = hash(x, y, 80) < 0.5, FUR = mat3('#6d5c40', 0.95), TUFT = mat3('#8a7a4a', 0.9);
    for (let k = 0; k < 3; k++) {
      const off = -6.5 + k * 6.5 + hash(x, y, 81 + k) * 2;
      if (alongX) flat(new THREE.BoxGeometry(19, 0.05, 0.9), FUR, 0, 0.03, off);
      else flat(new THREE.BoxGeometry(0.9, 0.05, 19), FUR, off, 0.03, 0);
    }
    for (let k = 0; k < 10; k++) {
      const tx = -8.5 + hash(x, y, 85 + k) * 17, tz = -8.5 + hash(y, x, 95 + k) * 17;
      flat(cyl(0.045, 0.14, 0.6 + hash(x, y, 105 + k) * 0.6, 6), TUFT, tx, 0.3 + hash(x, y, 115 + k) * 0.1, tz, (hash(x, y, 116 + k) - 0.5) * 0.3, 0, (hash(y, x, 117 + k) - 0.5) * 0.3);
    }
    return;
  }
  if (t.t === 'f') {
    const LOG = mat3('#5a4632', 0.9), BUSH = mat3('#2f4a33', 0.9);
    const la = hash(x, y, 120) * Math.PI;
    const log = flat(cyl(0.32, 0.38, 4 + hash(x, y, 121) * 2, 10), LOG, -5 + hash(x, y, 122) * 6, 0.35, -5 + hash(y, x, 123) * 6, 0, 0, HALF_PI);
    log.rotation.y = la;
    for (let k = 0; k < 3 + Math.floor(hash(x, y, 124) * 2); k++) {
      const bu = flat(sph(0.55 + hash(x, y, 125 + k) * 0.4, 10, 6), BUSH, -7 + hash(x, y, 130 + k) * 14, 0.3, -7 + hash(y, x, 135 + k) * 14).scale.y = 0.6;
      if (k < 2) flat(sph(0.4, 8, 6), SNOW, -7 + hash(x, y, 140 + k) * 14, 0.62, -7 + hash(y, x, 141 + k) * 14).scale.y = 0.4;
    }
    return;
  }
  if (t.t === 's') {
    const RIP = mat3('#d6c79c', 0.95), PEB = mat3('#8d8a80', 0.9), DRIFT = mat3('#7a6a58', 0.9);
    for (let k = 0; k < 3 + Math.floor(hash(x, y, 150) * 2); k++) {
      const off = -6 + k * 3.4 + hash(x, y, 151 + k) * 1.2;
      if (hash(x, y, 155) < 0.5) flat(new THREE.BoxGeometry(19, 0.05, 0.8), RIP, 0, 0.03, off);
      else flat(new THREE.BoxGeometry(0.8, 0.05, 19), RIP, off, 0.03, 0);
    }
    for (let k = 0; k < 5 + Math.floor(hash(x, y, 160) * 4); k++)
      flat(sph(0.22 + hash(x, y, 161 + k) * 0.2, 8, 6), mat3('#8d8a80', 0.9), -8 + hash(x, y, 162 + k) * 16, 0.1, -8 + hash(y, x, 163 + k) * 16).scale.y = 0.55;
    if (hash(x, y, 170) < 0.5) {
      const dr = flat(cyl(0.22, 0.26, 4.6, 10), DRIFT, -6 + hash(x, y, 171) * 8, 0.24, -5 + hash(y, x, 172) * 7, 0, 0, HALF_PI);
      dr.rotation.y = hash(x, y, 173) * Math.PI;
    }
  }
}

function buildTile(x, y) {
  const g = new THREE.Group(), t = TILEAT(x, y), seed = x * 8 + y + B.mi * 64;
  g.position.set(x * TS, 0, y * TS);
  const water = isWater(t) || t.t === 'd';
  const topC = BLD[t.t] ? TILE3.B : TILE3[t.t] || TILE3['.'];
  if (water) {
    part(g, rbox(TS - 0.2, TS - 0.2, 5, 0.5), mat3('#3d3326', 1), 0, -5.5, 0, HALF_PI);
    const wm = part(g, new THREE.BoxGeometry(TS, 1, TS), mat3(t.t === 'o' ? '#245a82' : '#2d6592', 0.12, 0.1), 0, -2.3, 0);
    wm.castShadow = false;
  } else {
    // slight per-tile tint so fields and roads are not one flat colour (three steps keep materials shared)
    const tint = ['#000000', '#101010', '#ffffff'][Math.floor(hash(x, y, 17) * 3)];
    part(g, rbox(TS - 0.3, TS - 0.3, 1.2, 0.5), mat3(tint === '#000000' ? topC : shade(topC, tint === '#ffffff' ? 0.05 : -0.05), t.t === 'r' || t.t === 'R' ? 0.85 : 0.95), 0, -0.6, 0, HALF_PI);
    part(g, rbox(TS - 0.3, TS - 0.3, 6, 0.3), mat3('#3f3427', 1), 0, -4.2, 0, HALF_PI);
    const SNOW = mat3('#edf1f3', 0.75);
    if (t.t === '.' || t.t === 'f') for (let i = 0; i < 6; i++) part(g, sph(0.8 + hash(x, y, i) * 1.5, 12, 6), SNOW, -8 + hash(i, x, y) * 16, -0.1, -8 + hash(y, i, x) * 16).scale.y = 0.2;
    if (t.t === 'r') {
      const alongX = isRoadT(x - 1, y) || isRoadT(x + 1, y), alongY = isRoadT(x, y - 1) || isRoadT(x, y + 1);
      const LINE = mat3('#dcd8c8', 0.7);
      for (let i = 0; i < 3; i++) {
        if (alongX || !alongY) part(g, new THREE.BoxGeometry(3.2, 0.06, 0.45), LINE, -6.5 + i * 6.5, 0.03, 0);
        if (alongY) part(g, new THREE.BoxGeometry(0.45, 0.06, 3.2), LINE, 0, 0.03, -6.5 + i * 6.5);
      }
    }
    if (t.t === 'R') {
      const up = inB(x, y - 1) && TILEAT(x, y - 1).t === 'R', dn = inB(x, y + 1) && TILEAT(x, y + 1).t === 'R';
      const LINE = mat3('#e4e2d8', 0.7);
      if (!up) part(g, new THREE.BoxGeometry(TS - 1, 0.06, 0.5), LINE, 0, 0.03, -8.6);
      if (!dn) part(g, new THREE.BoxGeometry(TS - 1, 0.06, 0.5), LINE, 0, 0.03, 8.6);
      else for (let i = 0; i < 2; i++) part(g, new THREE.BoxGeometry(4, 0.06, 0.5), LINE, -5 + i * 10, 0.03, 9.9);
    }
    if (t.crater) {
      const c = part(g, cyl(5.2, 4.2, 0.5, 20), mat3('#2a241d', 1), (hash(seed, 1, 1) - 0.5) * 6, 0.05, (hash(seed, 2, 2) - 0.5) * 6);
      c.castShadow = false;
      for (let i = 0; i < 8; i++) { const a = hash(seed, i, 3) * 6.28, r = 5 + hash(seed, i, 4) * 2; part(g, sph(0.5 + hash(i, seed, 5) * 0.5, 8, 5), mat3('#3b3228', 1), c.position.x + Math.cos(a) * r, 0.1, c.position.z + Math.sin(a) * r).scale.y = 0.5; }
    }
  }
  tileDetails(g, x, y, t, seed);
  // props on the tile
  if (t.t === 'f') g.add(modelFor('forest' + seed, MODEL3D['prop:forest'] && (() => MODEL3D['prop:forest'](seed)), () => mForest(seed)));
  else if (t.t === 'd') g.add(modelFor('bridgeRuin', MODEL3D['prop:bridge'], () => mBridgeRuin(true)));
  else if (BLD[t.t]) g.add(buildingModel(t, seed));
  if (t.wreck) {
    const w = wreckModel(t.wreck);
    w.rotation.y = -Math.atan2(t.wreck.face[1], t.wreck.face[0]);
    g.add(w);
  }
  return g;
}
function syncBoard() {
  if (V3.battle !== B) {
    for (const o of V3.board.children.slice()) V3.board.remove(o);
    V3.tiles.clear(); V3.battle = B;
    for (const o of V3.units.children.slice()) V3.units.remove(o);
    V3.objs.clear();
  }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const k = x + y * 8, sig = tileSig(x, y), cur = V3.tiles.get(k);
    if (cur && cur.sig === sig) continue;
    if (cur) V3.board.remove(cur.obj);
    const obj = buildTile(x, y);
    V3.board.add(obj); V3.tiles.set(k, { sig, obj });
  }
}

// ---------- units ----------
function syncUnits() {
  const seen = new Set();
  for (const u of B.units) {
    seen.add(u);
    let rec = V3.objs.get(u);
    if (!rec || rec.type !== u.type) {
      if (rec) V3.units.remove(rec.obj);
      const obj = unitModel(u.type);
      rec = { obj, type: u.type, mats: ownMaterials(obj), spin: [] };
      obj.traverse(o => { if (/^rotor[XYZ]/.test(o.name)) rec.spin.push(o); });
      V3.objs.set(u, rec); V3.units.add(obj);
    }
    const [fx, fz] = u.face, rec5 = u.recoil * 5 / KA;
    const alt = (unitAlt(u) + u.rz) / KY;
    rec.obj.position.set(u.rx * TS - fx * rec5 * 1.4, alt, u.ry * TS - fz * rec5 * 1.4);
    rec.obj.rotation.y = -Math.atan2(fz, fx);
    rec.obj.visible = u.alpha > 0.05;
    // rotors: name a group rotorY / rotorYr (counter-rotating) / rotorX / rotorZ to spin it about that local axis
    for (const o of rec.spin) { const k = (o.name.endsWith('r') ? -1 : 1) * performance.now() * 0.03; o.rotation[o.name[5].toLowerCase()] = k; }
    const dim = u.team === 'ua' && u.acted && B.phase === 'player' ? 0.55 : 1;
    const fade = u.alpha < 0.999;
    for (const m of rec.mats) {
      m.color.copy(m.userData.base).multiplyScalar(dim);
      m.emissive.setRGB(u.flash, u.flash, u.flash);
      m.transparent = fade; m.opacity = u.alpha;
    }
  }
  for (const [u, rec] of V3.objs) if (!seen.has(u)) { V3.units.remove(rec.obj); V3.objs.delete(u); }
  // flying turrets of destroyed tanks
  V3.debris = V3.debris || new Map();
  const dseen = new Set();
  for (const d of B.debris) {
    dseen.add(d);
    let o = V3.debris.get(d);
    if (!o) { o = turretModel(d.type); V3.debris.set(d, o); V3.units.add(o); }
    const [wx, wz] = artToWorld(d.ox, d.oy);
    o.position.set(d.x * TS + wx, d.z / KY, d.y * TS + wz);
    o.rotation.y = -Math.atan2(d.face[1], d.face[0]);
  }
  for (const [d, o] of V3.debris) if (!dseen.has(d)) { V3.units.remove(o); V3.debris.delete(d); }
}

// ---------- floor overlay (tile highlights under the units) ----------
const FT = 64;
function floorBegin() { V3.fg.clearRect(0, 0, 512, 512); }
function floorFill(x, y, c) { const g = V3.fg; g.fillStyle = c; g.fillRect(x * FT + 2, y * FT + 2, FT - 4, FT - 4); }
// size follows the old outlineDia width: 40 = the whole tile, smaller = inset
function floorLine(x, y, c, sz, lw) {
  const g = V3.fg, i = (40 - sz) / 40 * FT / 2 + 2;
  g.strokeStyle = c; g.lineWidth = lw || 3;
  g.strokeRect(x * FT + i, y * FT + i, FT - 2 * i, FT - 2 * i);
}
function floorHatch(x, y, c) {
  const g = V3.fg;
  g.save(); g.beginPath(); g.rect(x * FT + 3, y * FT + 3, FT - 6, FT - 6); g.clip();
  g.strokeStyle = c; g.lineWidth = 5;
  for (let k = -FT; k < FT * 2; k += 14) { g.beginPath(); g.moveTo(x * FT + k, y * FT); g.lineTo(x * FT + k - FT, y * FT + FT); g.stroke(); }
  g.restore();
}

// ---------- fly-overs ----------
// The TB2 of an air strike: the rules keep it as a 2D projectile (art-space x, y); here it gets a 3D body
// flying about 60 units above the ground point under that art position.
const TB2_ALT = 60;
function syncPlanes() {
  V3.planes = V3.planes || new Map();
  const seen = new Set();
  for (const p of PROJ) {
    if (p.kind !== 'tb2') continue;
    seen.add(p);
    let o = V3.planes.get(p);
    if (!o) { o = m3TB2(); o.traverse(q => { if (q.name === 'rotorX') o.userData.prop = q; }); V3.planes.set(p, o); V3.units.add(o); }
    const d = (p.x - OX) / TW, s = (p.y + TB2_ALT * KY - OY - TH) / TH;
    o.position.set((s + d) / 2 * TS, TB2_ALT, (s - d) / 2 * TS);
    o.rotation.y = Math.PI / 4;
    o.userData.prop.rotation.x = performance.now() * 0.05;
  }
  for (const [p, o] of V3.planes) if (!seen.has(p)) { V3.units.remove(o); V3.planes.delete(p); }
}

// ---------- lights ----------
// Explosion flash at tile (x, y), size 1..3, alt in art px.
function flash3D(x, y, size, alt) {
  if (!V3.on || !V3.flashes) return;
  const f = V3.flashes.reduce((a, b) => (a.t0 + a.dur < b.t0 + b.dur ? a : b));
  f.l.position.set(x * TS, 3 + (alt || 0) / KY + size, y * TS);
  f.t0 = performance.now(); f.dur = (260 + size * 140) * Math.max(SPEED, 0.2); f.peak = 2.2 + size * 1.4;
}
function stepLights(now) {
  for (const f of V3.flashes) {
    const k = (now - f.t0) / f.dur;
    f.l.intensity = k >= 0 && k < 1 ? f.peak * (1 - k) * (1 - k) : 0;
  }
  // burning wrecks flicker: reuse an idle light for up to two of them
  let n = 0;
  for (let y = 0; y < 8 && n < 2; y++) for (let x = 0; x < 8 && n < 2; x++) {
    if (!TILEAT(x, y).wreck) continue;
    const f = V3.flashes.find(q => q.l.intensity === 0 && !q.used);
    if (!f) break;
    f.used = true; n++;
    f.l.position.set(x * TS, 3, y * TS);
    f.l.intensity = 0.9 + Math.sin(now / 70 + x * 3) * 0.25 + Math.sin(now / 23 + y) * 0.15;
  }
  for (const f of V3.flashes) f.used = false;
}

// ---------- frame ----------
function render3D(sx, sy) {
  if (!V3.on) return;
  syncBoard();
  syncUnits();
  syncPlanes();
  stepLights(performance.now());
  V3.floorTex.needsUpdate = true;
  place3D();
  V3.canvas.style.transform = sx || sy ? `translate(${sx * PX / (window.devicePixelRatio || 1)}px,${sy * PX / (window.devicePixelRatio || 1)}px)` : '';
  V3.renderer.render(V3.scene, V3.cam);
}
function show3D(on) { if (V3.on) V3.canvas.hidden = !on; }
