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
// Smooth body of revolution along x: pts = [[x, radius], ...] from tail to nose. sy / sz stretch the
// cross-section (sy > 1 makes it taller than wide). Good for fuselages, drop tanks, missiles.
function lathe(pts, sy, sz, segs) {
  const g = new THREE.LatheGeometry(pts.map(([x, r]) => new THREE.Vector2(Math.max(0.001, r), x)), segs || 28);
  g.rotateZ(-HALF_PI);
  g.scale(1, sy || 1, sz || 1);
  return g;
}
// Rotor: n blades of length L and chord c around the local y axis, with a hub. Put it in a group named rotorY / rotorYr.
function rotor(parent, n, L, c, col, hubR) {
  const B = mat3(col || '#2d302a', 0.6, 0.2);
  part(parent, cyl(hubR || 0.45, hubR || 0.45, 0.35, 16), mat3('#3a3d36', 0.5, 0.4), 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, bl = new THREE.Group(); bl.rotation.y = a; parent.add(bl);
    part(bl, rbox(L, 0.12, c, 0.05, 1), B, L / 2 + (hubR || 0.45) * 0.6, 0, 0).rotation.z = -0.02;
    part(bl, new THREE.BoxGeometry(0.5, 0.14, c * 1.02), mat3('#8a8f86', 0.5), L + (hubR || 0.45) * 0.6 - 0.25, 0, 0);
  }
}
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
// Limb between two points a -> b (arrays [x, y, z]) with a round joint at b.
function limb(parent, a, b, r, mat, jointMat) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), len = d.length();
  const m = part(parent, cyl(r * 0.92, r, len, 10), mat, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  part(parent, sph(r * 1.02, 10, 8), jointMat || mat, b[0], b[1], b[2]);
  return m;
}
function soldier3(parent, x, z, ry, o) {
  o = o || {};
  const S = new THREE.Group(); S.position.set(x, 0, z); S.rotation.y = ry || 0; parent.add(S);
  const UNI = mat3(o.uni || '#5d6b3e', 0.9), VEST = mat3(o.vest || '#4a5533', 0.85), SK = mat3(o.skin || '#d6ad86', 0.7);
  const HEL = mat3(o.helmet || '#4c5732', 0.6), BK = mat3('#232420', 0.6, 0.3), BOOT = mat3('#2a2620', 0.8);
  const POUCH = mat3('#3c4529', 0.9), civ = o.band === null && o.gun === 'none';
  const HAND = civ ? SK : mat3('#2e2f2a', 0.8);
  const kneel = o.pose === 'kneel';
  // legs: thigh + shin with knee joints, boots
  if (kneel) {
    limb(S, [0, 1.35, 0.3], [-0.55, 0.35, 0.3], 0.26, UNI);
    limb(S, [-0.55, 0.35, 0.3], [-1.1, 0.25, 0.3], 0.24, UNI);
    limb(S, [0, 1.35, -0.3], [0.55, 0.85, -0.3], 0.26, UNI);
    limb(S, [0.55, 0.85, -0.3], [0.5, 0.25, -0.3], 0.24, UNI);
    part(S, rbox(0.75, 0.3, 0.5, 0.12), BOOT, 0.62, 0.15, -0.3);
  } else for (const s of [-1, 1]) {
    limb(S, [0, 1.75, s * 0.3], [0.06, 0.95, s * 0.32], 0.27, UNI);
    limb(S, [0.06, 0.95, s * 0.32], [0, 0.32, s * 0.33], 0.24, UNI);
    part(S, rbox(0.82, 0.32, 0.52, 0.12), BOOT, 0.14, 0.16, s * 0.33);
  }
  const hy = kneel ? 1.35 : 1.75;
  // torso: plate carrier over the uniform, chest plate, magazine pouches, back pack
  part(S, rbox(0.82, 1.45, 1.15, 0.32), UNI, 0, hy + 0.72, 0);
  part(S, rbox(0.9, 1.1, 1.22, 0.25), VEST, 0.02, hy + 0.9, 0);
  part(S, rbox(0.14, 0.75, 0.8, 0.06), VEST, 0.5, hy + 1.0, 0);
  for (let k = 0; k < 3; k++) part(S, rbox(0.22, 0.38, 0.28, 0.06, 1), POUCH, 0.55, hy + 0.55, -0.38 + k * 0.38);
  part(S, rbox(0.5, 0.8, 1.0, 0.15), POUCH, -0.62, hy + 0.9, 0);
  if (o.band !== null) part(S, new THREE.BoxGeometry(0.3, 0.26, 0.44), mat3(o.band || '#f2c230', 0.6), 0.02, hy + 1.1, 0.7);
  // neck, head, helmet or hat
  part(S, cyl(0.19, 0.22, 0.3, 10), SK, 0.04, hy + 1.52, 0);
  part(S, sph(0.4, 18, 12), SK, 0.06, hy + 1.85, 0);
  if (o.hat) part(S, cyl(0.44, 0.48, 0.35, 16), mat3(o.hat, 0.9), 0.03, hy + 2.12, 0);
  else {
    part(S, new THREE.SphereGeometry(0.52, 20, 10, 0, Math.PI * 2, 0, HALF_PI * 1.05), HEL, 0.02, hy + 1.92, 0).scale.set(1.05, 0.9, 1.0);
    part(S, cyl(0.54, 0.56, 0.08, 20), HEL, 0.02, hy + 1.9, 0);
  }
  // arms: shoulder -> elbow -> hand, posed for the weapon
  const gun = o.gun || 'rifle', sh = s => [0.02, hy + 1.28, s * 0.62];
  let hands;
  if (gun === 'rifle' || gun === 'mg') hands = [[[0.45, hy + 0.7, 0.62], [1.02, hy + 0.92, 0.28]], [[0.55, hy + 0.85, -0.55], [1.75, hy + 1.0, 0.24]]];
  else if (gun === 'rpg') hands = [[[0.4, hy + 0.95, 0.6], [0.75, hy + 1.45, 0.05]], [[0.5, hy + 1.0, -0.62], [1.35, hy + 1.5, -0.5]]];
  else hands = [[[0.3, hy + 0.7, 0.66], [0.8, hy + 0.75, 0.42]], [[0.3, hy + 0.7, -0.66], [0.8, hy + 0.75, -0.42]]];
  [1, -1].forEach((s, i) => {
    const [el, hd] = hands[i];
    limb(S, sh(s), el, 0.2, UNI);
    limb(S, el, hd, 0.18, UNI, HAND);
    part(S, sph(0.23, 12, 8), UNI, ...sh(s));
  });
  if (gun === 'rifle' || gun === 'mg') {
    const R = new THREE.Group(); R.position.set(0.9, hy + 1.15, 0.25); R.rotation.z = kneel ? 0.05 : -0.15; S.add(R);
    part(R, new THREE.BoxGeometry(gun === 'mg' ? 2.8 : 2.4, 0.18, 0.12), BK, 0.2, 0, 0);
    part(R, new THREE.BoxGeometry(0.22, 0.45, 0.1), BK, 0.1, -0.25, 0, 0, 0, 0.2);
    part(R, new THREE.BoxGeometry(0.2, 0.4, 0.1), BK, 0.55, -0.24, 0, 0, 0, -0.25);
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

// ---------- support ----------
// Bayraktar TB2 for the air strike fly-over: slim fuselage, long straight wing, inverted-V tail, pusher prop.
function m3TB2() {
  const P = new THREE.Group();
  const GR = mat3('#c3c8cc', 0.45, 0.1), DK = mat3('#3a3e42', 0.5, 0.3), GLASS = mat3('#223044', 0.1, 0.3);
  part(P, lathe([[-4.2, 0.2], [-3.4, 0.55], [-1, 0.8], [2.6, 0.85], [4.4, 0.6], [5.2, 0.15]], 1.1, 1), GR, 0, 0, 0);
  part(P, rbox(1.9, 0.18, 24, 0.08, 1), GR, 0.6, 0.55, 0);
  for (const s of [-1, 1]) {
    part(P, cyl(0.12, 0.12, 7, 8), GR, -4.1, 0.55, s * 2.3, 0, 0, HALF_PI);
    const t = part(P, rbox(1.4, 0.12, 2.8, 0.05, 1), GR, -7.5, 1.2, s * 3.2); t.rotation.x = -s * 0.7;
    part(P, rbox(0.6, 0.35, 0.3, 0.1, 1), DK, 0.6, 0.2, s * 5.5);
  }
  part(P, sph(0.5, 16, 10), DK, 3.4, -0.75, 0);
  part(P, new THREE.BoxGeometry(0.25, 0.3, 0.4), GLASS, 3.85, -0.8, 0);
  const pr = new THREE.Group(); pr.name = 'rotorX'; pr.position.set(-4.4, 0, 0); P.add(pr);
  for (const a of [0, Math.PI]) { const b = new THREE.Group(); b.rotation.x = a; pr.add(b); part(b, rbox(0.12, 1.5, 0.3, 0.05, 1), DK, 0, 0.75, 0); }
  return P;
}

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
  const rib = new THREE.Group(); rib.position.set(5.475, 3.125, 0); rib.rotation.z = -0.459; T.add(rib);
  for (let k = 0; k < 6; k++) part(rib, new THREE.BoxGeometry(0.3, 0.2, 4.8), LT, -1.55 + k * 0.62, 0.12, 0);
  // 3. side fender strip, rear doors with windows and handles
  for (const s of [-1, 1]) {
    part(T, new THREE.BoxGeometry(13.6, 0.15, 1.9), OL, -0.1, 2.62, s * 2.75);
    part(T, new THREE.BoxGeometry(1.5, 0.15, 1.9), OL, 6.85, 2.32, s * 2.75, 0, 0, 0.42);
  }
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
  for (const s of [-1, 1]) part(Tu, new THREE.BoxGeometry(3.9, 1.3, 0.12), OL, 0.05, 0.8, s * 1.0, s * -0.3, 0, 0);
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
  // 6. launch rack in the turret group: low turntable on the rear deck, 40-tube block raised 12°
  const Tu = new THREE.Group(); Tu.name = 'turret'; T.add(Tu);
  for (const s of [-1, 1]) part(Tu, rbox(14.6, 0.4, 0.5, 0.06, 1), DKS, 0.2, 2.6, s * 1.7);
  part(Tu, rbox(7.6, 1.3, 4.4, 0.08, 1), OD, -3.3, 3.45, 0);
  part(Tu, rbox(2.9, 0.8, 3.7, 0.1, 1), OL, -3.3, 4.5, 0);
  const BL = new THREE.Group(); BL.position.set(-3.35, 4.9, 0); BL.rotation.z = 0.21; Tu.add(BL);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 10; j++) {
    part(BL, cyl(0.26, 0.26, 6.5, 12), OL, 3.25, (i - 1.5) * 0.8 + 1.6, (j - 4.5) * 0.55, 0, 0, HALF_PI);
    part(BL, cyl(0.19, 0.19, 0.1, 10), mat3('#1a1c18', 0.8), 6.55, (i - 1.5) * 0.8 + 1.6, (j - 4.5) * 0.55, 0, 0, HALF_PI);
  }
  for (const s of [-1, 1]) part(BL, rbox(6.7, 3.3, 0.12, 0.05, 1), OD, 3.25, 1.6, s * 2.55);
  part(BL, rbox(1.3, 2.4, 5.6, 0.06, 1), OD, -0.65, 1.2, 0);
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
// Built by the reviewer (the card needed a fuselage skeleton). Nose at +x, coaxial rotors.
function m3Ka52() {
  const H = new THREE.Group();
  const BODY = mat3('#4f5646', 0.55, 0.1), DARK = mat3('#33372e', 0.6, 0.2), BELLY = mat3('#7d858a', 0.6, 0.1);
  const GLASS = mat3('#223044', 0.1, 0.3), MET = mat3('#5d625c', 0.45, 0.5), BK = mat3('#23251f', 0.6, 0.3);
  const y0 = 3.1;
  // fuselage: slim, tall cross-section, tapering into the tail boom
  part(H, lathe([[-10.4, 0.28], [-8, 0.42], [-5.5, 0.62], [-3.6, 1.15], [-1.8, 1.65], [0.5, 1.8], [3, 1.75], [5, 1.55], [6.6, 1.2], [7.8, 0.75], [8.6, 0.25]], 1.35, 0.92), BODY, 0, y0, 0);
  part(H, lathe([[-3, 0.9], [0, 1.25], [3, 1.2], [5.5, 0.9]], 0.55, 0.95), BELLY, 0, y0 - 1.5, 0);
  // side-by-side cockpit under one large canopy, framed
  const cp = part(H, sph(1, 28, 16), GLASS, 5.4, y0 + 1.25, 0); cp.scale.set(2.5, 1.05, 1.55);
  part(H, new THREE.BoxGeometry(4.6, 0.12, 0.12), DARK, 5.4, y0 + 2.3, 0);
  for (const x of [4.1, 6.4]) { const f = part(H, new THREE.TorusGeometry(1.35, 0.08, 6, 20, Math.PI), DARK, x, y0 + 1.25, 0, 0, HALF_PI, 0); f.scale.set(1, 0.85, 1.1); }
  // nose sensor ball
  part(H, sph(0.62, 18, 12), DARK, 7.4, y0 - 1.05, 0);
  part(H, new THREE.BoxGeometry(0.2, 0.4, 0.55), GLASS, 7.95, y0 - 1.05, 0);
  // engine nacelles with intakes and angled exhausts
  for (const s of [-1, 1]) {
    part(H, lathe([[-2.6, 0.45], [-1.5, 0.72], [1.5, 0.75], [2.6, 0.6]], 1.05, 1), BODY, 0, y0 + 2.05, s * 1.35);
    part(H, cyl(0.52, 0.52, 0.12, 18), BK, 2.65, y0 + 2.05, s * 1.35, 0, 0, HALF_PI);
    const ex = part(H, cyl(0.42, 0.36, 1.1, 14), DARK, -3.0, y0 + 2.15, s * 1.6, 0, 0, HALF_PI); ex.rotation.y = s * 0.45;
  }
  // stub wings with pylons: Vikhr tubes outboard, B-8 rocket pods inboard
  for (const s of [-1, 1]) {
    const w = part(H, rbox(1.8, 0.24, 3.4, 0.1), BODY, 0.6, y0 - 0.3, s * 3.2); w.rotation.x = s * 0.08;
    part(H, rbox(1.1, 0.5, 0.8, 0.1), DARK, 0.9, y0 - 0.2, s * 4.9);
    part(H, new THREE.BoxGeometry(0.9, 0.5, 0.2), DARK, 0.6, y0 - 0.65, s * 2.5);
    part(H, lathe([[-1.2, 0.2], [-1, 0.45], [1.2, 0.45], [1.35, 0.3]], 1, 1, 18), mat3('#4a4e44', 0.55, 0.2), 0.6, y0 - 1.15, s * 2.5);
    part(H, cyl(0.36, 0.36, 0.06, 16), BK, 1.97, y0 - 1.15, s * 2.5, 0, 0, HALF_PI);
    part(H, new THREE.BoxGeometry(0.9, 0.35, 0.2), DARK, 0.6, y0 - 0.55, s * 4.3);
    for (const [dy, dz] of [[-0.2, -0.2], [-0.2, 0.2], [-0.58, -0.2], [-0.58, 0.2]]) part(H, cyl(0.16, 0.16, 3.2, 10), mat3('#6b705a', 0.5, 0.1), 0.8, y0 - 0.85 + dy, s * 4.3 + dz, 0, 0, HALF_PI);
  }
  // 30 mm cannon on the right side
  part(H, rbox(2.6, 0.6, 0.6, 0.15), DARK, 1.6, y0 - 0.95, -1.55);
  part(H, cyl(0.1, 0.12, 4.2, 10), BK, 4.6, y0 - 0.95, -1.55, 0, 0, HALF_PI);
  // tail: stabiliser with twin fins at its tips
  part(H, rbox(1.5, 0.14, 3.8, 0.06), BODY, -8.7, y0 + 0.2, 0);
  for (const s of [-1, 1]) { const f = part(H, profile([[-1, 0], [0.6, 0], [0.9, 2.2], [-0.4, 2.2]], 0.14, 0.03), BODY, -8.8, y0 - 0.6, s * 1.9); f.rotation.x = -s * 0.08; }
  part(H, profile([[-1.2, 0], [0.4, 0], [0.2, 1.3], [-1.0, 1.4]], 0.16, 0.03), BODY, -9.6, y0 + 0.2, 0);
  // coaxial rotors: mast, lower (counter-rotating) and upper hubs
  part(H, cyl(0.3, 0.38, 3.2, 14), MET, 0.6, y0 + 3.4, 0);
  part(H, rbox(2.2, 0.8, 1.6, 0.3), BODY, 0.4, y0 + 2.2, 0);
  const lo = new THREE.Group(); lo.name = 'rotorYr'; lo.position.set(0.6, y0 + 3.6, 0); H.add(lo); rotor(lo, 3, 8.6, 0.6);
  const up = new THREE.Group(); up.name = 'rotorY'; up.position.set(0.6, y0 + 4.8, 0); up.rotation.y = Math.PI / 3; H.add(up); rotor(up, 3, 8.6, 0.6);
  part(H, sph(0.28, 12, 8), MET, 0.6, y0 + 5.15, 0);
  return H;
}
MODEL3D.ka52 = m3Ka52;

// ---------- T-27 米-8 mi8 ----------
// Built by the reviewer. Nose at +x; five-blade main rotor, tail rotor on the left of the boom.
function m3Mi8() {
  const H = new THREE.Group();
  const BODY = mat3('#5a5f4b', 0.6, 0.08), DARK = mat3('#3f4234', 0.65, 0.15), GLASS = mat3('#223044', 0.1, 0.3);
  const MET = mat3('#5d625c', 0.45, 0.5), RUB = mat3('#1e201d', 0.9), BK = mat3('#23251f', 0.6, 0.3);
  const y0 = 3.5;
  // cabin fuselage: round glazed nose, long cabin, rounded clamshell rear, tail boom
  part(H, lathe([[-13.2, 0.32], [-10, 0.45], [-7, 0.62], [-5.6, 1.1], [-4.6, 1.85], [-3.4, 2.15], [5.5, 2.15], [7.2, 2.0], [8.6, 1.55], [9.5, 0.9], [9.9, 0.2]], 1.08, 1.0), BODY, 0, y0, 0);
  // nose glazing: upper front quarter as glass with frames
  const ng = part(H, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI, 0, HALF_PI), GLASS, 8.2, y0 + 0.1, 0, 0, HALF_PI, 0); ng.scale.set(1.95, 1.85, 1.85);
  for (const a of [-0.55, 0, 0.55]) { const f = part(H, new THREE.BoxGeometry(2.1, 0.08, 0.08), DARK, 8.9, y0 + 1.1, a * 1.6); f.rotation.z = -0.55; }
  part(H, new THREE.TorusGeometry(1.95, 0.07, 6, 24, Math.PI), DARK, 7.6, y0 + 0.05, 0, 0, HALF_PI, 0);
  for (const s of [-1, 1]) part(H, rbox(1.2, 0.9, 0.08, 0.1, 1), GLASS, 6.4, y0 + 0.9, s * 2.02);
  // round cabin windows both sides, sliding door on the left, clamshell seam at the rear
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) part(H, cyl(0.34, 0.34, 0.1, 16), GLASS, -2.8 + i * 1.35, y0 + 0.75, s * 2.14, HALF_PI);
  part(H, new THREE.BoxGeometry(1.8, 2.5, 0.06), DARK, 4.4, y0 - 0.1, 2.16);
  part(H, new THREE.BoxGeometry(1.6, 2.3, 0.06), BODY, 4.4, y0 - 0.1, 2.19);
  part(H, new THREE.BoxGeometry(0.08, 3.4, 0.08), DARK, -5.0, y0 - 0.2, 0);
  // engines on the roof: dust-protection intakes in front, exhausts bent outwards
  part(H, rbox(9.5, 1.2, 3.0, 0.5), BODY, 1.0, y0 + 2.35, 0);
  for (const s of [-1, 1]) {
    part(H, lathe([[-2.5, 0.5], [-1.5, 0.72], [3, 0.72], [4.2, 0.6]], 1.05, 1), BODY, 0, y0 + 2.95, s * 0.85);
    const dp = part(H, sph(1, 20, 12), mat3('#6b705a', 0.7), 4.9, y0 + 2.95, s * 0.85); dp.scale.set(0.9, 0.75, 0.72);
    const ex = part(H, cyl(0.42, 0.36, 1.6, 14), BK, -3.1, y0 + 2.9, s * 1.35, 0, 0, HALF_PI); ex.rotation.y = s * 0.6;
  }
  part(H, rbox(2.4, 1.1, 1.8, 0.35), BODY, 0.3, y0 + 3.6, 0);
  // external fuel tanks with brackets
  for (const s of [-1, 1]) {
    part(H, lathe([[-2.2, 0.2], [-1.8, 0.62], [1.8, 0.62], [2.3, 0.2]], 1, 1, 20), BODY, 1.0, y0 - 1.3, s * 2.75);
    for (const x of [0, 2]) part(H, new THREE.BoxGeometry(0.2, 0.7, 0.5), DARK, x, y0 - 0.9, s * 2.35);
  }
  // landing gear: twin nose wheels, main wheels on struts
  part(H, cyl(0.1, 0.1, 1.6, 8), MET, 7.4, y0 - 2.2, 0);
  for (const s of [-1, 1]) part(H, cyl(0.42, 0.42, 0.28, 16), RUB, 7.4, 0.42, s * 0.35, HALF_PI);
  for (const s of [-1, 1]) {
    const st = part(H, cyl(0.1, 0.1, 2.4, 8), MET, -0.8, 1.6, s * 2.5); st.rotation.x = s * 0.5;
    for (const d of [-0.2, 0.2]) part(H, cyl(0.58, 0.58, 0.3, 18), RUB, -0.8, 0.58, s * 3.1 + d, HALF_PI);
  }
  // tail boom end: fin, small stabilisers, tail rotor
  part(H, profile([[-1.4, 0], [0.8, 0], [0.2, 2.6], [-1.2, 2.8]], 0.18, 0.04), BODY, -12.4, y0 + 0.1, 0);
  for (const s of [-1, 1]) part(H, rbox(1.2, 0.12, 1.4, 0.05), BODY, -10.6, y0 - 0.1, s * 0.9);
  const tr = new THREE.Group(); tr.name = 'rotorZ'; tr.position.set(-12.6, y0 + 2.2, 0.35); H.add(tr);
  part(tr, cyl(0.25, 0.25, 0.3, 12), MET, 0, 0, 0, HALF_PI);
  for (let i = 0; i < 3; i++) { const b = new THREE.Group(); b.rotation.z = i / 3 * Math.PI * 2; tr.add(b); part(b, rbox(0.3, 1.9, 0.08, 0.04, 1), mat3('#2d302a', 0.6, 0.2), 0, 1.0, 0.1); }
  // five-blade main rotor
  part(H, cyl(0.32, 0.4, 1.4, 14), MET, 0.3, y0 + 4.6, 0);
  const mr = new THREE.Group(); mr.name = 'rotorY'; mr.position.set(0.3, y0 + 5.3, 0); H.add(mr); rotor(mr, 5, 10, 0.7, '#2d302a', 0.6);
  return H;
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
  const WALL = mat3('#bdb7a8', 0.85), SEAM = mat3('#9d978a', 0.85), ROOFC = mat3('#7d796f', 0.7), FR = mat3('#d8d2c4', 0.8), TAR = mat3('#5f5c56', 0.95);
  const LIT = mat3('#f6d57a', 0.25, 0, { emissive: lin('#f0ad3a'), emissiveIntensity: 0.8 }), DKW = mat3('#2d3440', 0.3);
  const RAIL1 = mat3('#b9b3a4', 0.8), RAIL2 = mat3('#8e8a7e', 0.8), DKS = mat3('#2d302a', 0.6, 0.3);
  const INT = mat3('#4a433a', 0.95), SOOT = mat3('#1f1c19', 1), RUB = mat3('#8f897c', 0.95), RUBD = mat3('#6a655b', 0.95);
  const FL = 3.1, FH = 15.5, X1 = 8.15;
  // where each floor starts along x. Intact: the whole length. Damaged: the -x end is bitten off in a
  // ragged diagonal, the upper floors missing more than the lower ones.
  const ends = [0, 1, 2, 3, 4].map(f => dmg ? [-7.7, -6.9, -5.4, -3.4, -1.2][f] + (f ? (hash(seed, f, 30) - 0.5) * 0.8 : 0) : -X1);
  const topX = ends[4];
  function win(x, y, z, ry, lit, burnt) {
    const W = new THREE.Group(); W.position.set(x, y, z); W.rotation.y = ry; B.add(W);
    part(W, new THREE.BoxGeometry(1.45, 1.65, 0.1), lit ? LIT : DKW, 0, 0, 0);
    for (const [w, h, dx, dy] of [[1.75, 0.14, 0, 0.9], [1.75, 0.14, 0, -0.9], [0.14, 1.85, -0.76, 0], [0.14, 1.85, 0.76, 0]]) part(W, new THREE.BoxGeometry(w, h, 0.13), burnt ? DKS : FR, dx, dy, 0.02);
  }
  // 1. main body, floor by floor so the damaged end can step down
  if (!dmg) part(B, rbox(2 * X1, FH, 11, 0.18), WALL, 0, FH / 2, 0);
  else for (let f = 0; f < 5; f++) { const w = X1 - ends[f]; part(B, rbox(w, FL, 11, 0.1), WALL, (X1 + ends[f]) / 2, f * FL + FL / 2, 0); }
  // 2. panel seams: horizontal strips at each floor line, a few vertical strips
  for (let f = 1; f <= 5; f++) { const x0 = ends[f - 1]; part(B, new THREE.BoxGeometry(X1 - x0, 0.11, 11.05), SEAM, (X1 + x0) / 2, f * FL, 0); }
  for (const vx of [-4.0, 0.2, 4.4]) {
    const n = ends.filter(e => e < vx - 0.2).length;
    if (n) part(B, new THREE.BoxGeometry(0.1, n * FL, 11.08), SEAM, vx, n * FL / 2, 0);
  }
  // 3+4. windows and balconies, floor by floor. Near the break the windows are dark and the frames burnt.
  const winXs = [-6.45, -3.225, 0, 3.225, 6.45];
  const near = (x, f) => dmg && (x < ends[f] + 3.6 || (f >= 2 && x < topX + 3));
  for (let f = 0; f < 5; f++) {
    const y = f * FL + 1.75;
    winXs.forEach((wx, wi) => {
      if (wx - 0.9 < ends[f]) return;
      const dark = near(wx, f);
      win(wx, y, 5.56, 0, !dark && hash(seed, f, wi) < 0.34, dark);
      win(wx, y, -5.56, Math.PI, !dark && hash(seed, f + 5, wi) < 0.34, dark);
    });
    for (const wx of [-5.95, -0.4, 5.95]) {
      if (wx - 1.3 < ends[f]) continue;
      const yy = f * FL + 0.12;
      part(B, rbox(2.3, 0.16, 1.35, 0.06, 1), WALL, wx, yy + 0.05, 5.55);
      part(B, new THREE.BoxGeometry(2.3, 0.9, 0.12), hash(seed, f, wx) < 0.5 ? RAIL1 : RAIL2, wx, yy + 0.6, 6.15);
      for (const dx of [-1.1, 1.1]) part(B, new THREE.BoxGeometry(0.12, 0.9, 1.3), WALL, wx + dx, yy + 0.6, 5.98);
      win(wx - 0.6, y, 5.56, 0, false, near(wx, f));
    }
    win(7.9, y, 2.3, HALF_PI, hash(seed, f, 7) < 0.34); win(7.9, y, -2.3, HALF_PI, hash(seed, f, 8) < 0.34);
  }
  // 5. two entrances on the +x side with concrete canopies and a small lamp
  for (const dz of [2.2, -2.2]) {
    part(B, rbox(0.14, 2.3, 1.25, 0.05, 1), DKS, 8.16, 1.15, dz);
    part(B, rbox(0.95, 0.14, 1.8, 0.05, 1), SEAM, 8.45, 2.45, dz);
    part(B, new THREE.BoxGeometry(0.12, 0.16, 0.16), LIT, 8.35, 2.7, dz + dz * 0.35);
  }
  // 6. roof: parapet, bitumen, stairwell exits, vent pipes, TV antennas (only over what is still standing)
  const rw = X1 - topX, rc = (X1 + topX) / 2;
  part(B, rbox(rw, 0.5, 0.3, 0.05, 1), ROOFC, rc, FH + 0.2, 5.4);
  part(B, rbox(rw, 0.5, 0.3, 0.05, 1), ROOFC, rc, FH + 0.2, -5.4);
  part(B, rbox(0.3, 0.5, 11.0, 0.05, 1), ROOFC, 8.0, FH + 0.2, 0);
  if (!dmg) part(B, rbox(0.3, 0.5, 11.0, 0.05, 1), ROOFC, -8.0, FH + 0.2, 0);
  part(B, new THREE.BoxGeometry(rw - 0.6, 0.08, 10.4), TAR, rc + (dmg ? 0.3 : 0), FH + 0.02, 0);
  const onRoof = x => x > topX + 1.2;
  for (const [ex, ez] of [[2.2, 1.6], [-1.8, -1.4]]) if (onRoof(ex - 0.9)) part(B, rbox(1.7, 1.15, 1.5, 0.1, 1), WALL, ex, FH + 0.55, ez);
  for (const [vx, vz] of [[4.6, 2.4], [3.4, -2.2], [-0.6, 2.8], [-2.4, -2.6]]) if (onRoof(vx)) part(B, cyl(0.18, 0.18, 0.85, 10), ROOFC, vx, FH + 0.6, vz);
  for (const [ax, az] of [[0.4, -2.0], [-2.6, 2.2]]) {
    if (!onRoof(ax)) continue;
    part(B, cyl(0.05, 0.05, 2.6, 6), DKS, ax, FH + 1.4, az);
    part(B, new THREE.BoxGeometry(1.3, 0.05, 0.05), DKS, ax, FH + 2.1, az);
  }
  if (!dmg) return B;
  // 7. damaged state
  for (let f = 0; f < 5; f++) {
    const e = ends[f], y0 = f * FL, top = f === 4 || ends[f + 1] - e > 0.5;
    // the broken end of each floor: dark gutted rooms behind a torn edge
    part(B, new THREE.BoxGeometry(0.1, FL - 0.4, 10.2), INT, e - 0.03, y0 + FL / 2, 0);
    // ragged teeth of outer wall panel sticking out past the break, front and back, different lengths
    for (const [z, k] of [[5.3, 0], [-5.3, 1]]) {
      const len = 0.6 + hash(seed, f, 31 + k) * 1.4, h = FL * (0.35 + hash(seed, f, 33 + k) * 0.55);
      part(B, new THREE.BoxGeometry(len, h, 0.4), WALL, e - len / 2, y0 + h / 2, z);
    }
    // floor slab edge at the top of the floor, cracked and jutting out a little
    if (top) part(B, new THREE.BoxGeometry(0.7, 0.28, 10.4), SEAM, e - 0.3, y0 + FL - 0.1, 0, 0, 0, (hash(seed, f, 35) - 0.5) * 0.3);
    // rebar out of the slab edge, bent downward
    for (let k = 0; k < 4; k++) {
      const z = -4 + k * 2.6 + (hash(seed, f, 36 + k) - 0.5) * 1.2, droop = 0.15 + hash(seed, f, 40 + k) * 0.5;
      part(B, cyl(0.05, 0.05, 1.5, 5), DKS, e - 0.7, y0 + FL - 0.1 - droop * 0.5, z, 0, 0, HALF_PI - droop);
    }
    // gutted floor surface: a little rubble on each exposed ledge
    if (f < 4) for (let k = 0; k < 3; k++) {
      const x = e + 0.3 + hash(seed, f, 45 + k) * Math.max(0.2, ends[f + 1] - e - 0.6), z = (hash(seed, f, 48 + k) - 0.5) * 9, r = 0.3 + hash(seed, f, 51 + k) * 0.35;
      part(B, rbox(r * 2, r, r * 1.5, 0.06, 1), k % 2 ? RUB : RUBD, x, y0 + FL + r / 2, z, 0, hash(seed, f, 54 + k) * 3, 0);
    }
  }
  // two big floor slabs torn loose, hanging from the upper floors down toward the heap
  for (const [f, z, len, rz] of [[3, 1.8, 4.6, 0.95], [4, -2.2, 3.8, 1.25]]) {
    const G = new THREE.Group(); G.position.set(ends[f] + 0.1, f * FL + FL - 0.15, z); G.rotation.z = rz; G.rotation.x = (hash(seed, f, 60) - 0.5) * 0.3; B.add(G);
    part(G, new THREE.BoxGeometry(len, 0.32, 3.2), SEAM, -len / 2, 0, 0);
    for (const dz of [-1, 0.2, 1.2]) part(G, cyl(0.045, 0.045, 1.0, 5), DKS, -len - 0.05, 0, dz, 0, 0, HALF_PI);
  }
  // the heap of broken panels at the foot of the collapse
  part(B, cyl(0.6, 3.2, 3.2, 7), RUB, -6.6, 1.6, 0, 0, hash(seed, 0, 61) * 3, 0).scale.set(1, 1, 1.35);
  for (let k = 0; k < 16; k++) {
    const a = hash(seed, k, 62) * Math.PI * 2, d = 0.8 + hash(seed, k, 63) * 2.6, r = 0.4 + hash(seed, k, 64) * 0.7;
    const x = Math.max(-9.2, Math.min(-4.2, -6.6 + Math.cos(a) * d)), z = Math.max(-5.4, Math.min(5.4, Math.sin(a) * d * 1.5));
    const y = Math.max(r / 2, (3.2 - d) * 0.9);
    const piece = k % 4 === 0 ? new THREE.BoxGeometry(r * 3.4, 0.25, r * 2.4) : rbox(r * 2, r, r * 1.6, 0.06, 1);
    part(B, piece, [WALL, RUB, RUBD, SEAM][k % 4], x, y, z, (hash(seed, k, 65) - 0.5) * 0.9, hash(seed, k, 66) * 3, (hash(seed, k, 67) - 0.5) * 0.9);
  }
  // soot: fire has blackened the facade around the break, streaking upward, and the roof edge
  for (const [z, s] of [[5.58, 0], [-5.58, 1]]) for (let k = 0; k < 3; k++) {
    const f = 1 + k, x = ends[f] + 0.9 + hash(seed, k, 70 + s) * 1.6, w = 1.4 + hash(seed, k, 72 + s) * 1.4, h = 2.2 + hash(seed, k, 74 + s) * 2;
    part(B, new THREE.BoxGeometry(w, h, 0.06), SOOT, x, f * FL + 1.2 + h / 2 - 0.6, z);
  }
  part(B, new THREE.BoxGeometry(2.2, 0.12, 10.8), SOOT, topX + 1.1, FH + 0.06, 0);
  return B;
}
MODEL3D['bld:b'] = m3BldB;

