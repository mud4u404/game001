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
function m3Civ() {
  const T = new THREE.Group();
  // 1. elderly woman: headscarf, neck wrap, cloth bag in hand
  const EW = soldier3(T, 0.5, -2.8, -0.1, { gun: 'none', band: null, uni: '#2f3035', vest: '#7a4b3a', skin: '#e0b896', hat: '#8a3a3a' });
  part(EW, cyl(0.5, 0.56, 0.2, 14), mat3('#8a3a3a', 0.9), 0.02, 3.55, 0);
  part(EW, rbox(0.55, 0.5, 0.55, 0.1, 1), mat3('#6b6a5e', 0.85), 0.65, 2.35, 0.55);
  // 2. man: suitcase in one hand, other hand resting toward the child's shoulder
  const MN = soldier3(T, 2.6, 0.2, 0, { gun: 'none', band: null, uni: '#3b3a36', vest: '#3d4f6b', skin: '#d6ad86', hat: '#2e2620' });
  part(MN, rbox(0.5, 0.75, 1.05, 0.08, 1), mat3('#4a3626', 0.7), 0.75, 1.35, -0.8);
  part(MN, new THREE.BoxGeometry(0.1, 0.08, 0.4), mat3('#2a2620', 0.7), 0.75, 1.78, -0.8);
  part(MN, rbox(0.14, 0.55, 0.14, 0.04, 1), mat3('#3d4f6b', 0.8), 0.2, 2.85, 0.7, 0.45, 0, -0.55);
  // 3. woman: backpack, holding the child's hand
  const WM = soldier3(T, -1.1, 2.7, 0.08, { gun: 'none', band: null, uni: '#2f3035', vest: '#6b6a5e', skin: '#e0b896', hat: '#4a3a2a' });
  part(WM, rbox(0.6, 0.8, 0.45, 0.1, 1), mat3('#57553f', 0.85), -0.55, 2.9, 0);
  part(WM, rbox(0.12, 0.55, 0.12, 0.04, 1), mat3('#6b6a5e', 0.8), 0.38, 2.85, 0.52, 0, 0, -0.6);
  // 4. child: scaled 0.65, red wool hat, hugging a teddy bear
  const CH = soldier3(T, 1.3, 2.3, 0.05, { gun: 'none', band: null, uni: '#3b3a36', vest: '#8a7a52', skin: '#e0b896', hat: '#b03a30' });
  CH.scale.set(0.65, 0.65, 0.65);
  part(CH, sph(0.26, 12, 8), mat3('#8a5a3a', 0.8), 0.55, 2.62, 0.35);
  part(CH, sph(0.17, 10, 8), mat3('#8a5a3a', 0.8), 0.74, 2.88, 0.35);
  for (const dz of [-0.1, 0.1]) part(CH, sph(0.07, 8, 6), mat3('#8a5a3a', 0.8), 0.74, 3.02, 0.35 + dz);
  return T;
}
MODEL3D.civ = m3Civ;

// ---------- T-21 D-30 榴弹炮 d30 ----------
function m3D30() {
  const T = new THREE.Group();
  const OL = mat3('#5b6636', 0.6, 0.05), OD = mat3('#474f2a', 0.65, 0.05), LT = mat3('#66733d', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  const GLS = mat3('#223044', 0.1, 0.3), BRASS = mat3('#b08d4a', 0.4, 0.6);
  // 1. three trails at 120°, spades at the ends, one pointing -x
  for (const [tx, tz] of [[-9.6, 0], [5.0, 8.7], [5.0, -8.7]]) {
    const tr = new THREE.Group(); tr.position.set(tx * 0.12, 0.4, tz * 0.12); tr.rotation.y = Math.atan2(tz, tx); T.add(tr);
    const len = Math.hypot(tx, tz) * 0.9;
    part(tr, rbox(len, 0.5, 0.75, 0.1, 1), OD, len / 2, 0, 0);
    for (let k = 0; k < 3; k++) part(tr, rbox(0.5, 0.14, 0.8, 0.04, 1), LT, len / 2 + k * 0.8 - 1, 0.28, 0);
    part(tr, rbox(1.1, 1.3, 1.3, 0.12, 1), OD, len - 0.4, -0.15, 0);
  }
  // 2. central jack: disc + short cylinder
  part(T, cyl(1.35, 1.45, 0.26, 20), OD, 0, 0.13, 0);
  part(T, cyl(0.55, 0.68, 1.0, 16), STEEL, 0, 0.7, 0);
  // 3. wheels raised off the ground, hung on both sides
  for (const s of [-1, 1]) {
    part(T, cyl(1.05, 1.05, 0.6, 20), RUB, 2.7, 2.55, s * 2.65, HALF_PI);
    part(T, cyl(0.42, 0.42, 0.78, 12), STEEL, 2.7, 2.55, s * 2.65, HALF_PI);
  }
  // 4. cradle, tapering barrel, muzzle brake with side slots, two recoil cylinders
  const BG = new THREE.Group(); BG.position.set(0.4, 1.85, 0); BG.rotation.z = 0.085; T.add(BG);
  part(BG, cyl(0.46, 0.58, 2.6, 18), OL, 1.3, 0, 0, 0, 0, HALF_PI);
  part(BG, cyl(0.24, 0.36, 9.8, 18), STEEL, 7.0, 0, 0, 0, 0, HALF_PI);
  for (const dy of [0.5, -0.52]) part(BG, cyl(0.19, 0.19, 3.4, 14), OL, 2.4, dy + 0.15, 0, 0, 0, HALF_PI);
  part(BG, cyl(0.44, 0.44, 1.7, 18), STEEL, 12.3, 0, 0, 0, 0, HALF_PI);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) part(BG, new THREE.BoxGeometry(0.55, 0.42, 0.22), DKS, 11.7 + k * 0.6, 0.05, s * 0.3);
  // 5. small shields with a sight opening
  for (const s of [-1, 1]) part(BG, rbox(2.7, 1.5, 0.1, 0.05, 1), LT, 2.7, 0.25, s * 0.9, 0, 0, s * -0.2);
  part(BG, rbox(0.5, 0.5, 0.12, 0.04, 1), GLS, 3.2, 0.8, 0);
  // 6. sight box and two handwheels at the breech
  part(BG, rbox(0.45, 0.4, 0.35, 0.05, 1), GLS, -0.7, 0.85, 0.85);
  part(T, cyl(0.3, 0.3, 0.08, 16), DKS, -1.15, 2.15, 1.15, HALF_PI * 0.5, 0, 0);
  part(T, cyl(0.24, 0.24, 0.08, 16), DKS, -0.55, 2.0, 1.55, 0, HALF_PI, 0);
  // 7. crew: kneeling No.1 with a shell, standing layer by the sight
  soldier3(T, -2.3, -1.7, -0.5, { pose: 'kneel', gun: 'none', uni: '#5b6636', vest: '#4a5533', helmet: '#4c5732' });
  part(T, cyl(0.14, 0.14, 0.95, 12), BRASS, -1.85, 1.8, -2.35, 0.3, 0, HALF_PI);
  part(T, sph(0.13, 10, 8), mat3('#8a8f93', 0.5), -1.4, 2.0, -2.35);
  soldier3(T, -0.5, 1.5, 0.15, { gun: 'none', uni: '#5b6636', vest: '#4a5533', helmet: '#4c5732' });
  // 8. two ammo boxes, one open with two shells
  part(T, rbox(1.5, 0.55, 0.9, 0.06, 1), OL, -3.5, 0.28, 2.7);
  part(T, rbox(1.5, 0.55, 0.9, 0.06, 1), OD, -2.3, 0.28, 3.4);
  part(T, rbox(1.5, 0.08, 0.9, 0.03, 1), OD, -2.3, 0.62, 3.15, -0.95, 0, 0);
  for (const dz of [-0.2, 0.2]) {
    part(T, cyl(0.11, 0.11, 0.85, 10), BRASS, -2.3 + dz, 0.78, 3.4, 0.2, 0, HALF_PI);
    part(T, sph(0.1, 8, 6), mat3('#8a8f93', 0.5), -2.28 + dz + 0.28, 1.0, 3.4);
  }
  return T;
}
MODEL3D.d30 = m3D30;

