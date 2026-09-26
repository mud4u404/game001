'use strict';
// ---------- smooth 3D models ----------
// World units: one tile is 20 units wide (the old voxel grid). +x is the vehicle's front, +y is up,
// +z is the vehicle's left side as seen from behind. Every model stands on y = 0, centred on the tile.
// A model builder returns a THREE.Group. Name the turret group 'turret' so wrecks can drop it.
// Units or buildings without an entry in MODEL3D fall back to their voxel model (models.js).

const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
const HALF_PI = Math.PI / 2;

// ---------- kit ----------
const MAT3 = new Map();
// Shared material: colour, roughness, metalness, extra MeshStandardMaterial options.
function mat3(c, r, m, extra) {
  const k = c + '|' + r + '|' + m + '|' + (extra ? JSON.stringify(extra) : '');
  let v = MAT3.get(k);
  if (!v) { v = new THREE.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: r == null ? 0.7 : r, metalness: m || 0, envMapIntensity: 0.6 }, extra || {})); MAT3.set(k, v); }
  return v;
}
// Add a mesh to a parent at (x, y, z) with optional Euler rotation; casts and receives shadows.
function part(parent, geo, mat, x, y, z, rx, ry, rz) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  if (rx) o.rotation.x = rx;
  if (ry) o.rotation.y = ry;
  if (rz) o.rotation.z = rz;
  o.castShadow = o.receiveShadow = true;
  parent.add(o);
  return o;
}
// Rounded box: w along x, h along y, d along z, corner radius r.
function rbox(w, h, d, r, seg) {
  r = Math.max(0.01, Math.min(r, w / 2 - 0.01, h / 2 - 0.01));
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const b = Math.min(r, d / 2 - 0.01);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, d - 2 * b), bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: seg || 2, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}
// Side profile [[x, y], ...] extruded to depth d along z (centred), with a small bevel.
function profile(pts, d, bevel) {
  bevel = bevel == null ? 0.15 : bevel;
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 });
  g.translate(0, 0, -(d - 2 * bevel) / 2);
  return g;
}
const cyl = (r1, r2, h, n) => new THREE.CylinderGeometry(r1, r2, h, n || 20);
const sph = (r, ws, hs) => new THREE.SphereGeometry(r, ws || 20, hs || 12);
// Track loop: links along a rounded loop from x0 (rear) to x1 (front), wheel radius R centred at height cy, side z.
function trackLoop(parent, x0, x1, cy, R, z, width, col) {
  const pts = [], step = 0.52;
  for (let x = x0; x <= x1; x += step) pts.push([x, cy - R - 0.08, 0]);
  for (let a = -HALF_PI; a < HALF_PI; a += step / R) pts.push([x1 + Math.cos(a) * R, cy + Math.sin(a) * R, a + HALF_PI]);
  for (let x = x1; x >= x0; x -= step) pts.push([x, cy + R, Math.PI]);
  for (let a = HALF_PI; a < HALF_PI * 3; a += step / R) pts.push([x0 + Math.cos(a) * R, cy + Math.sin(a) * R, a + HALF_PI]);
  const link = new THREE.InstancedMesh(rbox(0.46, 0.2, width, 0.07, 1), mat3(col || '#2a2b27', 0.75, 0.35), pts.length);
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  pts.forEach(([x, y, a], i) => { e.set(0, 0, a); q.setFromEuler(e); mx.compose(new THREE.Vector3(x, y, z), q, one); link.setMatrixAt(i, mx); });
  link.castShadow = link.receiveShadow = true;
  parent.add(link);
  return link;
}

// Registry: unit type -> builder. Buildings use 'bld:' + tile letter and receive (seed, damaged);
// props use 'prop:forest' (seed) and 'prop:bridge'. Each model registers itself right after its builder.
const MODEL3D = {};

