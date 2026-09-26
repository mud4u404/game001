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

// Registry: unit type -> builder. Buildings use 'bld:' + tile letter and receive (seed, damaged).
const MODEL3D = {
  t64: m3T64,
};