// ---------- T-22 BMP-2 bmp2 ----------
function m3Bmp2() {
  const T = new THREE.Group();
  const OL = mat3('#5b6636', 0.6, 0.05), OD = mat3('#474f2a', 0.65, 0.05), LT = mat3('#66733d', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  const GLS = mat3('#223044', 0.1, 0.3);
  // 1. running gear: six road wheels, three return rollers, toothed drive sprocket, idler, tracks
  for (const s of [-1, 1]) {
    const z = s * 2.75;
    for (let i = 0; i < 6; i++) {
      const x = -4.9 + i * 1.95;
      part(T, cyl(1.15, 1.15, 0.85, 24), RUB, x, 1.25, z, HALF_PI);
      part(T, cyl(0.9, 0.9, 0.95, 20), OL, x, 1.25, z, HALF_PI);
      part(T, cyl(0.3, 0.3, 1.05, 12), STEEL, x, 1.25, z, HALF_PI);
    }
    for (let i = 0; i < 3; i++) part(T, cyl(0.3, 0.3, 0.6, 12), DKS, -3.4 + i * 3.2, 2.6, z, HALF_PI);
    part(T, cyl(0.85, 0.85, 0.8, 20), OL, 6.15, 1.5, z, HALF_PI);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; part(T, new THREE.BoxGeometry(0.24, 0.24, 0.7), DKS, 6.15 + Math.cos(a) * 1.0, 1.5 + Math.sin(a) * 1.0, z, 0, 0, a); }
    part(T, cyl(1.0, 1.0, 0.8, 20), OL, -6.3, 1.6, z, HALF_PI);
    trackLoop(T, -6.3, 6.15, 1.35, 1.15, z, 1.9);
  }
  // 2. hull: low wedge with the long corrugated glacis
  part(T, profile([[-7.0, 1.1], [6.3, 1.0], [7.15, 2.3], [3.8, 3.95], [-7.0, 3.95]], 5.0), OL, 0, 0, 0);
  const rib = new THREE.Group(); rib.position.set(5.35, 2.5, 0); rib.rotation.z = -0.745; T.add(rib);
  for (let k = 0; k < 6; k++) part(rib, new THREE.BoxGeometry(0.26, 0.09, 4.5), LT, 0, k * 0.52, 0);
  // 3. side fender strip, rear doors with windows and handles
  for (const s of [-1, 1]) part(T, new THREE.BoxGeometry(14.2, 0.14, 0.85), DKS, 0.05, 4.02, s * 2.9);
  for (const s of [-1, 1]) {
    part(T, rbox(1.7, 2.7, 0.14, 0.06, 1), OD, -7.05, 2.45, s * 1.25);
    part(T, rbox(0.55, 0.4, 0.08, 0.03, 1), GLS, -7.12, 3.35, s * 1.25);
    part(T, new THREE.BoxGeometry(0.1, 0.4, 0.08), DKS, -6.7, 2.6, s * 1.25 + s * 0.09);
  }
  // 4. four troop hatches behind the turret, driver hatch and periscopes at the front roof
  for (const [hx, hz] of [[-2.3, 1.25], [-2.3, -1.25], [-4.1, 1.25], [-4.1, -1.25]]) part(T, rbox(1.5, 0.12, 1.25, 0.05, 1), LT, hx, 4.05, hz);
  part(T, cyl(0.62, 0.66, 0.16, 22), OL, 4.35, 4.1, -1.15);
  part(T, rbox(0.7, 0.14, 0.14, 0.03, 1), DKS, 4.9, 4.18, -0.55);
  // 5. turret offset to the left: flat beveled profile, smoke dischargers on both sides
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(-0.8, 4.05, 0.85); T.add(Tu);
  part(Tu, profile([[-1.8, 0], [1.9, 0.22], [2.15, 1.0], [0.9, 1.5], [-1.55, 1.5], [-1.95, 0.7]], 2.6), OL, 0, 0, 0);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) part(Tu, cyl(0.15, 0.15, 0.5, 12), DKS, -0.9, 1.0, s * (1.05 + k * 0.38), 0.5 * s, 0, HALF_PI * 0.72);
  // 6. 2A42 30 mm cannon: root sleeve, long thin barrel, perforated muzzle brake
  part(Tu, rbox(1.5, 0.85, 1.1, 0.18, 1), OD, 1.35, 0.95, 0);
  part(Tu, cyl(0.3, 0.3, 2.0, 14), DKS, 2.0, 0.95, 0, 0, 0, HALF_PI);
  part(Tu, cyl(0.09, 0.12, 10.6, 14), STEEL, 7.3, 0.95, 0, 0, 0, HALF_PI);
  part(Tu, cyl(0.2, 0.2, 1.1, 14), DKS, 12.0, 0.95, 0, 0, 0, HALF_PI);
  for (let k = 0; k < 4; k++) part(Tu, new THREE.BoxGeometry(0.14, 0.14, 0.5), DKS, 11.75, 0.95, -0.3 + k * 0.2);
  // 7. 9M113 Konkurs launcher tube on a mount atop the turret
  part(Tu, rbox(0.7, 0.4, 0.5, 0.06, 1), DKS, -0.5, 1.75, -0.35);
  const K = new THREE.Group(); K.position.set(-0.5, 2.0, -0.35); K.rotation.z = 0.12; Tu.add(K);
  part(K, cyl(0.22, 0.22, 5.4, 14), mat3('#8a8a5c', 0.6, 0.05), 1.9, 0, 0, 0, 0, HALF_PI);
  part(K, cyl(0.26, 0.26, 0.3, 14), DKS, -0.7, 0, 0, 0, 0, HALF_PI);
  part(K, cyl(0.26, 0.26, 0.3, 14), mat3('#6d6d48', 0.6), 4.5, 0, 0, 0, 0, HALF_PI);
  // 8. headlights at the bow, exhaust on the right rear
  for (const s of [-1, 1]) part(T, cyl(0.24, 0.28, 0.4, 14), mat3('#d9dcc6', 0.3, 0.2, { emissive: lin('#3a3a2a') }), 6.95, 2.95, s * 1.8, 0, 0, HALF_PI);
  part(T, rbox(1.25, 0.5, 0.9, 0.08, 1), DKS, -6.4, 3.6, -2.15);
  return T;
}
MODEL3D.bmp2 = m3Bmp2;