// ---------- Ukrainian units ----------
// Reference model: follow its structure and level of detail for every new vehicle.
function m3T64() {
  const T = new THREE.Group();
  const OL = mat3('#5b6636', 0.6, 0.05), OD = mat3('#474f2a', 0.65, 0.05), ERA = mat3('#66733d', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  // running gear: six small road wheels, return rollers, idler, drive sprocket, track loop, skirts
  for (const s of [-1, 1]) {
    const z = s * 4.45;
    for (let i = 0; i < 6; i++) {
      const x = -6.2 + i * 2.35;
      part(T, cyl(1.02, 1.02, 0.95, 24), RUB, x, 1.2, z, HALF_PI);
      part(T, cyl(0.82, 0.82, 1.0, 20), OD, x, 1.2, z, HALF_PI);
      part(T, cyl(0.3, 0.3, 1.08, 10), STEEL, x, 1.2, z, HALF_PI);
    }
    for (let i = 0; i < 4; i++) part(T, cyl(0.33, 0.33, 0.7, 12), DKS, -5.4 + i * 3.6, 2.75, z, HALF_PI);
    part(T, cyl(0.95, 0.95, 0.9, 20), OD, 7.95, 1.75, z, HALF_PI);
    part(T, cyl(1.1, 1.1, 0.9, 20), DKS, -8.1, 1.85, z, HALF_PI);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; part(T, new THREE.BoxGeometry(0.28, 0.28, 0.8), DKS, -8.1 + Math.cos(a) * 1.18, 1.85 + Math.sin(a) * 1.18, z, 0, 0, a); }
    trackLoop(T, -8.1, 7.9, 1.55, 1.35, z, 2.1);
    part(T, new THREE.BoxGeometry(18.4, 0.16, 2.6), OL, 0.2, 3.25, s * 4.55);
    part(T, new THREE.BoxGeometry(1.6, 0.16, 2.6), OL, 9.9, 2.85, s * 4.55, 0, 0, -0.45);
    for (let i = 0; i < 6; i++) part(T, rbox(2.7, 1.0, 0.12, 0.06, 1), mat3('#4c5630', 0.8), -6.3 + i * 2.85, 2.72, s * 5.86);
    for (let i = 0; i < 7; i++) part(T, rbox(1.5, 0.55, 0.9, 0.08, 1), ERA, -6.8 + i * 2.2, 3.62, s * 5.2);
  }
  // hull, glacis ERA, headlights, engine deck, fuel drums, tow hooks
  part(T, profile([[-8.9, 1.5], [8.1, 1.35], [9.6, 2.9], [6.9, 4.1], [-8.7, 4.1], [-9.0, 3.4]], 7.0), OL, 0, 0, 0);
  const gl = new THREE.Group(); gl.position.set(8.25, 3.52, 0); gl.rotation.z = -0.475; T.add(gl);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) part(gl, rbox(1.25, 0.5, 1.02, 0.07, 1), ERA, -0.7 + r * 1.35, 0.3, -2.8 + c * 1.12);
  for (const s of [-1, 1]) part(T, cyl(0.28, 0.32, 0.4, 14), mat3('#d9dcc6', 0.3, 0.2, { emissive: lin('#3a3a2a') }), 9.3, 3.1, s * 3.4, 0, 0, HALF_PI);
  for (let i = 0; i < 9; i++) part(T, new THREE.BoxGeometry(0.16, 0.14, 5.2), DKS, -8.1 + i * 0.52, 4.16, 0);
  part(T, rbox(3.2, 0.3, 5.8, 0.1, 1), OD, -3.9, 4.2, 0);
  for (const s of [-1, 1]) {
    part(T, cyl(0.72, 0.72, 3.0, 22), mat3('#46502a', 0.55, 0.2), -9.55, 3.9, s * 1.8, HALF_PI);
    for (const d of [-1.3, 1.3]) part(T, cyl(0.76, 0.76, 0.1, 22), DKS, -9.55, 3.9, s * 1.8 + d, HALF_PI);
    part(T, new THREE.BoxGeometry(0.6, 0.35, 0.8), DKS, 9.7, 2.1, s * 2.4);
  }
  // turret: cast dome, ERA horseshoe, smoke dischargers, stowage, cupola with NSVT, sights
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(-0.9, 4.1, 0); T.add(Tu);
  part(Tu, cyl(3.7, 3.85, 0.45, 40), OD, 0, 0.22, 0);
  part(Tu, new THREE.SphereGeometry(4.0, 48, 24, 0, Math.PI * 2, 0, HALF_PI), OL, 0.2, 0.35, 0).scale.set(1.12, 0.52, 0.94);
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3;
    const b = part(Tu, rbox(1.25, 0.72, 0.95, 0.08, 1), ERA, 0.2 + Math.cos(a) * 4.05, 1.0 + Math.abs(Math.sin(a)) * 0.1, Math.sin(a) * 3.56);
    b.rotation.y = -a; b.rotation.z = -0.35;
  }
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) part(Tu, cyl(0.2, 0.2, 0.9, 12), DKS, -0.4 - k * 0.45, 1.05, s * 3.6, 0.4 * s, 0, HALF_PI * 0.7);
  part(Tu, rbox(2.6, 1.3, 5.2, 0.15, 1), OD, -4.0, 1.0, 0);
  for (let k = 0; k < 3; k++) part(Tu, new THREE.BoxGeometry(0.1, 1.32, 5.25), DKS, -4.9 + k * 0.9, 1.0, 0);
  part(Tu, cyl(0.28, 0.28, 5.4, 14), mat3('#4a5230', 0.6), -2.4, 1.05, -3.5, 0, 0, HALF_PI);
  part(Tu, cyl(1.05, 1.15, 0.6, 28), OD, -1.3, 2.15, 1.35);
  part(Tu, cyl(0.95, 0.95, 0.16, 28), OL, -1.3, 2.52, 1.35);
  part(Tu, new THREE.BoxGeometry(1.2, 0.5, 0.5), DKS, -0.6, 2.8, 1.35);
  part(Tu, cyl(0.11, 0.13, 3.4, 10), DKS, 1.0, 2.95, 1.35, 0, 0, HALF_PI);
  part(Tu, new THREE.BoxGeometry(0.5, 0.45, 0.35), mat3('#56603a', 0.7), -0.6, 2.5, 0.85);
  part(Tu, rbox(1.0, 0.8, 0.9, 0.1, 1), DKS, 0.9, 2.2, -1.4);
  part(Tu, new THREE.BoxGeometry(0.1, 0.45, 0.62), mat3('#223044', 0.1, 0.3), 1.42, 2.25, -1.4);
  part(Tu, cyl(0.9, 0.9, 0.12, 24), OL, -1.8, 2.05, -1.2);
  part(Tu, cyl(0.05, 0.05, 4.2, 6), DKS, -4.6, 3.4, 2.0);
  // 125 mm gun: mantlet, thermal sleeve bands, bore evacuator, muzzle, yellow IFF tape
  part(Tu, rbox(1.7, 1.5, 2.3, 0.3, 2), OD, 4.0, 1.15, 0);
  const G = new THREE.Group(); G.position.set(4.6, 1.15, 0); Tu.add(G);
  const BAR = mat3('#4e5731', 0.55, 0.1);
  part(G, cyl(0.34, 0.4, 11.4, 24), BAR, 5.7, 0, 0, 0, 0, HALF_PI);
  for (let k = 0; k < 5; k++) part(G, cyl(0.43, 0.43, 0.14, 24), DKS, 1.2 + k * 2.1, 0, 0, 0, 0, HALF_PI);
  part(G, cyl(0.58, 0.58, 1.9, 28), BAR, 6.3, 0, 0, 0, 0, HALF_PI);
  for (const d of [-0.95, 0.95]) part(G, cyl(0.6, 0.55, 0.12, 28), DKS, 6.3 + d, 0, 0, 0, 0, HALF_PI);
  part(G, cyl(0.4, 0.38, 0.5, 24), DKS, 11.45, 0, 0, 0, 0, HALF_PI);
  for (const x of [0.8, 1.5]) part(G, cyl(0.42, 0.42, 0.34, 24), mat3('#f2c230', 0.45), x, 0, 0, 0, 0, HALF_PI);
  return T;
}
MODEL3D.t64 = m3T64;