// ---------- T-31 教堂 bld:c ----------
function m3BldC(seed, dmg) {
  const B = new THREE.Group();
  const WALL = mat3('#d8d2c4', 0.85), BLUE = mat3('#3b6fb6', 0.6), ROOFG = mat3('#4a705d', 0.7), ROOFD = mat3('#3d5e4d', 0.75);
  const DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3), GOLD = mat3('#d9a93a', 0.3, 0.8);
  const INK = mat3('#141614', 0.9), SOOT = mat3('#1f1c19', 1), BASE = mat3('#8d887d', 0.9);
  const WH = 5.0, RH = 3.2, HX = 6.0, HZ = 4.5, OV = 0.6;   // wall height, roof rise, half length, half width, eave overhang
  // 1. chapel body: 12 x 9 footprint, low walls on a grey plinth; triangular gables carry the roof
  part(B, rbox(12.3, 0.5, 9.3, 0.1, 1), BASE, 0, 0.25, 0);
  part(B, rbox(2 * HX, WH, 2 * HZ, 0.14), WALL, 0, WH / 2, 0);
  const gs = new THREE.Shape(); gs.moveTo(-HZ, 0); gs.lineTo(HZ, 0); gs.lineTo(0, RH); gs.closePath();
  const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.3, bevelEnabled: false });
  part(B, gg, WALL, HX - 0.3, WH, 0, 0, HALF_PI, 0);
  part(B, gg, WALL, -HX, WH, 0, 0, HALF_PI, 0);
  // 2. three arched windows per long side: glass, semicircular top, blue frame
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const wx = -3.6 + k * 3.4, wy = 2.5, wz = s * (HZ + 0.03);
    const burnt = dmg && k === 1;
    part(B, new THREE.BoxGeometry(1.2, 1.5, 0.1), burnt ? INK : GLS, wx, wy - 0.45, wz);
    part(B, new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16, 1, false, -HALF_PI, Math.PI), burnt ? INK : GLS, wx, wy + 0.3, wz, HALF_PI, 0, 0);
    part(B, new THREE.CylinderGeometry(0.72, 0.72, 0.08, 16, 1, false, -HALF_PI, Math.PI), BLUE, wx, wy + 0.3, s * (HZ + 0.01), HALF_PI, 0, 0);
    for (const dx of [-0.68, 0.68]) part(B, new THREE.BoxGeometry(0.14, 1.6, 0.12), BLUE, wx + dx, wy - 0.5, s * (HZ + 0.04));
    part(B, new THREE.BoxGeometry(1.6, 0.12, 0.25), BLUE, wx, wy - 1.25, s * (HZ + 0.08));
    if (burnt) part(B, new THREE.BoxGeometry(2.0, 2.2, 0.05), SOOT, wx, wy + 1.4, s * (HZ + 0.03));
  }
  // 3. green pitched roof, ridge along x; each slope in three lengthwise pieces so one can be holed when damaged
  const slope = Math.atan2(RH, HZ), sl = Math.hypot(HZ + OV, RH * (HZ + OV) / HZ);
  for (const s of [-1, 1]) {
    const R = new THREE.Group(); R.position.set(0, WH + RH + 0.12, 0); R.rotation.x = s * slope; B.add(R);
    for (const [px, pw] of [[-4.3, 4.6], [0, 4.0], [4.3, 4.6]]) {
      if (dmg && s === 1 && px === 0) continue;
      part(R, rbox(pw, 0.24, sl, 0.06, 1), ROOFG, px, 0, s * sl / 2);
    }
    // standing seams down the slope
    for (let k = 0; k < 11; k++) {
      const x = -6.2 + k * 1.24;
      if (dmg && s === 1 && Math.abs(x) < 2) continue;
      part(R, new THREE.BoxGeometry(0.07, 0.08, sl), ROOFD, x, 0.15, s * sl / 2);
    }
    if (dmg && s === 1) {
      // the hole: charred rafters across it, dark inside
      for (const [x, rz] of [[-1.2, 0.15], [0.3, -0.25], [1.4, 0.35]]) part(R, new THREE.BoxGeometry(0.14, 0.14, sl * 0.8), mat3('#3a2e24', 0.95), x, -0.02, sl * 0.45, 0, rz, 0);
      part(B, new THREE.BoxGeometry(4.0, 0.05, 4.2), INK, 0, WH + 0.03, 2.2);
    }
  }
  part(B, cyl(0.16, 0.16, 12.9, 8), ROOFD, 0, WH + RH + 0.2, 0, 0, 0, HALF_PI);
  // 4. octagonal drum astride the ridge, four arched windows, golden onion dome, orthodox cross
  const DX = -0.5, DY = WH + RH - 0.6;
  part(B, cyl(1.9, 2.05, 3.4, 8), WALL, DX, DY + 1.7, 0, 0, Math.PI / 8, 0);
  part(B, cyl(2.2, 2.2, 0.25, 8), ROOFG, DX, DY + 3.45, 0, 0, Math.PI / 8, 0);
  for (const a of [0, HALF_PI, Math.PI, 3 * HALF_PI]) {
    const G = new THREE.Group(); G.position.set(DX + Math.cos(a) * 1.9, DY + 2.2, -Math.sin(a) * 1.9); G.rotation.y = a + HALF_PI; B.add(G);
    part(G, new THREE.BoxGeometry(0.5, 0.8, 0.1), GLS, 0, 0, 0);
    part(G, new THREE.CylinderGeometry(0.25, 0.25, 0.1, 10, 1, false, -HALF_PI, Math.PI), GLS, 0, 0.4, 0, HALF_PI, 0, 0);
  }
  const pts = [];
  for (const [r, h] of [[0.05, 0], [1.5, 0.3], [2.1, 1.3], [1.9, 2.6], [1.1, 3.6], [0.45, 4.3], [0.2, 4.9], [0.03, 5.3]]) pts.push(new THREE.Vector2(r, h));
  const ON = new THREE.Group(); ON.name = 'onion'; ON.position.set(DX, DY + 3.55, 0); B.add(ON);
  if (dmg) { ON.rotation.z = -0.55; ON.rotation.x = 0.2; }
  part(ON, new THREE.LatheGeometry(pts, 20), GOLD, 0, 0, 0);
  part(ON, cyl(0.05, 0.05, 1.5, 6), GOLD, 0, 5.8, 0);
  part(ON, new THREE.BoxGeometry(0.09, 0.09, 0.9), GOLD, 0, 6.1, 0);
  part(ON, new THREE.BoxGeometry(0.08, 0.08, 0.6), GOLD, 0, 5.7, 0);
  part(ON, new THREE.BoxGeometry(0.07, 0.07, 0.5), GOLD, 0, 5.35, 0, 0.5, 0, 0);
  // 5. porch on the +x face: gabled roof on two posts, arched door, three steps
  part(B, new THREE.BoxGeometry(0.1, 2.0, 1.4), INK, HX + 0.02, 1.5, 0);
  part(B, new THREE.CylinderGeometry(0.7, 0.7, 0.1, 14, 1, false, 0, Math.PI), INK, HX + 0.02, 2.5, 0, 0, 0, -HALF_PI);
  for (const z of [-1.3, 1.3]) part(B, cyl(0.14, 0.14, 2.9, 8), WALL, HX + 1.9, 1.95, z);
  const pr = Math.atan2(1.0, 1.7);
  for (const s of [-1, 1]) {
    const P = new THREE.Group(); P.position.set(HX + 1.0, 3.9, 0); P.rotation.x = s * pr; B.add(P);
    part(P, rbox(2.4, 0.16, 2.1, 0.04, 1), ROOFG, 0, 0, s * 1.0);
  }
  const ps = new THREE.Shape(); ps.moveTo(-1.6, 0); ps.lineTo(1.6, 0); ps.lineTo(0, 0.95); ps.closePath();
  part(B, new THREE.ExtrudeGeometry(ps, { depth: 0.15, bevelEnabled: false }), WALL, HX + 2.05, 3.4, 0, 0, HALF_PI, 0);
  part(B, new THREE.BoxGeometry(0.25, 0.25, 3.0), WALL, HX + 2.0, 3.35, 0);
  part(B, new THREE.BoxGeometry(2.2, 0.2, 3.0), WALL, HX + 1.1, 3.35, 0);
  for (let k = 0; k < 3; k++) part(B, rbox(2.6 - k * 0.5, 0.2, 3.2 - k * 0.3, 0.04, 1), BASE, HX + 1.4 + k * 0.25, 0.1 + k * 0.2, 0);
  if (!dmg) return B;
  // 6. damaged (on the +z side, which faces the camera): soot below the roof hole and on the gable, cracked plinth, rubble and fallen roof sheets
  part(B, new THREE.BoxGeometry(3.4, 1.6, 0.05), SOOT, 0.2, WH - 0.9, HZ + 0.03);
  part(B, new THREE.BoxGeometry(0.05, 1.8, 2.8), SOOT, -HX - 0.03, WH + 0.6, -1.0);
  for (let k = 0; k < 9; k++) {
    const x = -3 + hash(seed, k, 81) * 6, z = HZ + 0.8 + hash(seed, k, 82) * 2.4, r = 0.3 + hash(seed, k, 83) * 0.5;
    part(B, rbox(r * 2.2, r, r * 1.7, 0.06, 1), k % 3 ? WALL : BASE, x, r / 2, z, 0, hash(seed, k, 84) * 3, (hash(seed, k, 85) - 0.5) * 0.5);
  }
  for (const [x, z, ry] of [[-0.8, 6.9, 0.4], [1.6, 6.5, -0.7]]) part(B, rbox(2.2, 0.12, 1.6, 0.03, 1), ROOFG, x, 0.3, z, 0.25, ry, 0.1);
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
  const ARCH = mat3('#7a817b', 0.55, 0.35), WALLH = mat3('#737a70', 0.8), DKI = mat3('#1b1e22', 0.9), DKS = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3);
  const APRON = mat3('#9d9a92', 0.9), YEL = mat3('#c9a53a', 0.7);
  // 1. gable walls shaped like the arch cross-section (absarc), extruded 0.3 and turned to face +-x;
  // the front one has the 9 x 6 door opening cut out
  const gable = door => {
    const sh = new THREE.Shape();
    sh.moveTo(-6.5, 0); sh.lineTo(6.5, 0); sh.absarc(0, 2.3, 6.5, 0, Math.PI, false); sh.closePath();
    if (door) { const h = new THREE.Path(); h.moveTo(-4.5, 0); h.lineTo(-4.5, 6); h.lineTo(4.5, 6); h.lineTo(4.5, 0); h.closePath(); sh.holes.push(h); }
    return new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false });
  };
  part(T, gable(true), WALLH, 7.35, 0, 0, 0, HALF_PI, 0);
  part(T, gable(false), WALLH, -7.65, 0, 0, 0, HALF_PI, 0);
  // side walls below the spring line
  for (const s of [-1, 1]) part(T, rbox(15, 2.3, 0.3, 0.05, 1), WALLH, 0, 1.15, s * 6.4);
  // 2. arch roof from five lengthwise segments; two segments removed when damaged
  const segL = 3.0;
  for (let sgi = 0; sgi < 5; sgi++) {
    const sx = -7.5 + segL * (sgi + 0.5);
    if (dmg && (sgi === 1 || sgi === 3)) continue;
    part(T, new THREE.CylinderGeometry(6.55, 6.55, segL * 1.002, 24, 1, true, 0, Math.PI), ARCH, sx, 2.3, 0, 0, 0, HALF_PI);
    part(T, new THREE.CylinderGeometry(6.68, 6.68, 0.35, 24, 1, true, 0, Math.PI), DKS, -7.5 + segL * sgi + 0.05, 2.3, 0, 0, 0, HALF_PI);
  }
  // dark inner lining, seen through the holes when damaged
  if (dmg) part(T, new THREE.CylinderGeometry(6.35, 6.35, 14.8, 24, 1, true, 0, Math.PI), mat3('#1b1e22', 0.9, 0, { side: THREE.BackSide }), 0, 2.3, 0, 0, 0, HALF_PI);
  if (dmg) for (const [hx, hz] of [[-4.5, 3.2], [1.5, -3.2]]) {
    const fl = part(T, rbox(0.12, 1.4, 2.6, 0.04, 1), ARCH, hx, 6.4, hz); fl.rotation.x = 0.5; fl.rotation.y = 0.4;
  }
  // 3. door opening in the front gable: 9 wide, 6 high, dark inside; two sliding panels
  part(T, rbox(0.3, 6.0, 9.0, 0.05, 1), DKI, 6.6, 3.0, 0);
  const stiffen = (panel, z0) => { for (let k = 0; k < 4; k++) part(panel, new THREE.BoxGeometry(0.08, 5.6, 0.14), DKS, 0, 0, z0 + k * 1.05 - 1.6); };
  const P1 = new THREE.Group(); P1.position.set(7.75, 2.95, -2.25); T.add(P1);
  part(P1, rbox(0.14, 5.9, 4.5, 0.05, 1), WALLH, 0, 0, 0); stiffen(P1, 0);
  const P2 = new THREE.Group(); P2.position.set(7.9, 2.95, 4.4); T.add(P2);
  part(P2, rbox(0.14, 5.9, 4.5, 0.05, 1), WALLH, 0, 0, 0); stiffen(P2, 0);
  if (dmg) { P2.rotation.x = -0.45; P2.position.set(7.9, 2.6, 5.4); }
  // small side door and three high windows on one side
  part(T, rbox(0.1, 1.9, 1.0, 0.04, 1), DKS, -3.0, 0.95, 6.42);
  for (let k = 0; k < 3; k++) part(T, rbox(0.06, 0.7, 1.1, 0.03, 1), GLS, 2.2 + k * 1.7, 4.1, 6.32);
  // concrete apron, depth 2.6, yellow edge marking
  part(T, rbox(2.7, 0.1, 12.6, 0.05, 1), APRON, 8.8, 0.05, 0);
  part(T, rbox(0.2, 0.08, 12.4, 0.02, 1), YEL, 10.05, 0.09, 0);
  return T;
}
MODEL3D['bld:H'] = m3Hangar;