// ---------- T-23 T-72B3 t72 ----------
function m3T72b3() {
  const T = new THREE.Group();
  const OL = mat3('#5a5f4b', 0.6, 0.05), OD = mat3('#3f4234', 0.65, 0.05), LT = mat3('#686d58', 0.55, 0.05), ERA = mat3('#646a53', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  const GLS = mat3('#223044', 0.1, 0.3), BAR = mat3('#4a5040', 0.55, 0.1);
  // 1. running gear: six LARGE road wheels, rear drive sprocket, front idler — the clearest T-72 tell
  for (const s of [-1, 1]) {
    const z = s * 4.45;
    for (let i = 0; i < 6; i++) {
      const x = -6.1 + i * 2.5;
      part(T, cyl(1.4, 1.4, 0.95, 24), RUB, x, 1.55, z, HALF_PI);
      part(T, cyl(1.14, 1.14, 1.0, 20), OD, x, 1.55, z, HALF_PI);
      part(T, cyl(0.32, 0.32, 1.08, 10), STEEL, x, 1.55, z, HALF_PI);
    }
    for (let i = 0; i < 3; i++) part(T, cyl(0.33, 0.33, 0.7, 12), DKS, -5.2 + i * 4.4, 2.95, z, HALF_PI);
    part(T, cyl(1.0, 1.0, 0.9, 20), OL, -8.1, 1.75, z, HALF_PI);
    part(T, cyl(1.1, 1.1, 0.9, 20), DKS, 7.95, 1.75, z, HALF_PI);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; part(T, new THREE.BoxGeometry(0.28, 0.28, 0.8), DKS, 7.95 + Math.cos(a) * 1.18, 1.75 + Math.sin(a) * 1.18, z, 0, 0, a); }
    trackLoop(T, -8.1, 7.9, 1.75, 1.4, z, 2.1);
  }
  // 2. side skirts: front three Kontakt-5 sections, rear plain rubber skirt
  for (const s of [-1, 1]) {
    part(T, new THREE.BoxGeometry(18.4, 0.16, 2.6), OL, 0.2, 3.25, s * 4.55);
    for (let i = 0; i < 3; i++) part(T, rbox(2.9, 1.15, 0.16, 0.06, 1), ERA, -5.9 + i * 3.1, 3.0, s * 5.72);
    part(T, rbox(8.6, 1.0, 0.14, 0.06, 1), OD, 3.4, 3.0, s * 5.72);
  }
  // 3. hull and one big Kontakt-5 plate on the glacis: two rows of four flat blocks
  part(T, profile([[-8.9, 1.5], [8.1, 1.35], [9.6, 2.9], [6.9, 4.1], [-8.7, 4.1], [-9.0, 3.4]], 7.0), OL, 0, 0, 0);
  const gl = new THREE.Group(); gl.position.set(8.25, 3.52, 0); gl.rotation.z = -0.475; T.add(gl);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) part(gl, rbox(1.75, 0.62, 1.5, 0.08, 1), ERA, -0.95 + r * 1.85, 0.32, -2.25 + c * 1.5);
  for (const s of [-1, 1]) part(T, cyl(0.28, 0.32, 0.4, 14), mat3('#d9dcc6', 0.3, 0.2, { emissive: lin('#3a3a2a') }), 9.3, 3.1, s * 3.4, 0, 0, HALF_PI);
  for (const s of [-1, 1]) part(T, new THREE.BoxGeometry(0.6, 0.35, 0.8), DKS, 9.7, 2.1, s * 2.4);
  // 4. turret: rounder, lower cast dome; V-shaped wedge ERA on the front sides
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(-0.9, 4.1, 0); T.add(Tu);
  part(Tu, cyl(3.9, 4.05, 0.4, 40), OD, 0, 0.2, 0);
  part(Tu, new THREE.SphereGeometry(4.1, 48, 24, 0, Math.PI * 2, 0, HALF_PI), OL, 0.2, 0.32, 0).scale.set(1.18, 0.46, 1.0);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const w = part(Tu, rbox(1.45, 0.8, 0.5, 0.08, 1), ERA, 2.2 + k * 0.7, 1.25 - k * 0.1, s * (2.55 - k * 0.15));
    w.rotation.y = s * -0.5; w.rotation.x = s * 0.35; w.rotation.z = -0.18;
  }
  // 6. smoke dischargers in an arc on the front sides, four per side
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) part(Tu, cyl(0.2, 0.2, 0.85, 12), DKS, 1.3 - k * 0.3, 1.25, s * (3.25 + Math.abs(k - 1.5) * -0.28), 0.4 * s, 0, HALF_PI * 0.72);
  // 5. turret top: commander cupola with a remote 12.7 mm MG, Sosna-U gunner sight with two panes
  part(Tu, cyl(1.0, 1.1, 0.55, 26), OL, -1.35, 2.05, 1.3);
  part(Tu, cyl(0.88, 0.88, 0.14, 26), LT, -1.35, 2.38, 1.3);
  part(Tu, rbox(0.5, 0.45, 0.4, 0.05, 1), DKS, -1.15, 2.75, 1.3);
  part(Tu, cyl(0.08, 0.08, 3.2, 10), DKS, -0.6, 2.8, 1.3, 0, 0, HALF_PI);
  part(Tu, rbox(0.6, 0.4, 0.9, 0.05, 1), DKS, -1.95, 2.75, 1.3);
  part(Tu, rbox(1.0, 0.65, 0.75, 0.1, 1), OD, 0.95, 2.25, -0.9);
  part(Tu, new THREE.BoxGeometry(0.08, 0.4, 0.26), GLS, 1.36, 2.3, -1.05);
  part(Tu, new THREE.BoxGeometry(0.08, 0.4, 0.26), GLS, 1.36, 2.3, -0.75);
  // 7. turret rear: stowage box and a horizontal breathing tube
  part(Tu, rbox(2.6, 1.25, 5.2, 0.15, 1), OD, -4.0, 1.0, 0);
  part(Tu, cyl(0.28, 0.28, 5.3, 14), DKS, -3.4, 1.05, 0, 0, 0, HALF_PI);
  // 8. rear fuel drums
  for (const s of [-1, 1]) {
    part(T, cyl(0.72, 0.72, 3.0, 22), mat3('#46502a', 0.55, 0.2), -9.55, 3.9, s * 1.8, HALF_PI);
    for (const d of [-1.3, 1.3]) part(T, cyl(0.76, 0.76, 0.1, 22), DKS, -9.55, 3.9, s * 1.8 + d, HALF_PI);
  }
  // 9. 125 mm gun: mantlet, thermal sleeve bands, bore evacuator, muzzle — no identification tape
  part(Tu, rbox(1.7, 1.5, 2.3, 0.3, 2), OD, 4.0, 1.15, 0);
  const G = new THREE.Group(); G.position.set(4.6, 1.15, 0); Tu.add(G);
  part(G, cyl(0.34, 0.4, 11.4, 24), BAR, 5.7, 0, 0, 0, 0, HALF_PI);
  for (let k = 0; k < 5; k++) part(G, cyl(0.43, 0.43, 0.14, 24), DKS, 1.2 + k * 2.1, 0, 0, 0, 0, HALF_PI);
  part(G, cyl(0.58, 0.58, 1.9, 28), BAR, 6.3, 0, 0, 0, 0, HALF_PI);
  for (const d of [-0.95, 0.95]) part(G, cyl(0.6, 0.55, 0.12, 28), DKS, 6.3 + d, 0, 0, 0, 0, HALF_PI);
  part(G, cyl(0.4, 0.38, 0.5, 24), DKS, 11.45, 0, 0, 0, 0, HALF_PI);
  return T;
}
MODEL3D.t72 = m3T72b3;

// ---------- T-24 BM-21 冰雹 grad ----------
function m3Grad() {
  const T = new THREE.Group();
  const OL = mat3('#5a5f4b', 0.6, 0.05), OD = mat3('#3f4234', 0.65, 0.05), LT = mat3('#686d58', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  const GLS = mat3('#223044', 0.1, 0.3);
  // 1. wheels: one front axle, two rear axles, big three-layer tires, fenders above
  for (const s of [-1, 1]) {
    const z = s * 2.9;
    for (const x of [5.6, -3.0, -5.2]) {
      part(T, cyl(1.4, 1.4, 0.9, 24), RUB, x, 1.4, z, HALF_PI);
      part(T, cyl(1.08, 1.08, 1.0, 20), OL, x, 1.4, z, HALF_PI);
      part(T, cyl(0.32, 0.32, 1.12, 12), STEEL, x, 1.4, z, HALF_PI);
      part(T, rbox(3.1, 0.16, 1.2, 0.08, 1), DKS, x, 3.0, s * 2.95);
    }
  }
  // chassis frame
  part(T, rbox(15.4, 0.5, 3.9, 0.08, 1), OD, 0.2, 1.15, 0);
  // 2. long-hood Ural cab: engine hood with radiator slats, headlights, bumper, windshield, door windows, flat roof
  part(T, rbox(2.7, 1.55, 3.3, 0.12, 1), OL, 6.35, 2.5, 0);
  for (let k = 0; k < 6; k++) part(T, new THREE.BoxGeometry(0.1, 1.1, 0.16), DKS, 7.72, 2.45, -0.5 + k * 0.2);
  for (const s of [-1, 1]) part(T, cyl(0.3, 0.32, 0.35, 14), mat3('#d9dcc6', 0.3, 0.2, { emissive: lin('#3a3a2a') }), 7.7, 2.9, s * 1.35, 0, 0, HALF_PI);
  part(T, rbox(0.28, 0.42, 3.5, 0.06, 1), DKS, 7.95, 1.3, 0);
  for (const s of [-1, 1]) part(T, new THREE.BoxGeometry(0.12, 0.3, 0.5), DKS, 7.7, 1.35, s * 1.1);
  part(T, rbox(3.1, 1.9, 4.1, 0.15, 1), OL, 4.0, 3.35, 0);
  part(T, rbox(0.1, 0.85, 1.6, 0.04, 1), GLS, 5.58, 3.85, -0.95);
  part(T, rbox(0.1, 0.85, 1.6, 0.04, 1), GLS, 5.58, 3.85, 0.95);
  for (const s of [-1, 1]) part(T, rbox(0.06, 0.7, 1.3, 0.03, 1), GLS, 4.0, 3.85, s * 2.12);
  part(T, rbox(3.2, 0.16, 4.2, 0.06, 1), OL, 4.0, 4.38, 0);
  // 3. spare tire standing behind the cab and an equipment box
  part(T, cyl(1.35, 1.35, 0.8, 22), RUB, -0.55, 2.1, -2.35);
  part(T, rbox(2.3, 0.95, 1.5, 0.1, 1), OL, -0.75, 1.95, 1.9);
  // 5. fuel tanks: horizontal cylinders on both sides
  for (const s of [-1, 1]) part(T, cyl(0.55, 0.55, 2.9, 16), STEEL, 0.4, 1.9, s * 3.15, 0, 0, HALF_PI);
  // 6. launch rack in the turret group: turntable, tall A-frame, 40-tube block raised 12°
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(-1.4, 1.6, 0); T.add(Tu);
  part(Tu, cyl(2.05, 2.15, 0.5, 26), OL, 0, 0.25, 0);
  for (const s of [-1, 1]) part(Tu, rbox(0.3, 5.0, 0.5, 0.08, 1), OD, 0.75, 5.15, s * 1.3, 0.32, 0, 0);
  part(Tu, cyl(0.18, 0.18, 3.0, 12), STEEL, 0.6, 7.45, 0, 0, 0, HALF_PI);
  const BL = new THREE.Group(); BL.position.set(0.6, 7.55, 0); BL.rotation.z = 0.21; Tu.add(BL);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) {
    part(BL, cyl(0.26, 0.26, 4.8, 12), OL, 1.0, (i - 1.5) * 0.62, (j - 4.5) * 0.62, 0, 0, HALF_PI);
    part(BL, cyl(0.19, 0.19, 0.1, 10), mat3('#1a1c18', 0.8), 3.42, (i - 1.5) * 0.62, (j - 4.5) * 0.62, 0, 0, HALF_PI);
  }
  for (const s of [-1, 1]) part(BL, rbox(5.0, 2.7, 0.12, 0.05, 1), OD, 1.0, 0, s * 3.25);
  part(BL, rbox(1.4, 2.6, 6.4, 0.06, 1), OD, -1.7, 0, 0);
  return T;
}
MODEL3D.grad = m3Grad;