// ---------- Russian units ----------
// BTR-82A: eight-wheel amphibious APC, and the command variant without the turret.
function m3Btr(cmd) {
  const T = new THREE.Group();
  const OL = mat3('#5a5f4b', 0.6, 0.05), OD = mat3('#3f4234', 0.65, 0.05), OL2 = mat3('#686d58', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  // 1. running gear: four axles, eight three-layer wheels, a door gap between axles 2 and 3
  for (const s of [-1, 1]) {
    const z = s * 3.3;
    for (const x of [-5.4, -2.8, 1.2, 3.8]) {
      part(T, cyl(1.35, 1.35, 1.0, 24), RUB, x, 1.35, z, HALF_PI);
      part(T, cyl(0.82, 0.82, 1.15, 20), OL, x, 1.35, z, HALF_PI);
      part(T, cyl(0.32, 0.32, 1.22, 12), STEEL, x, 1.35, z, HALF_PI);
    }
    // 5. fender flaps over the wheels
    for (const x of [-5.4, -2.8, 1.2, 3.8]) part(T, rbox(3.3, 0.18, 1.15, 0.08, 1), DKS, x, 2.95, s * 2.98);
  }
  // 2. boat hull: rising bottom bow, sloped upper glacis, slightly tapered rear
  part(T, profile([[-7.7, 1.0], [6.1, 1.0], [7.9, 2.6], [7.5, 3.4], [-7.4, 3.4], [-7.7, 2.2]], 5.4), OL, 0, 0, 0);
  // 3. upper side plates sloping inward, 4. roof plate with a small bevel
  part(T, profile([[-7.35, 3.4], [7.15, 3.4], [6.75, 4.4], [-6.95, 4.4]], 4.6), OL2, 0, 0, 0);
  part(T, rbox(13.6, 0.24, 4.55, 0.1, 1), OL, -0.1, 4.5, 0);
  // 6. side doors between axles 2 and 3, with a handle
  for (const s of [-1, 1]) {
    part(T, rbox(1.55, 2.0, 0.16, 0.06, 1), OD, -0.8, 2.3, s * 2.72);
    part(T, new THREE.BoxGeometry(0.12, 0.4, 0.08), DKS, -0.35, 2.55, s * 2.82);
  }
  // 7. five observation windows per side on the upper plates
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) part(T, rbox(0.9, 0.55, 0.12, 0.04, 1), GLS, -5.4 + i * 2.35, 3.9, s * 2.4);
  // 8. bow: folded wave breaker, headlights, tow hooks
  const wb = part(T, rbox(3.6, 0.14, 4.5, 0.05, 1), OL2, 6.7, 3.05, 0, 0, 0, -0.62);
  wb.rotation.x = 0.06;
  for (const s of [-1, 1]) {
    part(T, cyl(0.26, 0.3, 0.4, 14), mat3('#d9dcc6', 0.3, 0.2, { emissive: lin('#3a3a2a') }), 7.75, 2.85, s * 2.15, 0, 0, HALF_PI);
    part(T, new THREE.BoxGeometry(0.5, 0.3, 0.7), DKS, 7.85, 1.75, s * 1.55);
  }
  // 9. driver's and commander's hatches on the front roof
  for (const [hx, hz] of [[4.7, -1.35], [3.0, 1.35]]) {
    part(T, cyl(0.72, 0.75, 0.18, 24), OL2, hx, 4.68, hz);
    part(T, cyl(0.6, 0.6, 0.1, 24), OD, hx, 4.8, hz);
  }
  // 11. rear: engine grille slats, sooty exhaust box, stowage box
  for (let i = 0; i < 7; i++) part(T, new THREE.BoxGeometry(0.16, 0.1, 4.1), DKS, -6.7 + i * 0.5, 4.66, 0);
  part(T, rbox(1.7, 0.72, 1.1, 0.08, 1), DKS, -6.6, 4.4, -1.75);
  part(T, rbox(0.9, 0.3, 0.8, 0.05, 1), mat3('#1a1c18', 0.8), -6.35, 4.15, -1.75);
  part(T, rbox(2.6, 0.7, 1.5, 0.1, 1), OL2, -7.05, 2.8, 0);
  // 10/12. turret group: BPPU with 30 mm cannon, or the command cupola
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(0.8, 4.6, 0); T.add(Tu);
  part(Tu, cyl(1.7, 1.75, 0.16, 28), OD, 0, 0.08, 0);
  if (!cmd) {
    part(Tu, profile([[-1.9, 0.1], [2.15, 0.3], [2.35, 1.2], [1.05, 1.8], [-1.65, 1.8], [-2.1, 0.95]], 3.0), OL, 0, 0.1, 0);
    // 30 mm cannon: root sleeve, long thin barrel, muzzle brake; coaxial machine gun beside it
    const G = new THREE.Group(); G.position.set(1.25, 1.35, 0); Tu.add(G);
    const BAR = mat3('#4e5731', 0.55, 0.1);
    part(G, cyl(0.3, 0.3, 1.7, 18), DKS, 1.85, 0, 0, 0, 0, HALF_PI);
    part(G, cyl(0.16, 0.19, 6.6, 16), BAR, 5.0, 0, 0, 0, 0, HALF_PI);
    part(G, cyl(0.27, 0.27, 0.95, 18), DKS, 7.65, 0, 0, 0, 0, HALF_PI);
    part(G, cyl(0.075, 0.075, 5.4, 10), DKS, 4.3, -0.42, 0.46, 0, 0, HALF_PI);
    part(Tu, rbox(0.78, 0.55, 0.72, 0.08, 1), OD, 0.35, 1.98, 0.55);
    part(Tu, new THREE.BoxGeometry(0.1, 0.4, 0.55), GLS, 0.78, 2.0, 0.55);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) part(Tu, cyl(0.16, 0.16, 0.55, 12), DKS, -1.15, 1.15, s * (1.25 + k * 0.42), 0.5 * s, 0, HALF_PI * 0.72);
    part(Tu, cyl(0.04, 0.05, 2.7, 6), DKS, -1.7, 2.75, -1.05);
  } else {
    part(Tu, rbox(2.3, 1.35, 2.7, 0.14, 1), OL, -0.2, 0.7, 0);
    part(Tu, cyl(1.15, 1.25, 0.5, 24), OL2, -0.2, 1.55, 0);
    part(Tu, cyl(0.95, 0.95, 0.14, 24), OD, -0.2, 1.86, 0);
    part(Tu, new THREE.BoxGeometry(0.1, 0.4, 0.55), GLS, 1.15, 1.35, 0.8);
    part(T, rbox(2.1, 0.95, 1.45, 0.1, 1), OD, -4.4, 5.05, 1.3);
    for (const ax of [5.4, -0.6, -6.2]) {
      part(T, cyl(0.14, 0.14, 0.55, 10), DKS, ax, 4.85, -1.65);
      part(T, cyl(0.045, 0.05, 7.0, 6), DKS, ax, 8.55, -1.65);
    }
  }
  return T;
}
MODEL3D.btr = () => m3Btr(false);
MODEL3D.cmd = () => m3Btr(true);