// ---------- T-33 废墟 bld:rubble 与断桥 prop:bridge ----------
function m3Rubble(seed) {
  const T = new THREE.Group();
  const CON1 = mat3('#9a958a', 0.85), CON2 = mat3('#7f7a70', 0.85), BRICK = mat3('#8f5a45', 0.85);
  const REB = mat3('#3a3530', 0.6, 0.4), BURNT = mat3('#1f1c19', 0.9), SNOW = mat3('#eef2f4', 0.75);
  const mats = [CON1, CON2, BRICK];
  // 1. a pile of randomly tilted concrete slabs and bricks
  for (let k = 0; k < 13; k++) {
    const w = 1.1 + hash(seed, k, 1) * 2.2, h = 0.3 + hash(seed, k, 2) * 0.35, d = 0.7 + hash(seed, k, 3) * 1.1;
    const a = hash(seed, k, 4) * Math.PI * 2, rr = hash(seed, k, 5) * 2.6;
    const sl = part(T, rbox(w, h, d, 0.05, 1), mats[k % 3], Math.cos(a) * rr, h / 2 + hash(seed, k, 6) * 2.6, Math.sin(a) * rr);
    sl.rotation.y = hash(seed, k, 7) * Math.PI; sl.rotation.z = (hash(seed, k, 8) - 0.5) * 0.8; sl.rotation.x = (hash(seed, k, 9) - 0.5) * 0.5;
  }
  // 2. wall remnant with a window hole, built from uneven segments
  part(T, rbox(0.5, 3.6, 1.6, 0.06, 1), CON1, -2.9, 1.8, -0.9);
  part(T, rbox(0.5, 2.2, 1.4, 0.06, 1), CON2, -2.7, 1.1, 1.0);
  part(T, rbox(0.5, 1.1, 3.6, 0.06, 1), CON1, -2.8, 3.2, 0.1);
  for (let k = 0; k < 4; k++) part(T, rbox(0.45, 0.4 + hash(seed, k, 11) * 0.5, 0.4, 0.04, 1), CON2, -2.8, 0.2 + hash(seed, k, 12) * 0.3, -1.9 + k * 1.1);
  // 3. bent exposed rebar
  for (const [bx, bz, by] of [[-1.4, 0.9, 1.2], [-2.2, 1.5, 2.6], [-0.8, -1.4, 0.9]]) {
    part(T, cyl(0.05, 0.05, 1.5, 6), REB, bx, by, bz, 0, 0, HALF_PI * 0.75);
    part(T, cyl(0.045, 0.045, 0.9, 6), REB, bx + 0.35, by + 0.75, bz + 0.2, 0, 0, -0.4);
  }
  // scattered snow and a scorched patch
  for (let k = 0; k < 4; k++) part(T, rbox(1.1 + hash(seed, k, 13) * 0.8, 0.05, 0.8, 0.03, 1), SNOW, -1.2 + hash(seed, k, 14) * 3.4, 2.3 + hash(seed, k, 15) * 1.6, (hash(seed, k, 16) - 0.5) * 4.4);
  part(T, rbox(3.4, 0.05, 2.6, 0.03, 1), BURNT, 1.8, 0.03, -1.2);
  return T;
}
function m3BridgeRuin() {
  const T = new THREE.Group();
  const CON1 = mat3('#858075', 0.85), CON2 = mat3('#6b675f', 0.85), REB = mat3('#3a3530', 0.6, 0.4);
  const PLANK = mat3('#8a6a48', 0.9);
  // piers from the riverbed
  for (const px of [-5.2, 0.9]) part(T, rbox(2.0, 5.2, 3.0, 0.1, 1), CON2, px, -0.4, 0);
  // deck segment A: horizontal, resting on the piers, reaching the -x road
  part(T, rbox(10.8, 0.45, 7.0, 0.06, 1), CON1, -4.7, 2.0, 0);
  part(T, rbox(10.9, 0.1, 7.04, 0.03, 1), CON2, -4.7, 2.26, 0);
  // deck segment B: broken at mid-span, slanting down into the water at +x
  const segB = part(T, rbox(9.6, 0.45, 7.0, 0.06, 1), CON2, 5.4, 0.4, 0); segB.rotation.z = -0.34;
  part(segB, rbox(0.5, 0.1, 7.04, 0.03, 1), CON1, 4.55, 0.26, 0);
  // jagged break edges and rebar on both stubs
  for (const [bx, by, bz, brx] of [[0.42, 2.3, 2.6, 0.25], [0.42, 2.3, -2.6, -0.3], [0.5, 2.0, 0.8, 0.1]]) part(T, cyl(0.05, 0.05, 1.4, 6), REB, bx, by, bz, brx, 0, 0.2);
  for (const [bx, by, bz, brz] of [[1.2, 1.9, 3.2, 1.35], [1.2, 1.6, -3.2, 1.2]]) part(T, cyl(0.05, 0.05, 1.5, 6), REB, bx, by, bz, 0, 0, brz);
  // remaining railings on segment A
  for (const [rx, rz] of [[-9.2, 3.3], [-7.0, 3.3], [-4.8, 3.3], [-9.2, -3.3], [-7.0, -3.3]]) part(T, rbox(0.14, 0.6, 0.14, 0.03, 1), CON2, rx, 2.55, rz);
  part(T, rbox(6.0, 0.1, 0.1, 0.03, 1), CON2, -7.0, 2.95, 3.3);
  part(T, rbox(6.0, 0.1, 0.1, 0.03, 1), CON2, -7.0, 2.95, -3.3);
  // 4. plank footbridge at z +5, y about -1.3: crosswise planks, posts, one handrail
  for (let k = 0; k < 31; k++) part(T, rbox(0.5, 0.12, 2.5, 0.02, 1), PLANK, -9.45 + k * 0.62, -1.3, 5.0);
  for (const px of [-8.9, -5.4, -1.6, 2.2, 5.8, 9.0]) part(T, rbox(0.3, 1.05, 0.3, 0.04, 1), mat3('#6b5238', 0.9), px, -1.28, 5.0);
  part(T, rbox(19.4, 0.08, 0.08, 0.03, 1), PLANK, 0.0, -0.62, 6.1);
  for (const px of [-8.9, -5.4, -1.6, 2.2, 5.8]) part(T, rbox(0.09, 0.62, 0.09, 0.03, 1), PLANK, px, -0.98, 6.1);
  return T;
}
MODEL3D['prop:bridge'] = m3BridgeRuin;