// ---------- T-25 海王星发射车 neptune ----------
function m3Neptune() {
  const T = new THREE.Group();
  const OL = mat3('#5b6636', 0.6, 0.05), OD = mat3('#474f2a', 0.65, 0.05), LT = mat3('#66733d', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  const GLS = mat3('#223044', 0.1, 0.3);
  // 1. wheels: four axles, three-layer tires, fenders above
  for (const s of [-1, 1]) {
    const z = s * 2.95;
    for (const x of [-6.4, -4.3, 4.4, 6.5]) {
      part(T, cyl(1.35, 1.35, 0.9, 24), RUB, x, 1.35, z, HALF_PI);
      part(T, cyl(1.06, 1.06, 1.0, 20), OL, x, 1.35, z, HALF_PI);
      part(T, cyl(0.32, 0.32, 1.12, 12), STEEL, x, 1.35, z, HALF_PI);
      part(T, rbox(2.9, 0.16, 1.25, 0.08, 1), DKS, x, 3.0, s * 2.98);
    }
  }
  part(T, rbox(16.6, 0.5, 4.3, 0.08, 1), OD, 0, 1.15, 0);
  // 2. flat-front wide cab over the front axle: split windshield, door windows, grille, lights, bumper
  part(T, rbox(2.9, 2.5, 5.3, 0.14, 1), OL, 6.55, 3.0, 0);
  for (const s of [-1, 1]) part(T, rbox(0.1, 1.15, 2.15, 0.04, 1), GLS, 8.02, 3.85, s * 1.32);
  for (const s of [-1, 1]) part(T, rbox(0.06, 0.75, 1.5, 0.03, 1), GLS, 6.55, 3.75, s * 2.72);
  for (let k = 0; k < 5; k++) part(T, new THREE.BoxGeometry(0.12, 0.9, 0.16), DKS, 8.02, 2.35, -0.45 + k * 0.22);
  for (const s of [-1, 1]) part(T, cyl(0.26, 0.3, 0.35, 14), mat3('#d9dcc6', 0.3, 0.2, { emissive: lin('#3a3a2a') }), 8.0, 2.9, s * 2.2, 0, 0, HALF_PI);
  part(T, rbox(0.26, 0.4, 5.0, 0.06, 1), DKS, 8.15, 1.35, 0);
  // 3. equipment module behind the cab: louvres and access doors on the sides
  part(T, rbox(4.7, 2.4, 5.3, 0.14, 1), OL, 2.6, 2.85, 0);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 5; k++) part(T, new THREE.BoxGeometry(0.14, 0.1, 0.06), DKS, 2.6 + k * 0.4, 3.3, s * 2.68);
    part(T, rbox(1.0, 1.3, 0.08, 0.04, 1), DKS, 1.9, 2.75, s * 2.68);
  }
  // 6. launch assembly in the turret group: frame with four 2x2 square tubes, mouths to -x
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(-2.8, 5.7, 0); T.add(Tu);
  part(Tu, rbox(13.2, 0.35, 3.4, 0.08, 1), OD, 0, -1.5, 0);
  for (const [ty, tz] of [[0.82, 0.82], [0.82, -0.82], [-0.82, 0.82], [-0.82, -0.82]]) {
    part(Tu, rbox(12.0, 1.4, 1.4, 0.12, 1), OL, 0, ty, tz);
    for (const bx of [-2.4, 2.4]) part(Tu, rbox(0.3, 1.52, 1.52, 0.05, 1), DKS, bx, ty, tz);
    part(Tu, rbox(0.12, 1.32, 1.32, 0.03, 1), mat3('#1a1c18', 0.8), -6.02, ty, tz);
  }
  for (const s of [-1, 1]) part(Tu, rbox(0.14, 3.2, 0.14, 0.04, 1), STEEL, 0.3, 0, s * 1.62);
  // 5. two hydraulic outrigger legs down to the ground
  for (const s of [-1, 1]) {
    part(T, cyl(0.3, 0.34, 1.9, 12), STEEL, -7.6, 1.0, s * 2.3);
    part(T, cyl(0.42, 0.42, 0.22, 12), DKS, -7.6, 0.11, s * 2.3);
  }
  return T;
}
MODEL3D.neptune = m3Neptune;

// ---------- T-26 卡-52 ka52 ----------
function m3Ka52() {
  const T = new THREE.Group();
  const OL = mat3('#5a5f4b', 0.6, 0.05), OD = mat3('#3f4234', 0.65, 0.05), LT = mat3('#686d58', 0.55, 0.05);
  const DKS = mat3('#2d302a', 0.6, 0.3), BELLY = mat3('#8a9296', 0.55, 0.1);
  const GLS = mat3('#223044', 0.1, 0.3);
  // 3. fuselage: streamlined body, fat front tapering into the tail boom
  part(T, new THREE.SphereGeometry(2.15, 26, 14), OL, 0.4, 2.3, 0).scale.set(2.5, 1.0, 1.0);
  part(T, new THREE.SphereGeometry(2.0, 24, 12), BELLY, 0.45, 1.85, 0).scale.set(2.3, 0.6, 0.92);
  part(T, cyl(0.55, 0.34, 7.6, 16), OL, 6.2, 2.6, 0, 0, 0, HALF_PI);
  // 2. nose: side-by-side cockpit with big curved glass and frame strips, EO turret below
  part(T, new THREE.SphereGeometry(1.55, 22, 12, 0, Math.PI * 2, 0, HALF_PI * 0.9), GLS, 2.05, 3.05, 0).scale.set(1.35, 0.78, 1.08);
  for (const dz of [-0.55, 0.55]) part(T, rbox(1.9, 0.09, 0.1, 0.03, 1), DKS, 2.1, 3.3, dz);
  part(T, rbox(0.09, 0.5, 2.1, 0.03, 1), DKS, 1.35, 3.15, 0);
  part(T, sph(0.46, 16, 10), DKS, 3.0, 1.35, 0);
  part(T, cyl(0.2, 0.24, 0.14, 14), mat3('#1a1c18', 0.8), 3.0, 1.32, 0, 0, 0, HALF_PI);
  // 3. engine nacelles on the upper sides: intake front, exhaust rear
  for (const s of [-1, 1]) {
    part(T, cyl(0.72, 0.85, 3.4, 18), OL, -0.7, 3.85, s * 1.95, 0, 0, HALF_PI);
    part(T, cyl(0.6, 0.62, 0.2, 16), DKS, 0.85, 3.85, s * 1.95, 0, 0, HALF_PI);
    part(T, rbox(0.7, 0.28, 0.5, 0.05, 1), DKS, -2.55, 3.9, s * 1.95);
  }
  // 5. 30 mm cannon on the right side of the fuselage
  part(T, rbox(0.55, 0.4, 0.75, 0.08, 1), DKS, 1.35, 1.5, -0.95);
  part(T, cyl(0.11, 0.13, 2.6, 12), DKS, 2.6, 1.45, -0.95, 0, 0, HALF_PI);
  // 4. stub wings with Vikhr tube clusters outboard and B-8 pods inboard
  part(T, rbox(2.1, 0.26, 7.2, 0.1, 1), OL, -0.6, 2.75, 0);
  for (const s of [-1, 1]) {
    part(T, rbox(0.2, 0.5, 0.35, 0.05, 1), DKS, -0.6, 2.55, s * 1.6);
    for (const dz of [-0.18, 0.18]) for (const dy of [-0.18, 0.18])
      part(T, cyl(0.13, 0.13, 2.3, 10), DKS, 0.15, 2.45 + dy, s * 2.95 + dz, 0, 0, HALF_PI);
    part(T, cyl(0.42, 0.42, 2.5, 16), OL, 0.15, 2.5, s * 1.45, 0, 0, HALF_PI);
    for (let k = 0; k < 6; k++) part(T, cyl(0.09, 0.09, 0.12, 8), mat3('#1a1c18', 0.8), 1.32, 2.5, s * 1.45 + (k - 2.5) * 0.16, 0, 0, HALF_PI);
  }
  // 6. tail boom and tail: twin canted fins, horizontal stabilizer with end plates
  part(T, cyl(0.52, 0.3, 7.4, 14), OL, 6.1, 2.75, 0, 0, 0, HALF_PI);
  for (const s of [-1, 1]) {
    const fin = part(T, rbox(0.12, 2.3, 1.15, 0.06, 1), OL, 9.55, 3.6, s * 0.72);
    fin.rotation.z = -s * 0.32; fin.rotation.x = s * 0.28;
  }
  part(T, rbox(0.1, 0.12, 4.6, 0.04, 1), OL, 9.35, 3.15, 0);
  for (const s of [-1, 1]) part(T, rbox(0.1, 0.9, 0.5, 0.05, 1), OD, 9.35, 3.15, s * 2.1);
  // 1. coaxial rotors: upper in rotorY, lower in rotorYr, hub and shaft between
  part(T, cyl(0.26, 0.32, 1.5, 12), DKS, 0.35, 4.85, 0);
  part(T, sph(0.42, 14, 10), DKS, 0.35, 5.35, 0);
  const RU = new THREE.Group(); RU.name = 'rotorY'; RU.position.set(0.35, 5.55, 0); T.add(RU);
  const RD = new THREE.Group(); RD.name = 'rotorYr'; RD.position.set(0.35, 5.0, 0); T.add(RD);
  for (let k = 0; k < 3; k++) {
    const au = part(RU, rbox(8.8, 0.07, 0.52, 0.03, 1), DKS, 4.35, 0, 0, 0, 0, 0.1);
    au.rotation.y = k * Math.PI * 2 / 3;
    const ad = part(RD, rbox(8.8, 0.07, 0.52, 0.03, 1), DKS, 4.35, 0, 0, 0, 0, -0.1);
    ad.rotation.y = k * Math.PI * 2 / 3 + Math.PI / 3;
  }
  return T;
}
MODEL3D.ka52 = m3Ka52;