// ---------- people ----------
// Reference figure for every infantry and civilian model. About 4.4 units tall standing.
// o: { uni, vest, helmet, skin, band, pose: 'stand' | 'kneel', gun: 'rifle' | 'rpg' | 'mg' | 'none', hat } -> Group facing +x.
function soldier3(parent, x, z, ry, o) {
  o = o || {};
  const S = new THREE.Group(); S.position.set(x, 0, z); S.rotation.y = ry || 0; parent.add(S);
  const UNI = mat3(o.uni || '#5d6b3e', 0.9), VEST = mat3(o.vest || '#4a5533', 0.85), SK = mat3(o.skin || '#d6ad86', 0.7);
  const HEL = mat3(o.helmet || '#4c5732', 0.6), BK = mat3('#232420', 0.6, 0.3), BOOT = mat3('#2a2620', 0.8);
  const kneel = o.pose === 'kneel';
  if (kneel) {
    part(S, rbox(0.55, 1.4, 0.5, 0.2), UNI, -0.2, 0.3, 0.3, 0, 0, HALF_PI);
    part(S, rbox(0.55, 1.5, 0.5, 0.2), UNI, 0.35, 0.75, -0.3);
    part(S, rbox(0.7, 0.3, 0.5, 0.12), BOOT, 0.45, 0.15, -0.3);
  } else for (const s of [-1, 1]) {
    part(S, rbox(0.55, 1.7, 0.55, 0.22), UNI, 0, 0.85, s * 0.33);
    part(S, rbox(0.8, 0.32, 0.55, 0.12), BOOT, 0.12, 0.16, s * 0.33);
  }
  const hy = kneel ? 1.35 : 1.75;
  part(S, rbox(0.9, 1.5, 1.25, 0.3), VEST, 0, hy + 0.75, 0);
  for (let k = 0; k < 3; k++) part(S, rbox(0.22, 0.4, 0.3, 0.06, 1), mat3('#3c4529', 0.9), 0.5, hy + 0.55, -0.4 + k * 0.4);
  part(S, rbox(0.5, 0.8, 1.0, 0.15), mat3('#3c4529', 0.9), -0.62, hy + 0.9, 0);
  for (const s of [-1, 1]) part(S, rbox(0.42, 1.25, 0.42, 0.18), UNI, 0.35, hy + 0.9, s * 0.72, 0, 0, -0.9);
  if (o.band !== null) part(S, new THREE.BoxGeometry(0.3, 0.26, 0.44), mat3(o.band || '#f2c230', 0.6), 0.02, hy + 1.2, 0.72);
  part(S, sph(0.42, 18, 12), SK, 0.05, hy + 1.85, 0);
  if (o.hat) part(S, cyl(0.46, 0.5, 0.35, 16), mat3(o.hat, 0.9), 0.02, hy + 2.12, 0);
  else part(S, new THREE.SphereGeometry(0.52, 20, 10, 0, Math.PI * 2, 0, HALF_PI * 1.05), HEL, 0.02, hy + 1.92, 0).scale.set(1.05, 0.9, 1.0);
  const gun = o.gun || 'rifle';
  if (gun === 'rifle' || gun === 'mg') {
    const R = new THREE.Group(); R.position.set(0.9, hy + 1.15, 0.25); R.rotation.z = kneel ? 0.05 : -0.15; S.add(R);
    part(R, new THREE.BoxGeometry(gun === 'mg' ? 2.8 : 2.4, 0.18, 0.12), BK, 0.2, 0, 0);
    part(R, new THREE.BoxGeometry(0.22, 0.45, 0.1), BK, 0.1, -0.25, 0, 0, 0, 0.2);
    if (gun === 'mg') { part(R, new THREE.BoxGeometry(0.5, 0.35, 0.3), BK, 0.2, -0.28, 0); part(R, cyl(0.05, 0.05, 0.6, 6), BK, 1.3, -0.3, 0.12, 0, 0, 0.4); }
  } else if (gun === 'rpg') {
    part(S, cyl(0.16, 0.16, 3.2, 12), mat3('#3d4a2c', 0.6), 0.2, hy + 1.65, -0.55, 0, 0, HALF_PI);
    part(S, cyl(0.3, 0.12, 0.8, 12), mat3('#3d4a2c', 0.6), 2.0, hy + 1.65, -0.55, 0, 0, HALF_PI);
  }
  return S;
}

