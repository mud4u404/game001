'use strict';
// ---------- small helpers shared by every module ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const EASE = {
  lin: k => k,
  out: k => 1 - (1 - k) ** 3,
  in: k => k * k * k,
  inOut: k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  back: k => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2,
};
function hash(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const COLS = 'ABCDEFGH';
const coord = (x, y) => COLS[x] + (y + 1);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Global animation speed. The automated playtest sets this near zero.
let SPEED = 1;
const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED));

const shadeCache = new Map();
function shade(hex, f) {
  f = Math.round(f * 50) / 50;
  const k = hex + f;
  let v = shadeCache.get(k);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g2 = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g2 += (255 - g2) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g2 *= 1 + f; b *= 1 + f; }
  v = `rgb(${r | 0},${g2 | 0},${b | 0})`;
  shadeCache.set(k, v);
  return v;
}

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