// ---------- T-27 米-8 mi8 ----------
function m3Mi8() {
  const T = new THREE.Group();
  const OL = mat3('#5a5f4b', 0.6, 0.05), OD = mat3('#3f4234', 0.65, 0.05), LT = mat3('#686d58', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  // 7. landing gear: main wheel groups with struts, two nose wheels
  for (const s of [-1, 1]) {
    part(T, cyl(0.42, 0.42, 0.3, 14), RUB, 0.4, 0.42, s * 2.35, HALF_PI);
    part(T, cyl(0.42, 0.42, 0.3, 14), RUB, 1.35, 0.42, s * 2.35, HALF_PI);
    part(T, rbox(0.18, 2.6, 0.18, 0.05, 1), DKS, 0.9, 1.6, s * 2.35, 0, 0, s * 0.35);
  }
  for (const s of [-1, 1]) {
    part(T, cyl(0.34, 0.34, 0.26, 12), RUB, 5.2, 0.35, s * 0.95, HALF_PI);
    part(T, rbox(0.14, 1.9, 0.14, 0.05, 1), DKS, 5.2, 1.35, s * 0.95, 0, 0, s * 0.3);
  }
  // 4. fuselage: long cylindrical cabin, glass nose, tapered tail
  part(T, cyl(1.78, 1.62, 11.5, 20), OL, 0.4, 3.05, 0, 0, 0, HALF_PI);
  part(T, new THREE.SphereGeometry(1.78, 22, 14), OL, 6.2, 3.0, 0).scale.set(1.25, 1.0, 1.0);
  part(T, cyl(1.55, 0.85, 4.6, 16), OL, 8.05, 3.15, 0, 0, 0, HALF_PI);
  // 3. rounded glass nose: panes and frame strips, cockpit side windows
  part(T, new THREE.SphereGeometry(1.62, 20, 12, 0, Math.PI * 2, 0, HALF_PI * 0.85), GLS, 6.9, 3.15, 0).scale.set(1.05, 0.85, 1.02);
  for (const dy of [0, 0.5]) part(T, rbox(0.08, 0.08, 3.1, 0.03, 1), DKS, 7.45, 3.3 + dy, 0);
  part(T, rbox(0.06, 0.75, 0.08, 0.03, 1), DKS, 7.3, 3.3, 1.3);
  for (const s of [-1, 1]) part(T, rbox(0.05, 0.6, 0.7, 0.03, 1), GLS, 5.6, 3.6, s * 1.55);
  // 4. five portholes on the left side, sliding door front-left with frame
  for (let k = 0; k < 5; k++) part(T, cyl(0.28, 0.28, 0.06, 12), GLS, 0.1 + k * 1.05, 3.35, 1.8, HALF_PI, 0, 0);
  part(T, rbox(1.45, 1.95, 0.09, 0.05, 1), OD, 3.55, 2.85, 1.79);
  part(T, rbox(0.07, 1.8, 0.1, 0.02, 1), DKS, 2.85, 2.85, 1.8);
  part(T, rbox(0.07, 1.8, 0.1, 0.02, 1), DKS, 4.3, 2.85, 1.8);
  // 4. clamshell rear doors with a centre seam
  for (const s of [-1, 1]) part(T, rbox(1.3, 3.1, 0.1, 0.05, 1), OD, 10.45, 3.0, s * 0.82, 0, 0, s * 0.12);
  part(T, rbox(0.06, 3.2, 1.72, 0.03, 1), DKS, 10.55, 3.0, 0);
  // 5. two engines on top: dust-intake covers at the front, exhausts bent outward
  for (const s of [-1, 1]) {
    part(T, cyl(0.6, 0.68, 2.7, 16), OL, -0.3, 4.85, s * 0.85, 0, 0, HALF_PI);
    part(T, sph(0.72, 16, 10), OD, 1.15, 4.95, s * 0.85).scale.set(1.15, 0.9, 1.0);
    part(T, cyl(0.3, 0.34, 1.3, 12), DKS, -2.0, 4.95, s * 1.15, 0, 0, s * 0.5);
  }
  // 6. external fuel tanks on both sides
  for (const s of [-1, 1]) {
    part(T, cyl(0.55, 0.55, 3.4, 16), LT, 0.8, 1.95, s * 2.6, 0, 0, HALF_PI);
    part(T, rbox(0.16, 1.1, 0.2, 0.05, 1), DKS, 0.8, 1.5, s * 2.6);
  }
  // 8. tail boom tapering to a small fin
  part(T, cyl(0.85, 0.5, 5.0, 16), OL, 9.6, 3.2, 0, 0, 0, HALF_PI);
  part(T, rbox(0.1, 1.5, 0.55, 0.05, 1), OL, 12.3, 3.6, 0);
  // 1. five-blade main rotor on rotorY
  part(T, cyl(0.3, 0.36, 1.35, 12), DKS, -0.2, 5.05, 0);
  part(T, sph(0.45, 14, 10), DKS, -0.2, 5.95, 0);
  const RY = new THREE.Group(); RY.name = 'rotorY'; RY.position.set(-0.2, 6.15, 0); T.add(RY);
  for (let k = 0; k < 5; k++) {
    const bl = part(RY, rbox(9.7, 0.08, 0.6, 0.03, 1), DKS, 4.8, 0, 0, 0, 0, -0.06);
    bl.rotation.y = k * Math.PI * 2 / 5;
  }
  // 2. three-blade tail rotor on rotorZ at the boom end, right side
  const RZ = new THREE.Group(); RZ.name = 'rotorZ'; RZ.position.set(12.05, 3.6, -0.85); T.add(RZ);
  part(RZ, cyl(0.14, 0.14, 0.5, 10), DKS, 0, 0, 0, 0, 0, 0);
  for (let k = 0; k < 3; k++) {
    const bl = part(RZ, rbox(0.42, 2.0, 0.07, 0.03, 1), DKS, 0, 0.95, 0, 0, 0, 0);
    bl.rotation.z = k * Math.PI * 2 / 3;
  }
  return T;
}
MODEL3D.mi8 = m3Mi8;

// ---------- T-28 奥兰-10 orlan ----------
function m3Orlan() {
  const T = new THREE.Group();
  const FY = mat3('#c9cdd0', 0.5), UW = mat3('#b5babe', 0.5), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  // 1. fuselage: slender spindle — cylinder with rounded nose and tail balls
  part(T, cyl(0.55, 0.55, 5.2, 16), FY, 0.8, 1.5, 0, 0, 0, HALF_PI);
  part(T, sph(0.55, 16, 10), FY, 3.6, 1.5, 0).scale.set(1.15, 0.95, 0.95);
  part(T, sph(0.5, 14, 8), FY, -1.85, 1.55, 0).scale.set(1.1, 0.9, 0.9);
  // 2. high straight wing with upturned tips and a root fairing
  part(T, rbox(1.45, 0.1, 11.8, 0.04, 1), FY, 1.2, 2.2, 0);
  for (const s of [-1, 1]) part(T, rbox(0.7, 0.08, 0.55, 0.03, 1), UW, 1.2, 2.32, s * 6.15, s * -0.3, 0, 0);
  part(T, rbox(1.3, 0.32, 1.3, 0.1, 1), FY, 1.2, 2.0, 0);
  // 3. T-tail: vertical fin with a bevelled horizontal plate on top
  part(T, rbox(0.95, 1.15, 0.09, 0.04, 1), FY, -2.05, 2.35, 0);
  part(T, rbox(0.85, 0.09, 2.3, 0.04, 1), UW, -2.05, 2.95, 0);
  // 4. pusher propeller: engine cowl and two blades in rotorX
  part(T, cyl(0.44, 0.5, 0.72, 14), DKS, -2.55, 1.55, 0, 0, 0, HALF_PI);
  const RX = new THREE.Group(); RX.name = 'rotorX'; RX.position.set(-2.98, 1.55, 0); T.add(RX);
  for (const s of [-1, 1]) part(RX, rbox(0.34, 1.9, 0.07, 0.03, 1), DKS, 0, s * 0.9, 0);
  // 5. EO pod under the belly reaching y = 0, thin pitot tube under the nose
  part(T, sph(0.33, 14, 10), FY, 2.7, 0.34, 0).scale.set(1.25, 1.0, 1.0);
  part(T, cyl(0.2, 0.24, 0.14, 12), GLS, 2.7, 0.3, 0, 0, 0, HALF_PI);
  part(T, cyl(0.03, 0.03, 0.9, 6), DKS, 3.6, 1.1, 0, 0, 0, HALF_PI);
  // 6. short antenna on the back
  part(T, cyl(0.03, 0.035, 0.55, 6), DKS, 0.3, 2.35, 0);
  return T;
}
MODEL3D.orlan = m3Orlan;

// ---------- T-29 无人艇 magura 与巡逻艇 raptor ----------
// Boats float on the sea: the game's water plane is y = -1.8, hulls reach down to about y = -2.6.
const FOAM = () => mat3('#eef2f4', 0.4, 0, { transparent: true, opacity: 0.7 });
function m3Magura() {
  const T = new THREE.Group();
  const DKH = mat3('#2b2e31', 0.6, 0.1), DECK = mat3('#3a3e42', 0.8), DKS = mat3('#2d302a', 0.6, 0.3);
  // plan-view hull extruded vertically: V-shaped pointed bow, flat deck
  part(T, profile([[-5.5, -1.3], [-5.5, 1.3], [0.5, 1.05], [3.8, 0.62], [5.5, 0]], 3.0), DKH, 0, -1.1, 0, -HALF_PI);
  part(T, rbox(10.4, 0.14, 2.35, 0.04, 1), DECK, -0.3, 0.48, 0);
  // raised charge-bay cover at the front with seam lines
  part(T, rbox(2.7, 0.5, 1.55, 0.08, 1), DKH, 2.4, 0.72, 0);
  for (const dz of [-0.5, 0.5]) part(T, new THREE.BoxGeometry(2.5, 0.03, 0.05), mat3('#1a1c18', 0.7), 2.4, 0.99, dz);
  // short mast with two antennas and a small camera
  part(T, cyl(0.07, 0.09, 1.6, 10), DKS, -1.9, 1.3, 0);
  for (const s of [-1, 1]) part(T, cyl(0.025, 0.025, 0.9, 6), DKS, -1.9, 2.3, s * 0.16);
  part(T, sph(0.15, 12, 8), DKS, -1.9, 2.05, 0);
  part(T, cyl(0.09, 0.1, 0.1, 10), mat3('#1a1c18', 0.8), -1.9, 2.0, 0, 0, 0, HALF_PI);
  // stern waterjet outlets: two dark circles
  for (const dz of [-0.45, 0.45]) part(T, cyl(0.22, 0.22, 0.12, 12), mat3('#141614', 0.8), -5.55, -1.0, dz, 0, 0, HALF_PI);
  // white bow wave at the waterline
  part(T, rbox(3.0, 0.06, 2.3, 0.03, 1), FOAM(), 3.3, -1.76, 0, 0, 0, 0.1);
  return T;
}
function m3Raptor() {
  const T = new THREE.Group();
  const HULL = mat3('#b5bcc1', 0.55, 0.05), SUP = mat3('#c9cfd3', 0.55, 0.05), DKD = mat3('#7d8488', 0.85);
  const DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  // plan-view hull: fast planing bow, fender strip along the side
  part(T, profile([[-9.0, -2.8], [-9.0, 2.8], [6.4, 2.55], [8.7, 1.15], [9.0, 0]], 4.4), HULL, 0, -0.4, 0, -HALF_PI);
  part(T, rbox(17.8, 0.14, 5.55, 0.04, 1), DKD, -0.1, 1.86, 0);
  part(T, new THREE.BoxGeometry(17.6, 0.26, 0.26), mat3('#2d302a', 0.7), -0.4, -1.55, 0);
  // enclosed wheelhouse: dark glass band all round, railing on the roof
  part(T, rbox(3.5, 2.1, 4.25, 0.12, 1), SUP, 0.8, 3.0, 0);
  part(T, rbox(3.55, 0.65, 4.3, 0.08, 1), mat3('#223044', 0.1, 0.3), 0.8, 3.55, 0);
  part(T, rbox(3.3, 0.1, 4.05, 0.05, 1), SUP, 0.8, 4.1, 0);
  for (const dz of [-1.6, -0.8, 0, 0.8, 1.6]) part(T, cyl(0.035, 0.035, 0.45, 6), DKS, 0.8, 4.32, dz);
  // remote weapon station on the bow: small turret with a 12.7 mm machine gun, in the turret group
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(4.7, 1.95, 0); T.add(Tu);
  part(Tu, cyl(0.52, 0.6, 0.55, 18), SUP, 0, 0.28, 0);
  part(Tu, cyl(0.09, 0.1, 1.9, 10), DKS, 1.1, 0.5, 0, 0, 0, HALF_PI);
  // mast above the wheelhouse: radar dome (flattened cylinder) and two antennas
  part(T, cyl(0.09, 0.11, 1.5, 10), DKS, 0.8, 5.0, 0);
  part(T, cyl(0.55, 0.55, 0.3, 18), mat3('#c9cfd3', 0.6), 0.8, 5.6, 0).scale.set(1.0, 0.55, 1.0);
  for (const dz of [-0.35, 0.35]) part(T, cyl(0.03, 0.03, 1.1, 6), DKS, 0.8, 5.4, dz);
  // rear deck: two exhausts and two life raft canisters
  for (const dz of [-1.5, 1.5]) part(T, cyl(0.2, 0.2, 0.75, 10), DKS, -7.4, 2.15, dz, 0, 0, HALF_PI);
  for (const dz of [-0.85, 0.85]) part(T, cyl(0.38, 0.38, 1.3, 14), mat3('#e8e8e0', 0.7), -7.9, 2.35, dz, 0, 0, HALF_PI);
  // bow wave at the waterline
  part(T, rbox(3.4, 0.06, 3.4, 0.03, 1), FOAM(), 7.0, -1.76, 0, 0, 0, 0.1);
  return T;
}
MODEL3D.magura = m3Magura;
MODEL3D.raptor = m3Raptor;

// ---------- T-30 赫鲁晓夫楼 bld:b ----------
function m3BldB(seed, dmg) {
  const B = new THREE.Group();
  const WALL = mat3('#cbc5b5', 0.85), SEAM = mat3('#9d978a', 0.85), ROOFC = mat3('#7d796f', 0.7), FR = mat3('#e8e4da', 0.8), SNOW = mat3('#eef2f4', 0.75);
  const LIT = mat3('#f6d57a', 0.25, 0, { emissive: lin('#f0ad3a'), emissiveIntensity: 0.8 }), DKW = mat3('#2d3440', 0.3);
  const RAIL1 = mat3('#b9b3a4', 0.8), RAIL2 = mat3('#8e8a7e', 0.8), DKS = mat3('#2d302a', 0.6, 0.3);
  const FL = 3.1, FH = 15.5;
  const breakX = dmg ? -4.2 : -8.15, w1 = 8.15 - breakX, cx1 = (breakX + 8.15) / 2;
  const topH = dmg ? 3 * FL : FH;
  function win(x, y, z, ry, lit) {
    const W = new THREE.Group(); W.position.set(x, y, z); W.rotation.y = ry; B.add(W);
    part(W, new THREE.BoxGeometry(1.45, 1.65, 0.1), lit ? LIT : DKW, 0, 0, 0);
    for (const [w, h, dx, dy] of [[1.75, 0.14, 0, 0.9], [1.75, 0.14, 0, -0.9], [0.14, 1.85, -0.76, 0], [0.14, 1.85, 0.76, 0]]) part(W, new THREE.BoxGeometry(w, h, 0.13), FR, dx, dy, 0.02);
  }
  // 1. main body with a small bevel; the damaged end keeps only the lower three floors
  part(B, rbox(w1, FH, 11, 0.18), WALL, cx1, FH / 2, 0);
  if (dmg) part(B, rbox(4.0, topH, 11, 0.18), WALL, -6.15, topH / 2, 0);
  // 2. panel seams: horizontal strips at each floor line, a few vertical strips
  for (let f = 1; f <= Math.floor(topH / FL); f++) part(B, new THREE.BoxGeometry(w1, 0.11, 11.05), SEAM, cx1, f * FL, 0);
  if (dmg) part(B, new THREE.BoxGeometry(4.0, 0.11, 11.05), SEAM, -6.15, topH, 0);
  for (const vx of [-4.0, 0.2, 4.4]) part(B, new THREE.BoxGeometry(0.1, FH, 11.08), SEAM, vx, FH / 2, 0);
  // 3+4. windows and balconies, floor by floor
  const winXs = [];
  for (let k = 0; k < 5; k++) winXs.push(breakX + 1.7 + k * (w1 - 3.4) / 4);
  for (let f = 0; f < 5; f++) {
    const y = f * FL + 1.75, gone = dmg && f >= 3;
    winXs.forEach((wx, wi) => {
      if (gone) return;
      const dark = dmg && wx < breakX + 3.4;
      win(wx, y, 5.56, 0, !dark && hash(seed, f, wi) < 0.34);
      win(wx, y, -5.56, Math.PI, !dark && hash(seed, f + 5, wi) < 0.34);
    });
    for (const wx of [breakX + 2.2, breakX + w1 / 2 - 0.4, breakX + w1 - 2.2]) {
      if (gone) continue;
      const yy = f * FL + 0.12;
      part(B, rbox(2.3, 0.16, 1.35, 0.06, 1), WALL, wx, yy + 0.05, 5.55);
      part(B, new THREE.BoxGeometry(2.3, 0.9, 0.12), hash(seed, f, wx) < 0.5 ? RAIL1 : RAIL2, wx, yy + 0.6, 6.15);
      for (const dx of [-1.1, 1.1]) part(B, new THREE.BoxGeometry(0.12, 0.9, 1.3), WALL, wx + dx, yy + 0.6, 5.98);
      win(wx - 0.6, y, 5.56, 0, false);
    }
    if (!gone) { win(7.9, y, 2.3, HALF_PI, hash(seed, f, 7) < 0.34); win(7.9, y, -2.3, HALF_PI, hash(seed, f, 8) < 0.34); }
    if (dmg && f < 3) win(-7.6, y, 5.56, 0, false);
  }
  // 5. two entrances on the +x side with concrete canopies and a small lamp
  for (const dz of [2.2, -2.2]) {
    part(B, rbox(0.14, 2.3, 1.25, 0.05, 1), DKS, 8.16, 1.15, dz);
    part(B, rbox(0.95, 0.14, 1.8, 0.05, 1), SEAM, 8.45, 2.45, dz);
    part(B, new THREE.BoxGeometry(0.12, 0.16, 0.16), LIT, 8.35, 2.7, dz + dz * 0.35);
  }
  // 6. roof: parapet, stairwell exits, vent pipes, TV antennas, snow
  part(B, rbox(w1, 0.5, 0.3, 0.05, 1), ROOFC, cx1, FH + 0.2, 5.6);
  part(B, rbox(w1, 0.5, 0.3, 0.05, 1), ROOFC, cx1, FH + 0.2, -5.6);
  part(B, rbox(0.3, 0.5, 11.0, 0.05, 1), ROOFC, 8.0, FH + 0.2, 0);
  part(B, rbox(0.3, 0.5, 11.0, 0.05, 1), ROOFC, breakX + 0.15, FH + 0.2, 0);
  part(B, rbox(w1 - 0.4, 0.09, 10.6, 0.04, 1), SNOW, cx1, FH + 0.52, 0);
  for (const [ex, ez] of [[2.2, 1.6], [-1.8, -1.4]]) part(B, rbox(1.7, 1.15, 1.5, 0.1, 1), WALL, ex, FH + 0.55, ez);
  for (const [vx, vz] of [[4.6, 2.4], [3.4, -2.2], [-0.6, 2.8], [-2.4, -2.6]]) part(B, cyl(0.18, 0.18, 0.85, 10), ROOFC, vx, FH + 0.6, vz);
  for (const [ax, az] of [[0.4, -2.0], [-2.6, 2.2]]) {
    part(B, cyl(0.05, 0.05, 2.6, 6), DKS, ax, FH + 1.4, az);
    part(B, new THREE.BoxGeometry(1.3, 0.05, 0.05), DKS, ax, FH + 2.1, az);
  }
  // 7. damaged state: tilted slabs, rebar, soot marks, rubble at the base
  if (dmg) {
    part(B, rbox(4.0, 0.09, 10.6, 0.04, 1), SNOW, -6.15, topH + 0.05, 0);
    for (const [sx, sy, sz, rz, rx] of [[-4.6, topH + 0.6, 1.2, 0.5, 0.3], [-5.6, topH + 0.3, -1.4, -0.4, 0.2], [-4.4, topH + 0.15, -0.4, 0.2, -0.35]]) {
      const sl = part(B, rbox(3.3, 0.35, 2.2, 0.06, 1), WALL, sx, sy, sz); sl.rotation.z = rz; sl.rotation.x = rx;
    }
    for (const [cx2, cy2, cz2] of [[-4.35, topH + 1.3, 0.8], [-4.4, topH + 1.1, -1.1], [-4.5, topH + 0.9, 0.1]])
      part(B, cyl(0.05, 0.05, 1.4, 6), DKS, cx2, cy2, cz2, 0.3, 0, 0.2);
    for (const [sx, sy, sz] of [[-5.8, 8.6, 5.6], [-6.4, 7.4, 5.6]]) part(B, new THREE.BoxGeometry(2.6, 1.5, 0.1), DKS, sx, sy, sz);
    for (const [rx2, rz2, rr] of [[-7.2, 1.2, 0.9], [-6.4, -1.6, 0.7], [-5.2, 0.6, 0.5], [-7.6, -0.8, 0.6], [-5.9, 2.2, 0.45]]) {
      const rub = part(B, rbox(rr * 2, rr, rr * 1.6, 0.06, 1), SEAM, rx2, rr / 2, rz2); rub.rotation.y = hash(rx2, rz2, seed) * 3;
    }
  }
  return B;
}
MODEL3D['bld:b'] = m3BldB;

// ---------- T-31 教堂 bld:c ----------
function m3BldC(seed, dmg) {
  const B = new THREE.Group();
  const WALL = mat3('#e7e3d8', 0.8), BLUE = mat3('#3b6fb6', 0.6), ROOFG = mat3('#4a705d', 0.7), SNOW = mat3('#eef2f4', 0.75);
  const DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3), GOLD = mat3('#e3b341', 0.3, 0.8);
  // 1. chapel body with an entrance porch on the +x face
  part(B, rbox(13, 9, 11, 0.16), WALL, 0, 4.5, 0);
  part(B, rbox(1.7, 2.7, 3.6, 0.1, 1), WALL, 7.0, 1.35, 0);
  for (const s of [-1, 1]) part(B, rbox(1.9, 0.16, 3.9, 0.06, 1), ROOFG, 7.0, 2.85, s * 1.05, 0, 0, -s * 0.5);
  // 6. three steps before the porch
  for (let k = 0; k < 3; k++) part(B, rbox(1.2 - k * 0.15, 0.2, 4.2 + k * 0.5, 0.04, 1), mat3('#c9c4b8', 0.85), 8.3 + k * 0.42, 0.1 + k * 0.2, 0);
  // 2. three arched windows per long side
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const wx = -3.4 + k * 3.0, wy = 4.7, wz = s * 5.56;
    part(B, rbox(0.1, 1.8, 1.0, 0.04, 1), GLS, wx, wy, wz);
    part(B, new THREE.BoxGeometry(0.12, 2.2, 0.16), BLUE, wx, wy, s * 0.07);
    part(B, new THREE.CylinderGeometry(0.52, 0.52, 0.14, 12, 1, false, 0, Math.PI), BLUE, wx, wy + 0.9, s * 0.07, 0, 0, HALF_PI);
  }
  // 3. green pitched roof with snow
  for (const s of [-1, 1]) {
    const R = new THREE.Group(); R.position.set(0, 9.05, 0); R.rotation.x = s * Math.atan2(2.4, 6.2); B.add(R);
    part(R, new THREE.BoxGeometry(13.6, 0.22, 6.4), ROOFG, 0, 0.05, s * 2.6).rotation.x = s * 0.05;
    part(R, rbox(13.7, 0.07, 1.2, 0.03, 1), SNOW, 0, 0.14, s * 3.1);
  }
  // 4. octagonal drum with four small windows, golden onion dome, orthodox cross
  part(B, cyl(2.0, 2.15, 2.2, 8), WALL, -1.5, 10.1, 0);
  for (const a of [0, 1.57, 3.14, 4.71]) part(B, rbox(0.5, 0.9, 0.1, 0.03, 1), GLS, -1.5 + Math.cos(a) * 1.95, 10.1, Math.sin(a) * 1.95, 0, -a, 0);
  const pts = [];
  for (const [r, h] of [[0.05, 0], [1.5, 0.5], [2.15, 1.7], [1.95, 3.0], [1.1, 4.2], [0.5, 5.0], [0.22, 5.6], [0.03, 6.0]]) pts.push(new THREE.Vector2(r, h));
  const ON = new THREE.Group(); ON.name = 'onion'; ON.position.set(-1.5, 11.2, 0); B.add(ON);
  part(ON, new THREE.LatheGeometry(pts, 20), GOLD, 0, 0, 0);
  part(ON, cyl(0.05, 0.05, 1.1, 6), GOLD, 0, 6.4, 0);
  part(ON, new THREE.BoxGeometry(0.9, 0.09, 0.09), GOLD, 0, 6.6, 0);
  part(ON, new THREE.BoxGeometry(0.62, 0.08, 0.08), GOLD, 0, 6.15, 0);
  const SL = part(ON, new THREE.BoxGeometry(0.5, 0.07, 0.07), GOLD, 0, 5.6, 0); SL.rotation.z = 0.5;
  // 5. small bell tower above the porch
  part(B, cyl(1.0, 1.12, 1.7, 8), WALL, 7.0, 7.6, 0);
  const pts2 = [];
  for (const [r, h] of [[0.04, 0], [0.85, 0.3], [1.15, 0.95], [1.0, 1.7], [0.55, 2.4], [0.03, 3.1]]) pts2.push(new THREE.Vector2(r, h));
  part(B, new THREE.LatheGeometry(pts2, 16), GOLD, 7.0, 8.45, 0);
  part(B, cyl(0.04, 0.04, 0.7, 6), GOLD, 7.0, 11.9, 0);
  part(B, new THREE.BoxGeometry(0.5, 0.07, 0.07), GOLD, 7.0, 12.05, 0);
  // 7. damaged state: the main dome has toppled, a black hole on the drum, charred window, rubble
  if (dmg) {
    ON.rotation.z = -0.62; ON.position.set(-0.9, 10.6, 1.6);
    part(B, cyl(1.15, 1.3, 0.4, 8), mat3('#141614', 0.85), -1.5, 10.9, 0);
    part(B, rbox(0.12, 1.9, 1.1, 0.05, 1), mat3('#141614', 0.85), -3.4, 4.7, 5.5);
    for (const [rx, rz, rr] of [[5.6, 1.4, 0.8], [4.9, -1.7, 0.6], [6.2, -0.6, 0.5]]) {
      const rub = part(B, rbox(rr * 2.2, rr, rr * 1.7, 0.06, 1), WALL, rx, rr / 2, rz); rub.rotation.y = rr * 3;
    }
  }
  return B;
}
MODEL3D['bld:c'] = m3BldC;