// ---------- trees ----------
function pine3(parent, x, z, h, seed) {
  const N = mat3('#2c4a31', 0.85), N2 = mat3('#35583b', 0.85), SNOW = mat3('#eef2f4', 0.7);
  part(parent, cyl(0.35, 0.5, 3.4, 10), mat3('#5a3d28', 0.9), x, 1.7, z);
  const n = Math.max(3, Math.round(h / 2.6));
  for (let i = 0; i < n; i++) {
    const t = i / n, r = h * 0.3 * (1 - t * 0.85), y = 2.4 + t * (h - 3.5);
    const c = part(parent, new THREE.ConeGeometry(r, h * 0.3, 11), i % 2 ? N2 : N, x, y + h * 0.15, z);
    c.rotation.y = hash(seed, i, 1) * 3; c.rotation.z = (hash(seed, i, 2) - 0.5) * 0.08;
    part(parent, new THREE.ConeGeometry(r * 0.72, h * 0.12, 11), SNOW, x, y + h * 0.26, z).rotation.y = c.rotation.y;
  }
}
// Bare winter birch: white trunk with dark marks and a few thin branches.
function birch3(parent, x, z, h, seed) {
  const BARK = mat3('#e6e2d6', 0.8), MARK = mat3('#2b2a26', 0.9), TW = mat3('#6a5a48', 0.9);
  part(parent, cyl(0.28, 0.4, h, 10), BARK, x, h / 2, z);
  for (let i = 0; i < 5; i++) part(parent, new THREE.BoxGeometry(0.1, 0.18, 0.62), MARK, x + 0.28, 1 + i * h * 0.16, z, 0, hash(seed, i, 5) * 3, 0);
  for (let i = 0; i < 6; i++) {
    const a = hash(seed, i, 7) * 6.28, y = h * (0.45 + i * 0.09), L = 1.6 + hash(i, seed, 8) * 1.4;
    const b = part(parent, cyl(0.05, 0.1, L, 5), TW, x + Math.cos(a) * L * 0.4, y + L * 0.3, z + Math.sin(a) * L * 0.4);
    b.rotation.z = -Math.cos(a) * 0.9; b.rotation.x = Math.sin(a) * 0.9;
  }
}
MODEL3D['prop:forest'] = seed => {
  const g = new THREE.Group();
  const spots = [[-5, -4], [3, 3], [5, -5], [-3, 5], [-6, 2], [1, -7]];
  spots.forEach(([x, z], i) => {
    const h = 8 + hash(seed, i, 3) * 8;
    if (hash(seed, i, 4) < 0.2) birch3(g, x, z, h * 0.8, seed + i); else pine3(g, x, z, h, seed + i);
  });
  return g;
};