// ---------- T-42 托尔/谢尔纳/灯塔/TB2 ----------
function m3Tor() {
  const T = new THREE.Group();
  const OL = mat3('#5a5f4b', 0.6, 0.05), OD = mat3('#3f4234', 0.65, 0.05), LT = mat3('#686d58', 0.55, 0.05);
  const RUB = mat3('#1e201d', 0.9), STEEL = mat3('#5d625c', 0.45, 0.5), DKS = mat3('#2d302a', 0.6, 0.3);
  const RAD = mat3('#2b2f2a', 0.4, 0.2);
  // running gear: six road wheels per side with tracks, side skirts above
  for (const s of [-1, 1]) {
    const z = s * 2.5;
    for (let i = 0; i < 6; i++) {
      const x = -5.9 + i * 2.36;
      part(T, cyl(0.95, 0.95, 0.85, 22), RUB, x, 1.3, z, HALF_PI);
      part(T, cyl(0.76, 0.76, 0.95, 18), OD, x, 1.3, z, HALF_PI);
      part(T, cyl(0.3, 0.3, 1.05, 10), STEEL, x, 1.3, z, HALF_PI);
    }
    trackLoop(T, -7.2, 7.2, 1.4, 1.2, z, 1.9);
    part(T, rbox(13.6, 1.05, 0.16, 0.06, 1), OD, 0, 2.7, s * 3.05);
  }
  // hull 15 x 3.2 high, driver hatch at the front
  part(T, rbox(15, 3.2, 4.4, 0.2), OL, 0, 1.6, 0);
  part(T, cyl(0.6, 0.64, 0.16, 20), LT, 5.4, 3.28, -1.2);
  part(T, rbox(2.2, 0.35, 4.2, 0.08, 1), OD, -7.2, 3.35, 0);
  for (let k = 0; k < 5; k++) part(T, new THREE.BoxGeometry(0.14, 0.1, 3.6), DKS, -7.3 + k * 0.55, 3.3, 0);
  // turret group: boxy body, front tracking radar plate with bright frame, launch box lids
  const Tu = new THREE.Group(); Tu.name = 'turret'; Tu.position.set(-0.4, 3.2, 0); T.add(Tu);
  part(Tu, rbox(8, 3.4, 5.2, 0.14, 1), OL, 0.3, 1.7, 0);
  part(Tu, rbox(0.25, 3.2, 4.0, 0.05, 1), RAD, 4.35, 1.95, 0);
  for (const [fx, fy] of [[0, 1.68], [0, -1.68], [2.2, 1.9], [2.2, -1.9]]) part(Tu, new THREE.BoxGeometry(0.12, fy ? 0.16 : 3.3, fx ? 0.16 : 4.15), LT, 4.5 + (fx ? 0 : 0), 1.95 + (fy ? fy * 0 : 0), fx ? 0 : fy * 0 + (fy ? 0 : 0), 0, 0, 0);
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++)
    part(Tu, rbox(1.05, 0.1, 1.05, 0.04, 1), LT, -0.4 + j * 1.15, 3.5, s * (0.65 + k * 1.2));
  part(Tu, rbox(1.9, 0.55, 3.6, 0.08, 1), OD, 3.2, 3.55, 0);
  // rear exhaust grille
  for (let k = 0; k < 5; k++) part(T, new THREE.BoxGeometry(0.14, 0.75, 3.4), DKS, -7.15, 3.6, 0);
  // search radar panel 5 x 2.2, tilted back 25°, on two struts from the turret top
  const RS = new THREE.Group(); RS.position.set(-1.9, 6.75, 0); RS.rotation.z = 0.44; T.add(RS);
  part(RS, rbox(5, 2.2, 0.3, 0.06, 1), RAD, 0, 0, 0);
  part(RS, rbox(5.1, 0.14, 0.42, 0.03, 1), LT, 0, 1.18, 0);
  part(RS, rbox(5.1, 0.14, 0.42, 0.03, 1), LT, 0, -1.18, 0);
  for (const s of [-1, 1]) part(T, cyl(0.07, 0.09, 2.4, 8), STEEL, -1.6 + s * 0.5, 5.4, s * 0.85, 0, 0, s * 0.45);
  return T;
}
function m3Serna() {
  const T = new THREE.Group();
  const HULL = mat3('#6b7076', 0.6, 0.1), DK = mat3('#4d5156', 0.7, 0.1), DECK = mat3('#565a5c', 0.85), GLS = mat3('#223044', 0.1, 0.3), DKS = mat3('#2d302a', 0.6, 0.3), LT = mat3('#686d58', 0.55, 0.05);
  // boxy plan-view hull, waterline -1.8, bottom -1.8 (shallow draft like the card's raptor note)
  part(T, profile([[-8.5, -3.25], [-8.5, 3.25], [8.5, 3.25], [8.5, -3.25]], 4.0), HULL, 0, 0.2, 0, -HALF_PI);
  part(T, rbox(16.9, 0.12, 6.55, 0.04, 1), DECK, 0, 2.26, 0);
  // raised bow ramp at the front
  const ramp = part(T, rbox(2.6, 0.18, 5.4, 0.05, 1), DK, 8.0, 2.9, 0, 0, 0, -0.5);
  // open cargo hold midships: two canvas-covered piles
  part(T, rbox(4.4, 0.35, 4.6, 0.06, 1), DK, 1.9, 2.4, 0);
  part(T, rbox(1.75, 0.75, 1.9, 0.18, 1), mat3('#5f6350', 0.8), 1.15, 2.85, -1.05);
  part(T, rbox(1.75, 0.75, 1.9, 0.18, 1), mat3('#6a6e58', 0.8), 2.65, 2.85, 1.05);
  // two-story bridge at the stern quarter with mast and small radar
  part(T, rbox(3.5, 3.6, 4.5, 0.12, 1), HULL, -4.4, 4.05, 0);
  for (const s of [-1, 1]) part(T, rbox(0.08, 0.6, 1.4, 0.03, 1), GLS, -4.4, 4.9, s * 1.1);
  part(T, rbox(3.7, 0.16, 4.7, 0.05, 1), DK, -4.4, 5.92, 0);
  part(T, cyl(0.07, 0.09, 1.6, 8), DKS, -4.9, 6.75, 0);
  part(T, cyl(0.42, 0.42, 0.24, 14), mat3('#c9cfd3', 0.6), -4.35, 7.0, 0.75).scale.y = 0.55;
  // dark hull numbers on the bow sides
  for (const s of [-1, 1]) part(T, rbox(0.7, 0.5, 0.08, 0.04, 1), DKS, 6.6, 1.3, s * 2.6);
  return T;
}
function m3BldL(seed, dmg) {
  const B = new THREE.Group();
  const WALL = mat3('#d8d2c4', 0.8), PLINTH = mat3('#8b3a2e', 0.7), ROOFC = mat3('#8b3a2e', 0.7);
  const FR = mat3('#2d302a', 0.6, 0.3), GLS = mat3('#223044', 0.1, 0.3), SNOW = mat3('#eef2f4', 0.75);
  const H = dmg ? 8 : 13;
  // octagonal tower with a plinth ring; damaged: top broken ragged
  part(B, cyl(1.95, 2.1, 0.5, 8), PLINTH, 0, 0.25, 0);
  part(B, cyl(1.4, 1.7, H, 8), WALL, 0, 0.5 + H / 2, 0);
  if (!dmg) {
    part(B, cyl(2.1, 2.1, 0.3, 8), FR, 0, H + 0.5, 0);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; part(B, cyl(0.035, 0.035, 0.42, 6), FR, Math.cos(a) * 1.95, H + 0.82, Math.sin(a) * 1.95); }
    part(B, cyl(1.2, 1.3, 1.6, 8), FR, 0, H + 0.65 + 0.8, 0);
    part(B, cyl(1.02, 1.02, 0.1, 8), GLS, 0, H + 0.65 + 0.85, 0);
    const pts = [];
    for (const [r, h] of [[0.05, 0], [0.95, 0.35], [1.28, 1.0], [1.1, 1.7], [0.5, 2.3], [0.03, 2.75]]) pts.push(new THREE.Vector2(r, h));
    part(B, new THREE.LatheGeometry(pts, 12), mat3('#2d302a', 0.6, 0.2), 0, H + 2.25, 0);
  } else {
    for (const [w, h] of [[2.6, 3.1], [1.9, 4.6], [2.5, 2.4]]) part(B, rbox(w, h, 0.5, 0.06, 1), WALL, -0.2, h / 2, 0);
    part(B, rbox(0.16, 1.35, 0.16, 0.03, 1), FR, 0.3, H + 0.7, 0.3);
  }
  // keeper's cottage on the -z side, pitched roof
  part(B, rbox(7, 3.2, 4.5, 0.12, 1), WALL, -1.2, 1.6, -4.6);
  const slope = Math.atan2(1.6, 2.25);
  for (const s of [-1, 1]) {
    const R = new THREE.Group(); R.position.set(-1.2, 3.2, -4.6); R.rotation.x = s * slope; B.add(R);
    for (let k = 0; k < 5; k++) {
      if (dmg && s === -1 && k === 2) continue;
      part(R, new THREE.BoxGeometry(7.3, 0.16, 2.45), ROOFC, 0, 0.05 * k, s * (0.55 + k * 0.5));
    }
    if (!dmg || s === 1) part(R, rbox(7.3, 0.06, 1.1, 0.03, 1), SNOW, 0, 0.16, s * 1.1);
  }
  // door and a small window on the cottage
  part(B, rbox(0.1, 1.3, 0.7, 0.04, 1), mat3('#5a4632', 0.85), -3.6, 0.65, -4.6);
  part(B, rbox(0.08, 0.6, 0.8, 0.03, 1), GLS, -0.2, 1.9, -4.6);
  // damage extras: soot on the tower, rubble at the foot
  if (dmg) {
    part(B, rbox(1.4, 1.9, 0.1, 0.05, 1), mat3('#1f1c19', 1), 1.35, 4.6, 0.9);
    part(B, rbox(1.1, 1.4, 0.1, 0.05, 1), mat3('#1f1c19', 1), -1.2, 3.4, 0.9);
    for (const [rx, rz, rr] of [[1.4, 1.1, 0.8], [0.6, 1.9, 0.6], [2.0, 0.4, 0.5], [1.1, -0.6, 0.65]]) {
      const rub = part(B, rbox(rr * 2.2, rr, rr * 1.7, 0.06, 1), WALL, rx, rr / 2, rz); rub.rotation.y = rr * 3;
    }
  }
  return B;
}
MODEL3D.tor = m3Tor;
MODEL3D.serna = m3Serna;
MODEL3D['bld:L'] = m3BldL;
MODEL3D.tb2u = () => { const o = m3TB2(); o.scale.multiplyScalar(0.67); return o; };