// ---------- T-32 变电站 bld:S 与机库 bld:H ----------
function m3Substation(seed, dmg) {
  const T = new THREE.Group();
  const STEEL = mat3('#8a9096', 0.5, 0.6), TR = mat3('#6d7a6a', 0.7, 0.1), INS = mat3('#c9c2b0', 0.5), OL = mat3('#5b6636', 0.6, 0.05), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3), LIT = mat3('#f6d57a', 0.25, 0, { emissive: lin('#f0ad3a'), emissiveIntensity: 0.8 });
  const INS2 = mat3('#7a4a2a', 0.5), FEN = mat3('#5d625c', 0.5, 0.4), GRAV = mat3('#8d8a80', 0.95);
  const BURNT = mat3('#141614', 0.9), OIL = mat3('#14161a', 0.85, 0, { transparent: true, opacity: 0.8 });
  part(T, rbox(17, 0.1, 15, 0.05, 1), GRAV, 0, 0.05, 0);
  // two transformers with cooling fins and bushings
  for (const tx of [-2.6, 2.6]) {
    const burnt = dmg && tx < 0;
    part(T, rbox(3.3, 2.7, 2.7, 0.1, 1), burnt ? BURNT : TR, tx, 1.5, 0);
    for (let k = 0; k < 6; k++) for (const s of [-1, 1]) part(T, new THREE.BoxGeometry(0.08, 2.2, 0.24), burnt ? BURNT : STEEL, tx + s * 1.72, 1.5, -0.85 + k * 0.34);
    for (let b = 0; b < 3; b++) for (let d = 0; d < 3; d++)
      part(T, cyl(0.14 - d * 0.02, 0.16 - d * 0.02, 0.12, 10), burnt ? BURNT : (d === 0 ? INS : INS2), tx - 0.9 + b * 0.9, 3.15 + d * 0.3, 0);
  }
  // two portal frames with lattice columns, cross beams and insulator strings; wires to the transformers
  for (const fx of [-4.6, 4.6]) {
    const F = new THREE.Group(); F.position.set(fx, 0, 0); T.add(F);
    const fallen = dmg && fx < 0;
    for (const s of [-1, 1]) {
      const col = part(F, cyl(0.12, 0.14, 9.6, 8), STEEL, 0, 4.8, s * 2.4);
      if (fallen) { col.rotation.z = s * 1.25; col.position.y = 3.4; col.position.x -= 1.4; }
    }
    if (!fallen) {
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        part(F, rbox(0.06, 0.06, 4.8, 0.02, 1), FEN, 0, 1.2 + k * 2.2, 0, k % 2 ? 0.5 : -0.5, 0, 0);
      }
      part(F, rbox(0.4, 0.3, 5.2, 0.06, 1), STEEL, 0, 9.6, 0);
      for (const s of [-1, 1]) for (let d = 0; d < 3; d++) part(F, cyl(0.18 - d * 0.03, 0.2 - d * 0.03, 0.1, 10), INS, 0, 9.2 - d * 0.32, s * 2.4);
      for (const s of [-1, 1]) part(T, cyl(0.045, 0.045, Math.abs(fx) - 1.4, 6), FEN, (fx - 1.4) / 2 + 0.7, 8.6, s * 1.6, 0, 0, HALF_PI);
    }
  }
  // small control house with a door and a window
  part(T, rbox(2.7, 2.1, 2.1, 0.1, 1), OL, 5.9, 1.1, -5.4);
  part(T, rbox(0.08, 1.3, 0.7, 0.03, 1), DKS, 5.9, 0.7, -4.7);
  part(T, rbox(0.06, 0.55, 0.8, 0.03, 1), GLS, 5.9, 1.35, -5.9);
  // wire fence around the perimeter
  for (const [fx, fz, len, ry] of [[0, 7.4, 17, 0], [0, -7.4, 17, 0], [8.4, 0, 15, HALF_PI], [-8.4, 0, 15, HALF_PI]]) {
    const L = new THREE.Group(); L.position.set(fx, 0, fz); L.rotation.y = ry; T.add(L);
    for (let k = 0; k < Math.floor(len / 2.4) + 1; k++) part(L, cyl(0.05, 0.05, 1.9, 6), FEN, -len / 2 + k * 2.4, 0.95, 0);
    for (const hy of [0.7, 1.6]) part(L, new THREE.BoxGeometry(len, 0.05, 0.05), FEN, 0, hy, 0);
  }
  // damaged: oil stain on the gravel
  if (dmg) part(T, cyl(2.6, 2.9, 0.06, 18), OIL, -3.4, 0.09, 0.8).scale.set(1, 1, 0.7);
  return T;
}
function m3Hangar(seed, dmg) {
  const T = new THREE.Group();
  const ARCH = mat3('#9aa0a3', 0.5, 0.4), WALLH = mat3('#8f948f', 0.8), DKI = mat3('#1b1e22', 0.9), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  const SNOW = mat3('#eef2f4', 0.75), APRON = mat3('#9d9a92', 0.9), YEL = mat3('#c9a53a', 0.7);
  const H = new THREE.Group(); H.position.set(0, 0, 0); T.add(H);
  // half-cylinder arch roof built from lengthwise segments; ribs at every segment edge
  const segW = 17 / 8;
  for (let sgi = 0; sgi < 8; sgi++) {
    const sx = -8.5 + segW * (sgi + 0.5);
    if (dmg && (sgi === 2 || sgi === 5)) continue;
    part(H, new THREE.CylinderGeometry(7.05, 7.05, segW * 1.002, 24, 1, true, 0, Math.PI), ARCH, sx, 0.1, 0, 0, 0, HALF_PI);
    part(H, new THREE.CylinderGeometry(7.18, 7.18, 0.35, 24, 1, true, 0, Math.PI), DKS, -8.5 + segW * sgi + 0.05, 0.1, 0, 0, 0, HALF_PI);
  }
  // snow strips on the arch top
  for (const sx of [-5.5, 0, 5.5]) part(H, new THREE.CylinderGeometry(7.22, 7.22, 1.6, 20, 1, true, Math.PI * 0.32, Math.PI * 0.36), SNOW, sx, 0.1, 0, 0, 0, HALF_PI);
  // side walls, closed back wall, side door and a row of high windows
  for (const s of [-1, 1]) part(H, rbox(17, 2.3, 0.3, 0.05, 1), WALLH, 0, 1.15, s * 6.85);
  part(H, rbox(0.25, 7.0, 13.9, 0.08, 1), WALLH, -8.45, 3.4, 0);
  part(H, rbox(0.1, 2.1, 0.9, 0.04, 1), DKS, -8.52, 1.05, 5.6);
  for (let k = 0; k < 6; k++) part(H, rbox(0.06, 0.7, 1.1, 0.03, 1), GLS, 8.47, 5.9, -4 + k * 1.6);
  // front: two sliding doors half open, dark interior visible
  part(H, rbox(0.2, 6.4, 13.8, 0.06, 1), DKI, 8.35, 3.2, 0);
  part(H, rbox(0.16, 5.9, 3.4, 0.05, 1), WALLH, 8.3, 2.95, -2.4);
  part(H, rbox(0.16, 5.9, 3.4, 0.05, 1), WALLH, 8.3, 2.95, 2.5);
  if (dmg) { const dr = part(H, rbox(0.14, 5.7, 3.2, 0.05, 1), WALLH, 8.25, 2.6, 3.9); dr.rotation.x = -0.85; dr.rotation.y = 0.5; }
  // concrete apron with a yellow edge marking
  part(H, rbox(18.5, 0.1, 6.5, 0.05, 1), APRON, 0, 0.05, 10.5);
  part(H, rbox(18.5, 0.09, 0.22, 0.02, 1), YEL, 0, 0.09, 13.6);
  if (dmg) for (const [px, pz] of [[3.2, 3.6], [5.4, 1.9]]) part(H, rbox(1.6, 0.24, 1.9, 0.05, 1), WALLH, px, 0.12, pz);
  return T;
}
MODEL3D['bld:S'] = m3Substation;
MODEL3D['bld:H'] = m3Hangar;

// ---------- T-33 废墟 bld:rubble 与断桥 prop:bridge ----------