// ---------- buildings ----------
// Reference building: village house. Wall and roof colours vary by seed (same palettes as the voxel house).
function m3House(seed, dmg) {
  const H = new THREE.Group();
  const WL = HOUSE_WALL[Math.floor(hash(seed, 1, 1) * HOUSE_WALL.length)], [RA, RB] = HOUSE_ROOF[Math.floor(hash(seed, 2, 2) * HOUSE_ROOF.length)];
  const WALL = mat3(WL, 0.9), TRIM = mat3('#f1ede3', 0.8), ROOF = mat3(RA, 0.7), ROOF2 = mat3(RB, 0.7), WOOD = mat3('#6b5238', 0.85);
  const GLASS = dmg ? mat3('#1d222a', 0.3) : mat3('#f6d57a', 0.25, 0, { emissive: lin('#f0ad3a'), emissiveIntensity: 0.8 });
  part(H, rbox(12.4, 1.0, 10.4, 0.2), mat3('#8d7b62', 0.95), 0, 0.5, 0);
  part(H, rbox(12, 6.2, 10, 0.12), WALL, 0, 4.0, 0);
  function win(x, y, z, ry) {
    const W = new THREE.Group(); W.position.set(x, y, z); W.rotation.y = ry; H.add(W);
    part(W, new THREE.BoxGeometry(1.9, 1.9, 0.1), GLASS, 0, 0, 0);
    for (const [w, h, dx, dy] of [[2.3, 0.22, 0, 1.05], [2.5, 0.26, 0, -1.08], [0.22, 2.2, -1.05, 0], [0.22, 2.2, 1.05, 0], [0.12, 1.9, 0, 0], [1.9, 0.12, 0, 0.3]]) part(W, new THREE.BoxGeometry(w, h, 0.22), TRIM, dx, dy, 0.08);
    for (const s of [-1, 1]) part(W, rbox(0.9, 2.1, 0.12, 0.05, 1), mat3('#3f6b8f', 0.7), s * 1.7, 0, 0.1);
  }
  win(-3, 4.3, 5.05, 0); win(2.8, 4.3, 5.05, 0); win(6.05, 4.3, -2.4, HALF_PI); win(6.05, 4.3, 2.4, HALF_PI);
  part(H, rbox(1.6, 3.0, 0.2, 0.05, 1), WOOD, -0.1, 2.5, 5.08);
  part(H, new THREE.BoxGeometry(2.4, 0.2, 1.4), TRIM, -0.1, 1.05, 5.6);
  const slope = Math.atan2(4.0, 6.0);
  for (const s of [-1, 1]) {
    const R = new THREE.Group(); R.position.set(0, 11.05, 0); R.rotation.x = s * slope; H.add(R);
    for (let k = 0; k < 7; k++) {
      if (dmg && s === 1 && k > 1 && k < 5 && hash(seed, k, 9) < 0.8) continue;   // shell hole in the roof
      part(R, new THREE.BoxGeometry(13.4, 0.26, 1.18), k % 2 ? ROOF : ROOF2, 0, 0.04 * k, s * (0.55 + k * 1.02)).rotation.x = s * 0.06;
    }
    if (!dmg || s === -1) part(R, new THREE.BoxGeometry(13.0, 0.18, 4.4), mat3('#eef2f5', 0.7), 0, 0.3, s * 2.0);
  }
  part(H, new THREE.BoxGeometry(13.6, 0.4, 0.6), ROOF2, 0, 11.05, 0);
  const gable = new THREE.Shape(); gable.moveTo(-5, 0); gable.lineTo(5, 0); gable.lineTo(0, 4.0); gable.closePath();
  for (const s of [-1, 1]) part(H, new THREE.ExtrudeGeometry(gable, { depth: 0.2, bevelEnabled: false }), WALL, s * 5.9, 7.05, 0, 0, HALF_PI);
  part(H, rbox(1.5, 4.2, 1.5, 0.1), mat3('#7a4a3a', 0.9), 2.6, 10.8, -2.2);
  part(H, new THREE.BoxGeometry(1.9, 0.25, 1.9), mat3('#5c3a2e', 0.9), 2.6, 12.95, -2.2);
  for (let i = 0; i < 7; i++) part(H, rbox(0.36, 2.4, 0.36, 0.08, 1), WOOD, -8 + i * 2.7, 1.2, 8.2);
  for (const y of [0.9, 1.9]) part(H, new THREE.BoxGeometry(17.2, 0.22, 0.14), WOOD, 0.1, y, 8.2);
  if (dmg) {
    const SOOT = mat3('#1a1714', 1);
    part(H, new THREE.BoxGeometry(3.2, 3.6, 0.1), SOOT, 2.8, 4.6, 5.12);
    for (let i = 0; i < 6; i++) part(H, rbox(0.9 + hash(seed, i, 1), 0.5, 0.8, 0.15, 1), mat3('#8a8276', 0.95), 3 + hash(seed, i, 2) * 4, 0.3, 6 + hash(seed, i, 3) * 2).rotation.y = hash(i, seed, 4) * 3;
  }
  return H;
}
MODEL3D['bld:h'] = m3House;

// ---------- task sections ----------
// Each task card adds its builder and MODEL3D registration inside its own section below, so cards merge cleanly.

// ---------- T-17 反坦克组 atgm ----------
function m3Atgm() {
  const T = new THREE.Group();
  const UNI = '#5d6b3e', VEST = '#4a5533', HEL = '#4c5732';
  const TUBE = mat3('#5d6448', 0.6, 0.05), CLU = mat3('#3b3f33', 0.5, 0.2), DK = mat3('#2d302a', 0.6, 0.3);
  // 1+3. Soldier A: kneeling professor with the Javelin, thin-frame glasses below the helmet
  const A = soldier3(T, 1.5, -2, 0, { pose: 'kneel', uni: UNI, vest: VEST, helmet: HEL, gun: 'none' });
  part(A, cyl(0.1, 0.1, 0.05, 12), DK, 0.45, 3.2, -0.16, 0, 0, HALF_PI);
  part(A, cyl(0.1, 0.1, 0.05, 12), DK, 0.45, 3.2, 0.16, 0, 0, HALF_PI);
  part(A, rbox(0.06, 0.05, 0.11, 0.02, 1), DK, 0.47, 3.21, 0);
  // FGM-148 Javelin on the shoulder: tube, thicker end caps, CLU under the front, eyepiece on the left
  const J = new THREE.Group(); J.position.set(1.6, 4.3, -2); J.rotation.z = 0.16; T.add(J);
  part(J, cyl(0.36, 0.36, 5.5, 18), TUBE, 0, 0, 0, 0, 0, HALF_PI);
  part(J, cyl(0.44, 0.44, 0.5, 18), DK, -2.6, 0, 0, 0, 0, HALF_PI);
  part(J, cyl(0.42, 0.42, 0.4, 18), DK, 2.65, 0, 0, 0, 0, HALF_PI);
  part(J, rbox(1.15, 0.6, 0.62, 0.08, 1), CLU, 1.55, -0.52, 0.15);
  part(J, rbox(0.42, 0.2, 0.2, 0.04, 1), CLU, 0.72, -0.4, 0.52);
  // 2. Soldier B: standing Stinger gunner, IFF antenna folded on the tube front
  soldier3(T, -1.5, 2.5, 0, { uni: UNI, vest: VEST, helmet: HEL, gun: 'none' });
  const S2 = new THREE.Group(); S2.position.set(-0.3, 3.95, 2.5); S2.rotation.z = 0.1; T.add(S2);
  part(S2, cyl(0.28, 0.28, 7.0, 16), TUBE, 0, 0, 0, 0, 0, HALF_PI);
  part(S2, cyl(0.34, 0.34, 0.35, 16), DK, -3.3, 0, 0, 0, 0, HALF_PI);
  part(S2, rbox(0.16, 0.45, 0.16, 0.04, 1), DK, 1.5, -0.45, 0);
  part(S2, rbox(0.06, 0.55, 0.06, 0.02, 1), DK, 2.4, 0.42, 0);
  for (let k = 0; k < 3; k++) part(S2, rbox(0.5, 0.05, 0.05, 0.02, 1), DK, 2.4, 0.42 + (k - 1) * 0.16, 0);
  // 4. open ammo crate, half-open lid, spare tube peeking out
  part(T, rbox(1.7, 0.55, 1.05, 0.06, 1), CLU, 3.6, 0.28, 1.4);
  part(T, rbox(1.7, 0.08, 1.05, 0.03, 1), DK, 3.6, 0.66, 0.72, -1.15, 0, 0);
  part(T, cyl(0.3, 0.3, 3.0, 14), TUBE, 3.95, 0.6, 1.35, 0, 0, HALF_PI);
  // 5. a bag at each soldier's feet
  part(T, rbox(0.95, 0.6, 0.75, 0.12, 1), mat3('#4a5533', 0.85), 2.75, 0.3, -3.05);
  part(T, rbox(0.85, 0.55, 0.7, 0.12, 1), mat3('#3c4529', 0.85), -2.55, 0.28, 3.35);
  return T;
}
MODEL3D.atgm = m3Atgm;

// ---------- T-18 国土防卫步兵班 tdf ----------
function m3Tdf() {
  const T = new THREE.Group();
  const SB1 = mat3('#a49271', 0.95), SB2 = mat3('#96856a', 0.95);
  // 1. machine gunner kneeling behind a small sandbag pile
  soldier3(T, 2, 0, -0.18, { pose: 'kneel', gun: 'mg', vest: '#4a5533' });
  for (const [bx, by, bz, w, d, rz] of [[3.45, 0.24, -0.5, 1.5, 1.0, 0.1], [3.6, 0.6, -0.15, 1.25, 0.8, -0.08], [3.3, 0.26, 0.55, 1.1, 0.7, 0.16]]) {
    const bag = part(T, sph(0.5, 10, 8), SB1, bx, by, bz); bag.scale.set(w, 0.5, d); bag.rotation.y = rz;
    part(T, sph(0.5, 10, 8), SB2, bx + 0.12, by + 0.18, bz - 0.1).scale.set(w * 0.7, 0.4, d * 0.7);
  }
  // 2. RPG-7 gunner standing, rocket bag on the back with two warheads peeking out
  soldier3(T, -2, -3, 0.22, { gun: 'rpg', vest: '#3f4a3a' });
  part(T, rbox(0.8, 1.15, 0.6, 0.12, 1), mat3('#4a5533', 0.85), -3.15, 2.35, -3);
  for (const dz of [-0.14, 0.14]) {
    part(T, cyl(0.14, 0.14, 0.6, 10), mat3('#3d4a2c', 0.6), -3.2, 3.1, -3 + dz, 0.3, 0, 0.12);
    part(T, sph(0.16, 10, 8), mat3('#5d6448', 0.6), -3.26, 3.42, -3 + dz);
  }
  // 3. rifleman standing, wearing a beanie
  soldier3(T, -2, 3, -0.26, { gun: 'rifle', vest: '#57553f', hat: '#3a3f36' });
  // 4. ammo box and a folded blue-yellow flag on the ground
  part(T, rbox(1.4, 0.5, 0.9, 0.06, 1), mat3('#3b3f33', 0.7), 0.6, 0.25, -3.45);
  part(T, rbox(1.3, 0.13, 0.85, 0.05, 1), mat3('#f2c230', 0.7), -0.4, 0.09, 3.6);
  part(T, rbox(1.3, 0.13, 0.85, 0.05, 1), mat3('#2f6fd1', 0.7), -0.4, 0.21, 3.6);
  return T;
}
MODEL3D.tdf = m3Tdf;

// ---------- T-19 俄军空降兵 vdv ----------
function m3Vdv() {
  const T = new THREE.Group();
  const opts = { uni: '#5f6450', vest: '#4d5140', helmet: '#555a48', band: '#e8e8e0' };
  const PACK = mat3('#4a4e3d', 0.85), PAD = mat3('#5d6450', 0.85), NET = mat3('#6a6f55', 1);
  // 1. standing rifleman, helmet covered with a camouflage net
  const s1 = soldier3(T, 2, 0, 0, Object.assign({ gun: 'rifle' }, opts));
  part(s1, new THREE.SphereGeometry(0.62, 16, 10, 0, Math.PI * 2, 0, HALF_PI * 1.05), NET, 0.02, 3.67, 0).scale.set(1.08, 0.95, 1.02);
  // kneeling rifleman and standing machine gunner
  soldier3(T, 1.2, -2.6, 0.08, Object.assign({ pose: 'kneel', gun: 'rifle' }, opts));
  soldier3(T, 0.6, 2.6, -0.08, Object.assign({ gun: 'mg' }, opts));
  // 2. a big backpack with a rolled sleeping pad on top, for each soldier
  for (const [px, pz] of [[1.1, 0], [0.4, -2.6], [-0.2, 2.6]]) {
    part(T, rbox(1.05, 1.35, 0.8, 0.14, 1), PACK, px - 0.9, 2.45, pz);
    part(T, cyl(0.27, 0.27, 1.7, 12), PAD, px - 0.9, 3.4, pz, 0, 0, HALF_PI);
  }
  // 4. green metal ammo box on the ground
  part(T, rbox(1.5, 0.6, 0.95, 0.08, 1), mat3('#4d5a3a', 0.55, 0.4), 0.2, 0.3, 3.5);
  return T;
}
MODEL3D.vdv = m3Vdv;

// ---------- T-20 撤离的平民 civ ----------

// ---------- T-21 D-30 榴弹炮 d30 ----------

// ---------- T-22 BMP-2 bmp2 ----------

// ---------- T-23 T-72B3 t72 ----------

// ---------- T-24 BM-21 冰雹 grad ----------

// ---------- T-25 海王星发射车 neptune ----------

// ---------- T-26 卡-52 ka52 ----------

// ---------- T-27 米-8 mi8 ----------

// ---------- T-28 奥兰-10 orlan ----------

// ---------- T-29 无人艇 magura 与巡逻艇 raptor ----------

// ---------- T-30 赫鲁晓夫楼 bld:b ----------

// ---------- T-31 教堂 bld:c ----------

// ---------- T-32 变电站 bld:S 与机库 bld:H ----------

// ---------- T-33 废墟 bld:rubble 与断桥 prop:bridge ----------
