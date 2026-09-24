'use strict';
// ---------- screens ----------
let SCENE = 'title';
const $ = id => document.getElementById(id);
const SCREENS = ['title', 'story', 'campaign', 'briefing', 'hud', 'debrief', 'gameover'];
function show(...ids) { for (const s of SCREENS) $(s).hidden = !ids.includes(s); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- pixel portraits ----------
const PORTRAITS = {};
function portrait(key) {
  if (PORTRAITS[key]) return PORTRAITS[key];
  const c = mkCanvas(40, 40), p = c.getContext('2d'), f = CHARS[key].face;
  const r = (x, y, w, h, col) => { p.fillStyle = col; p.fillRect(x, y, w, h); };
  const grad = p.createLinearGradient(0, 0, 0, 40); grad.addColorStop(0, '#2a3e52'); grad.addColorStop(1, '#131d27');
  p.fillStyle = grad; p.fillRect(0, 0, 40, 40);
  for (let i = 0; i < 40; i += 4) r(0, i, 40, 1, 'rgba(255,255,255,.03)');
  if (f.radio) {
    r(10, 14, 20, 16, '#3a4046'); r(12, 16, 16, 8, '#1b2a1f');
    for (let x = 0; x < 14; x++) r(13 + x, 20 - Math.round(Math.sin(x * 1.3) * 2), 1, 1, '#7bd650');
    r(26, 6, 2, 8, '#2a2d30'); r(13, 26, 3, 2, '#b33a2a'); r(18, 26, 3, 2, '#5b6166');
    PORTRAITS[key] = c; return c;
  }
  const U2 = f.uniform, S = f.skin, Hc = f.hair;
  r(4, 31, 32, 9, U2); r(4, 31, 32, 1, shade(U2, 0.2)); r(15, 29, 10, 4, shade(S, -0.15));
  r(28, 33, 5, 3, C.blue); r(28, 36, 5, 2, C.yel);
  r(17, 31, 6, 3, shade(U2, -0.25));
  r(12, 10, 16, 19, S); r(13, 28, 14, 2, S); r(11, 13, 1, 12, S); r(28, 13, 1, 12, S);
  r(12, 24, 16, 5, shade(S, -0.08));
  r(10, 17, 2, 5, shade(S, -0.1)); r(28, 17, 2, 5, shade(S, -0.1));
  r(15, 18, 3, 2, '#f4f0e8'); r(22, 18, 3, 2, '#f4f0e8'); r(16, 18, 2, 2, '#243040'); r(23, 18, 2, 2, '#243040');
  r(14, 16, 5, 1, shade(Hc, -0.2)); r(21, 16, 5, 1, shade(Hc, -0.2));
  r(19, 20, 2, 4, shade(S, -0.15)); r(17, 26, 6, 1, '#8a4a3a');
  if (f.style === 'bun') { r(11, 7, 18, 6, Hc); r(10, 9, 2, 12, Hc); r(28, 9, 2, 12, Hc); r(17, 4, 6, 4, Hc); }
  if (f.style === 'beanie') { r(11, 5, 18, 8, '#3f4a2a'); r(10, 11, 20, 2, '#4a5632'); r(10, 13, 2, 10, Hc); r(28, 13, 2, 12, Hc); r(26, 22, 3, 6, Hc); }
  if (f.style === 'helmet') { r(10, 5, 20, 8, '#4d5a33'); r(9, 11, 22, 3, '#56643a'); r(12, 6, 4, 2, '#65744a'); r(10, 14, 2, 4, '#3a4428'); r(28, 14, 2, 4, '#3a4428'); }
  if (f.style === 'tanker') { r(10, 5, 20, 9, '#2e2a24'); for (let x = 11; x < 30; x += 3) r(x, 5, 1, 9, '#3a352e'); r(9, 13, 4, 8, '#2e2a24'); r(27, 13, 4, 8, '#2e2a24'); r(9, 17, 3, 3, '#1c1a16'); r(28, 17, 3, 3, '#1c1a16'); }
  if (f.headset) { r(9, 15, 3, 6, '#2a2d30'); r(28, 15, 3, 6, '#2a2d30'); r(10, 7, 20, 2, '#2a2d30'); r(12, 24, 6, 1, '#2a2d30'); r(17, 24, 2, 2, '#2a2d30'); }
  if (f.mustache) { r(15, 24, 10, 2, f.mustache); r(14, 25, 2, 2, f.mustache); r(24, 25, 2, 2, f.mustache); }
  if (f.beard) { r(12, 23, 16, 6, f.beard); r(13, 29, 14, 1, f.beard); r(17, 26, 6, 1, '#8a4a3a'); r(11, 20, 2, 6, f.beard); r(27, 20, 2, 6, f.beard); }
  if (f.glasses) { r(14, 17, 5, 4, '#1a1a1a'); r(15, 18, 3, 2, '#9fc3d9'); r(21, 17, 5, 4, '#1a1a1a'); r(22, 18, 3, 2, '#9fc3d9'); r(19, 18, 2, 1, '#1a1a1a'); }
  PORTRAITS[key] = c; return c;
}
function portraitImg(key, cls) { const c = portrait(key); return `<img class="pf ${cls || ''}" alt="" src="${c.toDataURL()}">`; }
const PIMG = {};
function pimg(key) { if (!PIMG[key]) PIMG[key] = portrait(key).toDataURL(); return PIMG[key]; }

// ---------- toasts, banners, radio ----------
function toast(text, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = text;
  $('toasts').prepend(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}
let banT = null;
function banner(text, kind) {
  const b = $('banner');
  b.querySelector('span').textContent = text;
  b.className = 'banner ' + (kind || '');
  void b.offsetWidth; b.classList.add('show');
  clearTimeout(banT); banT = setTimeout(() => b.classList.remove('show'), 1500 * Math.max(SPEED, 0.2));
}
let hintT = null;
function hint(text) { const h = $('hint'); h.textContent = text; h.classList.add('show'); clearTimeout(hintT); hintT = setTimeout(() => h.classList.remove('show'), 3500); }
const BARKS = {
  start: [['oksana', '“向日葵”，情报已经标在你们的地图上。红色是敌人下一步要打的地方。']],
  turn: [['oksana', '新的敌情已更新，注意红色标记。'], ['ivanna', '炮位已经校准，等你们的坐标。'], ['mykola', '发动机还热着，随时可以动。'], ['taras', '又一波。保持冷静，一个一个来。'], ['radio', '“……这里是‘雪松’，前方有反坦克小组，请求炮火支援……”'], ['radio', '“……燃料不够了，车队原地待命……”']],
  kill: { t64: [['mykola', '打中了！下一个！']], atgm: [['taras', '命中顶部装甲。']], d30: [['ivanna', '落点准确。']], tb2: [['oksana', 'TB2 命中目标。']] },
  heli: [['taras', '直升机下来了！']],
  orlan: [['oksana', '无人机被打下来了。他们的炮兵现在是瞎子。']],
  crater: [['ivanna', '跑道上又多了一个坑。']],
  evac: [['oksana', '又一批人过了河。继续守住那条路。']],
  cmd: [['oksana', '指挥车被摧毁，他们的无线电全乱了。']],
  hurt: { t64: [['mykola', '装甲还扛得住……再挨一发就不行了。']], atgm: [['taras', '我们被压制了，快掩护我们！']], d30: [['ivanna', '炮位中弹！还能打，但撑不了多久。']] },
};
let radioT = null;
function radio(key, text) {
  const r = $('radio');
  r.innerHTML = `<img class="pf" alt="" src="${pimg(key)}"><div><b>${esc(CHARS[key].call)}</b><span>${esc(text)}</span></div>`;
  r.classList.add('show');
  clearTimeout(radioT); radioT = setTimeout(() => r.classList.remove('show'), 4200);
}
function bark(kind, u) {
  let pool = BARKS[kind];
  if (!pool) return;
  if (!Array.isArray(pool)) pool = pool[(u && u.type) || 'tb2'];
  if (!pool) return;
  if (kind === 'turn' && Math.random() < 0.45) return;
  if (kind === 'crater') { if (B.said.crater) return; B.said.crater = 1; }
  if (kind === 'hurt') { const k = 'hurt' + u.id; if (B.said[k]) return; B.said[k] = 1; }
  const [who, text] = pick(pool);
  radio(who, text);
}

// ---------- title ----------
function showTitle() {
  SCENE = 'title';
  CAMP = CAMP || freshCamp();
  newBattle(1);
  B.phase = 'player';
  show('title');
  const save = store.get('sunflower-v1');
  $('btnContinue').hidden = !(save && save.mission < MISSIONS.length);
}
function freshCamp() { return { grid: 7, gridMax: 7, aid: 0, mission: 0, flags: {}, up: { jav: 0, sting: 0, t64hp: 0, spot: 0, tb2: 0, grid: 0 }, log: [] }; }

// ---------- story cards ----------
async function playStory(lines, after) {
  SCENE = 'campaign';
  show('story');
  const box = $('storyText');
  let skip = false;
  const onClick = () => { skip = true; };
  $('story').onclick = onClick;
  for (const line of lines) {
    skip = false;
    box.classList.remove('in'); void box.offsetWidth;
    box.textContent = line; box.classList.add('in');
    const until = performance.now() + (1800 + line.length * 60) * SPEED;
    while (!skip && performance.now() < until) await sleep(50);
  }
  $('story').onclick = null;
  after();
}

// ---------- campaign map ----------
const GEO = {
  border: [[0, 0.06], [0.2, 0.08], [0.33, 0.05], [0.55, 0.06], [0.75, 0.03], [1, 0.08]],
  reservoir: [[0.47, 0.1], [0.53, 0.1], [0.565, 0.24], [0.555, 0.4], [0.525, 0.53], [0.495, 0.535], [0.472, 0.42], [0.452, 0.27]],
  dniproN: [[0.56, 0], [0.53, 0.05], [0.5, 0.1]],
  dnipro: [[0.51, 0.53], [0.53, 0.62], [0.545, 0.72], [0.56, 0.82], [0.6, 1]],
  desna: [[0.98, 0.16], [0.82, 0.3], [0.69, 0.42], [0.6, 0.52], [0.535, 0.6]],
  irpin: [[0.16, 0.96], [0.27, 0.83], [0.35, 0.73], [0.405, 0.64], [0.425, 0.55], [0.465, 0.45]],
  cities: [['基辅', 0.545, 0.72, 3], ['霍斯托梅尔', 0.38, 0.5, 1], ['布恰', 0.35, 0.58, 1], ['伊尔平', 0.395, 0.635, 1], ['布罗瓦里', 0.66, 0.71, 2], ['斯凯宾', 0.71, 0.635, 1], ['切尔尼戈夫', 0.8, 0.14, 2], ['伊万基夫', 0.27, 0.3, 1], ['维什戈罗德', 0.52, 0.57, 1]],
  arrows: [[[0.33, 0.02], [0.3, 0.2], [0.33, 0.36], [0.37, 0.45]], [[0.8, 0.16], [0.78, 0.36], [0.73, 0.55], [0.71, 0.61]], [[0.62, 0.05], [0.63, 0.3], [0.66, 0.5]]],
  air: [[0.5, 0.16], [0.44, 0.3], [0.385, 0.47]],
};
let mapRect = { x: 0, y: 0, w: 1, h: 1 };
function mp(u, v) { return [mapRect.x + u * mapRect.w, mapRect.y + v * mapRect.h]; }
function renderCampaign(now) {
  const t = now / 1000;
  g.drawImage(bgC, 0, 0);
  const mw = Math.min(W * 0.62, H * 1.05), mh = Math.min(H * 0.86, mw * 0.82);
  mapRect = { x: Math.round(W * 0.03 + (W * 0.62 - mw) / 2), y: Math.round((H - mh) / 2 + 10), w: Math.round(mw), h: Math.round(mh) };
  const { x: X, y: Y, w: MW, h: MH } = mapRect;
  R(X - 4, Y - 4, MW + 8, MH + 8, '#0a0f14'); R(X - 2, Y - 2, MW + 4, MH + 4, '#3b566b');
  R(X, Y, MW, MH, '#1c2a22');
  for (let j = 0; j < MH; j += 3) for (let i = 0; i < MW; i += 3) {
    const n = hash(i >> 4, j >> 4, 5) * 0.6 + hash(i >> 3, j >> 3, 6) * 0.4;
    if (n > 0.62) R(X + i, Y + j, 2, 2, '#15221a'); else if (hash(i, j, 7) < 0.04) R(X + i, Y + j, 1, 1, '#2c3b2e');
  }
  g.fillStyle = 'rgba(150,180,200,.08)';
  for (let i = 1; i < 8; i++) { g.fillRect(X + Math.round(MW * i / 8), Y, 1, MH); g.fillRect(X, Y + Math.round(MH * i / 8), MW, 1); }
  const poly = (pts, c) => { g.fillStyle = c; g.beginPath(); pts.forEach(([u, v], i) => { const [px, py] = mp(u, v); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill(); };
  const path = (pts, c, w, dash) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = mp(...pts[i - 1]), [x1, y1] = mp(...pts[i]);
      if (!dash) line(x0, y0, x1, y1, c, w);
      else { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6); for (let k = 0; k < n; k += 2) line(lerp(x0, x1, k / n), lerp(y0, y1, k / n), lerp(x0, x1, (k + 1) / n), lerp(y0, y1, (k + 1) / n), c, w); }
    }
  };
  poly(GEO.reservoir, '#2f5f80');
  path(GEO.dniproN, '#2f5f80', 4); path(GEO.dnipro, '#2f5f80', 5); path(GEO.desna, '#2f5f80', 3); path(GEO.irpin, '#2f5f80', 2);
  path(GEO.border, '#9aa3a8', 2, true);
  g.font = '11px "Noto Sans SC", sans-serif'; g.fillStyle = '#9aa3a8';
  { const [bx, by] = mp(0.06, 0.035); g.fillText('白俄罗斯', bx, by); const [bx2, by2] = mp(0.06, 0.1); g.fillStyle = '#7f8f84'; g.fillText('乌克兰', bx2, by2); }
  { const [rx, ry] = mp(0.47, 0.3); g.fillStyle = '#7fb0cc'; g.fillText('基辅水库', rx - 30, ry); }
  // enemy axes of advance
  const phase = (t * 0.6) % 1;
  for (const a of GEO.arrows) {
    path(a, 'rgba(255,74,43,.55)', 5);
    const [x0, y0] = mp(...a[a.length - 2]), [x1, y1] = mp(...a[a.length - 1]);
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (let s = -1; s <= 1; s += 2) line(x1, y1, x1 - Math.cos(ang + s * 0.6) * 12, y1 - Math.sin(ang + s * 0.6) * 12, 'rgba(255,74,43,.8)', 4);
    for (let i = 1; i < a.length; i++) { const [p0, q0] = mp(...a[i - 1]), [p1, q1] = mp(...a[i]); R(lerp(p0, p1, phase) - 2, lerp(q0, q1, phase) - 2, 4, 4, '#ffb199'); }
  }
  path(GEO.air, 'rgba(255,120,90,.8)', 2, true);
  const nodeAt = (u, v) => MISSIONS.some(m => Math.abs(m.mapPos[0] - u) < 0.01 && Math.abs(m.mapPos[1] - v) < 0.01);
  for (const [name, u, v, s] of GEO.cities) {
    const [px, py] = mp(u, v), n = nodeAt(u, v);
    if (n) { g.font = '12px "Noto Sans SC", sans-serif'; g.fillStyle = '#0a0f14'; g.fillText(name, px + 15, py + 5); g.fillStyle = '#e6edf2'; g.fillText(name, px + 14, py + 4); continue; }
    R(px - s - 2, py - s - 2, s * 2 + 4, s * 2 + 4, '#0a0f14'); R(px - s - 1, py - s - 1, s * 2 + 2, s * 2 + 2, s === 3 ? '#f2c230' : '#d8d2b8');
    g.font = (s === 3 ? 'bold 14px' : '11px') + ' "Noto Sans SC", sans-serif';
    g.fillStyle = '#0a0f14'; g.fillText(name, px + s + 5, py + 5); g.fillStyle = s === 3 ? '#f2c230' : '#c9d2d8'; g.fillText(name, px + s + 4, py + 4);
  }
  // mission nodes
  MISSIONS.forEach((m, i) => {
    const [px, py] = mp(...m.mapPos);
    const done = i < CAMP.mission, cur = i === CAMP.mission;
    const r = cur ? 9 + Math.round(Math.sin(t * 4) * 2) : 8;
    disc(px, py, r + 3, '#0a0f14');
    disc(px, py, r + 1, done ? '#7bd650' : cur ? '#f2c230' : '#5f7485');
    disc(px, py, r - 2, done ? '#2a4a22' : cur ? '#3a2c06' : '#1c2a33');
    txt(i + 1, px - 1, py - 5, done ? '#b8f59a' : cur ? '#fff1b0' : '#8ea3b4', 2);
    if (cur) { outlineDia(px, py + 1, 44 + Math.round(Math.sin(t * 4) * 4), 'rgba(242,194,48,.5)'); }
  });
  g.font = '10px "Noto Sans SC", sans-serif'; g.fillStyle = '#6f8494';
  g.fillText('50°30′N', X + 6, Y + MH * 0.35); g.fillText('30°30′E', X + MW * 0.5 + 4, Y + MH - 6);
}
function showCampaign() {
  SCENE = 'campaign';
  show('campaign');
  const i = CAMP.mission, M = MISSIONS[i];
  $('cGrid').innerHTML = gridCells();
  $('cAid').textContent = CAMP.aid;
  $('cList').innerHTML = MISSIONS.map((m, k) => `
    <div class="mrow ${k < i ? 'done' : k === i ? 'cur' : 'locked'}">
      <span class="mcode">${m.code}</span>
      <span class="mname">${esc(m.name)}<small>${esc(m.date)}</small></span>
      <span class="mstate">${k < i ? '已完成' : k === i ? '当前' : '未解锁'}</span>
    </div>`).join('');
  $('cMission').innerHTML = M ? `
    <div class="mtitle"><span class="mcode big">${M.code}</span><div><h3>${esc(M.name)}</h3><small>${esc(M.date)} · ${esc(M.place)}</small></div></div>
    <ul class="objs">${M.objectives.map(o => `<li class="${o.kind}"><i></i>${esc(o.text)}${o.reward ? `<em>援助 +${o.reward}</em>` : ''}</li>`).join('')}</ul>
    ${Object.keys(CAMP.flags).length ? `<p class="warn">${CAMP.flags.runwayOpen ? '霍斯托梅尔跑道未被破坏：会出现更多空降兵。' : ''}</p>` : ''}` : '';
  $('btnBrief').hidden = !M;
}
function gridCells() { let s = ''; for (let i = 0; i < CAMP.gridMax; i++) s += `<i class="${i < CAMP.grid ? 'on' : ''}"></i>`; return `<span class="cells ${CAMP.grid <= 3 ? 'warn' : ''}">${s}</span><b class="num">${CAMP.grid}</b>`; }

// ---------- briefing dialogue ----------
let dlg = null;
function showBriefing() {
  const M = MISSIONS[CAMP.mission];
  newBattle(CAMP.mission);
  SCENE = 'briefing';
  show('briefing');
  $('bCard').hidden = true; $('bDialog').hidden = false;
  $('bHead').innerHTML = `<span class="mcode big">${M.code}</span><div><h3>${esc(M.name)}</h3><small>${esc(M.date)} · ${esc(M.place)}</small></div>`;
  dlg = { lines: M.brief, i: -1, typing: false, full: '' };
  nextLine();
}
async function nextLine() {
  if (!dlg) return;
  if (dlg.typing) { dlg.skip = true; return; }
  dlg.i++;
  if (dlg.i >= dlg.lines.length) { showMissionCard(); return; }
  const [who, text] = dlg.lines[dlg.i], ch = CHARS[who];
  $('dPortrait').src = pimg(who);
  $('dName').innerHTML = `${esc(ch.call)}<small>${esc(ch.name)} · ${esc(ch.role)}</small>`;
  const el = $('dText'), d = dlg;
  d.typing = true; d.skip = false;
  for (let k = 1; k <= text.length; k++) {
    if (dlg !== d) return;
    if (d.skip) { el.textContent = text; break; }
    el.textContent = text.slice(0, k);
    if (k % 2) AUDIO.type();
    await sleep(22);
  }
  d.typing = false;
}
function showMissionCard() {
  const M = MISSIONS[CAMP.mission];
  dlg = null;
  $('bDialog').hidden = true; $('bCard').hidden = false;
  $('bObjs').innerHTML = M.objectives.map(o => `<li class="${o.kind}"><i></i>${esc(o.text)}${o.reward ? `<em>援助 +${o.reward}</em>` : ''}</li>`).join('');
  $('bTips').innerHTML = M.tips.map(t => `<li>${esc(t)}</li>`).join('');
  const enemy = {};
  for (const [type] of M.enemies) enemy[type] = (enemy[type] || 0) + 1;
  for (const w of B.waves) for (const [type] of w.units) enemy[type] = (enemy[type] || 0) + 1;
  $('bEnemy').innerHTML = Object.entries(enemy).map(([t, n]) => `<li>${esc(UNITS[t].name)} <b>×${n}</b></li>`).join('');
}
function beginDeploy() {
  SCENE = 'battle';
  show('hud');
  B.phase = 'deploy'; sel = null; mode = null; wsel = null;
  $('deploy').hidden = false;
  renderHud();
  banner('部署部队', 'player');
}

// ---------- battle HUD ----------
function renderHud() {
  if (!B || SCENE !== 'battle') return;
  $('hGrid').innerHTML = gridCells();
  $('hTurn').innerHTML = `<b class="num">${Math.min(B.turn, B.maxTurn)}</b><span>/ ${B.maxTurn}</span>`;
  $('hMission').textContent = `${B.mission.code} ${B.mission.name}`;
  $('hObjs').innerHTML = B.mission.objectives.map(o => {
    const r = o.eval(B), done = r.inverse ? r.cur <= r.max : r.cur >= r.max;
    const failed = r.inverse && r.cur > r.max;
    return `<li class="${o.kind} ${done && !r.inverse ? 'ok' : ''} ${failed ? 'bad' : ''}"><i></i><span>${esc(o.text)}</span><b class="num">${r.cur}/${r.max}</b>${o.reward ? `<em>援助 +${o.reward}</em>` : ''}</li>`;
  }).join('');
  const player = B.phase === 'player' && !busy;
  $('btnEnd').disabled = !player;
  $('btnReset').disabled = !player || B.resetLeft <= 0;
  $('btnReset').innerHTML = `作战预案<small>×${B.resetLeft}</small>`;
  const tb = $('btnTB2');
  tb.disabled = !player || B.tb2Left <= 0;
  tb.classList.toggle('on', mode === 'support');
  tb.innerHTML = `<span class="ico">✈</span><span>TB2 打击<small>剩余 ${B.tb2Left}</small></span>`;
  $('deploy').hidden = B.phase !== 'deploy';
  $('hBottom').hidden = B.phase === 'deploy';
  // roster
  $('roster').innerHTML = ['t64', 'atgm', 'd30'].map(type => {
    const u = B.units.find(v => v.type === type && v.team === 'ua' && !v.dead);
    const d = UNITS[type];
    if (!u) return `<button class="rchip dead" type="button" disabled><img class="pf" alt="" src="${pimg(d.pilot)}"><span>${esc(d.short)}</span><em>损毁</em></button>`;
    const st = B.phase === 'deploy' ? '部署' : u.acted ? '已行动' : u.moved ? '已移动' : '待命';
    return `<button class="rchip ${sel === u.id ? 'sel' : ''} ${u.acted && B.phase === 'player' ? 'done' : ''}" type="button" data-uid="${u.id}"><img class="pf" alt="" src="${pimg(d.pilot)}"><span>${esc(d.short)}</span>${pipsHtml(u.hp, u.max)}<em>${st}</em></button>`;
  }).join('');
  // selected unit card
  const su = sel != null ? B.units.find(u => u.id === sel && !u.dead) : null;
  const card = $('unitCard');
  if (su && su.team === 'ua') {
    const d = U(su), ch = CHARS[d.pilot];
    card.hidden = false;
    card.innerHTML = `
      <div class="uc-head"><img class="pf big" alt="" src="${pimg(d.pilot)}"><div><h4>${esc(d.name)}</h4><small>${esc(ch.call)} · ${esc(ch.name)}</small><div class="uc-stats">${pipsHtml(su.hp, su.max)}<span>移动 ${d.move}</span><span>${CLASS_NAME[d.cls]}</span></div></div></div>
      <div class="weps">${d.weapons.map((wid, i) => {
        const w = WEAPONS[wid], ammo = w.ammo ? su.ammo[w.ammo] : null, empty = ammo === 0;
        return `<button type="button" class="wep ${mode === 'target' && wsel === wid ? 'on' : ''}" data-wid="${wid}" ${su.acted || empty || B.phase !== 'player' ? 'disabled' : ''}>
          <span class="key">${i + 1}</span><span class="wn">${esc(w.name)}${ammo != null ? `<b class="ammo">${ammo}</b>` : ''}</span><span class="wd">${esc(w.desc)}</span></button>`;
      }).join('')}</div>
      ${su.prev && !su.acted && B.phase === 'player' ? '<button type="button" class="btn small" id="btnUndo">撤销移动</button>' : ''}`;
  } else card.hidden = true;
  renderTip();
}
function pipsHtml(hp, max, enemy) { let s = ''; for (let i = 0; i < max; i++) s += `<i class="${i < hp ? 'on' : ''}"></i>`; return `<span class="pips ${enemy ? 'ru' : ''}">${s}</span>`; }
function renderTip() {
  const tip = $('tip');
  if (!hover || !B || SCENE !== 'battle') { tip.hidden = true; return; }
  const { x, y } = hover, t = TILEAT(x, y), o = unitAt(x, y);
  let html = '';
  if (o && o.team !== 'ua') {
    const d = U(o);
    html += `<h5>${esc(d.name)} ${pipsHtml(o.hp, o.max, o.team === 'ru')}</h5><p>${CLASS_NAME[d.cls]} · 移动 ${d.move}${d.amph ? ' · 两栖' : ''}</p>`;
    if (o.team === 'civ') html += `<p>沿公路撤离，每回合 3 格。能穿过我方单位，会被敌人挡住。</p>`;
    else if (d.atk === 'land') html += `<p class="threat">下回合：在此降落，放下空降兵</p>`;
    else if (d.spotter) html += `<p class="threat">为俄军炮兵校射：敌方炮火 +1，并瞄准你的单位</p>`;
    else if (d.atk) { const w = WEAPONS[d.atk]; html += `<p>${esc(w.name)}</p>`; if (o.aim) { const tl = enemyAttackTiles(o); html += tl.length ? `<p class="threat">下回合攻击 ${tl.map(a => coord(a.x, a.y)).join('、')}</p>` : '<p>下回合没有可攻击的目标</p>'; } }
    const on = actionOrder(o);
    if (on) html += `<p>行动顺序：第 ${on} 个${B.barrage.length ? '（场外炮火最先落下）' : ''}</p>`;
  }
  const bl = BLD[t.t];
  if (bl) html += bldAlive(t) ? `<h5>${esc(bl.name)} ${pipsHtml(t.hp, t.max)}</h5><p>${bl.pop ? `约 ${bl.pop} 名居民。` : ''}${bl.grid ? '被击中一次，电网 -1。' : '军事设施。'}</p>` : `<h5>废墟</h5>`;
  else html += `<h5>${esc(TILE[t.t].name)}${t.crater ? ' · 弹坑' : ''}</h5><p>${esc(TILE[t.t].note)}</p>`;
  if (t.wreck) html += `<p>残骸：阻挡移动和直射火力。</p>`;
  for (const a of threats().filter(a => a.x === x && a.y === y)) {
    if (a.barrage) html += `<p class="threat">俄军 152 毫米炮火将落在这里</p>`;
    else if (!a.land) html += `<p class="threat">${esc(U(a.e).name)}：${dmgAgainst(a.w, x, y)} 点伤害</p>`;
  }
  const mk = B.marks.find(m => m.x === x && m.y === y);
  if (mk) html += `<p class="threat">敌军增援：${esc(UNITS[mk.type].name)}${UNITS[mk.type].cls === 'air' ? '' : '（站上去可以堵住）'}</p>`;
  tip.innerHTML = `<span class="coord">${coord(x, y)}</span>` + html;
  tip.hidden = false;
}

// ---------- input ----------
function pickTile(ev) {
  const [mx, my] = cssToArt(ev.clientX, ev.clientY);
  if (SCENE === 'battle' && B) {
    const order = B.units.filter(u => !u.dead).sort((a, b) => (b.ry + b.rx + (isAir(b) ? 1 : 0)) - (a.ry + a.rx + (isAir(a) ? 1 : 0)));
    for (const u of order) {
      if (!isAir(u)) continue;
      const s = unitSprite(u), [sx, sy] = unitScreen(u);
      if (mx >= sx + s.ox && mx <= sx + s.ox + s.w && my >= sy + s.oy && my <= sy + s.oy + s.h) return { x: u.x, y: u.y };
    }
  }
  const X = (mx - OX) / TW, Y = (my - OY) / TH;
  const tx = Math.floor((Y + X) / 2), ty = Math.floor((Y - X) / 2);
  return inB(tx, ty) ? { x: tx, y: ty } : null;
}
function selectUnit(u) {
  sel = u.id; AUDIO.select();
  if (B.phase === 'deploy') { mode = 'deploy'; return; }
  if (u.acted) { mode = null; wsel = null; return; }
  wsel = U(u).weapons.find(w => weaponTargets(u, w).length || !WEAPONS[w].ammo) || U(u).weapons[0];
  mode = u.moved ? 'target' : 'move';
}
function armWeapon(wid) {
  const u = B.units.find(v => v.id === sel);
  if (!u || u.acted || B.phase !== 'player' || busy) return;
  const w = WEAPONS[wid];
  if (w.ammo && !(u.ammo[w.ammo] > 0)) return;
  if (mode === 'target' && wsel === wid) { mode = u.moved ? null : 'move'; }
  else { wsel = wid; mode = 'target'; }
  AUDIO.click();
  renderHud();
}
async function onBoardClick(ev) {
  AUDIO.init();
  if (SCENE !== 'battle' || busy) return;
  const h = pickTile(ev);
  hover = h;
  if (!h) { sel = null; mode = null; renderHud(); return; }
  const o = unitAt(h.x, h.y), su = sel != null ? B.units.find(u => u.id === sel && !u.dead) : null;
  if (B.phase === 'deploy') {
    if (o && o.team === 'ua') { selectUnit(o); renderHud(); return; }
    if (su && !o && B.mission.deploy.some(([x, y]) => x === h.x && y === h.y) && moveCost(su, h.x, h.y) < Infinity) {
      su.x = su.rx = h.x; su.y = su.ry = h.y; AUDIO.click(); dust(h.x, h.y, 4);
    }
    renderHud(); return;
  }
  if (B.phase !== 'player') return;
  if (mode === 'support') { await supportStrike(h); renderHud(); return; }
  if (su && mode === 'target' && wsel) {
    const t = weaponTargets(su, wsel).find(p => p.x === h.x && p.y === h.y);
    if (t) { await playerFire(su, wsel, t); renderHud(); return; }
  }
  if (o && o.team === 'ua') { selectUnit(o); renderHud(); return; }
  if (su && mode === 'move' && !o) {
    const map = reach(su);
    if (map.has(h.x + ',' + h.y)) {
      await playerMove(su, h.x, h.y);
      selectUnit(su);
      mode = 'target';
      renderHud(); return;
    }
  }
  sel = null; mode = null; wsel = null;
  renderHud();
}
function cancel() {
  if (mode === 'support') mode = null;
  else if (mode === 'target') { const u = B.units.find(v => v.id === sel); mode = u && !u.moved ? 'move' : null; }
  else { sel = null; mode = null; }
  renderHud();
}
stage.addEventListener('mousemove', ev => {
  if (SCENE !== 'battle') return;
  const h = pickTile(ev);
  if ((h && hover && h.x === hover.x && h.y === hover.y) || (!h && !hover)) return;
  hover = h; renderTip();
});
stage.addEventListener('mouseleave', () => { hover = null; renderTip(); });
stage.addEventListener('click', onBoardClick);
stage.addEventListener('contextmenu', ev => { ev.preventDefault(); if (SCENE === 'battle') cancel(); });
document.addEventListener('keydown', ev => {
  if (SCENE === 'briefing' && (ev.key === ' ' || ev.key === 'Enter') && dlg) { ev.preventDefault(); nextLine(); return; }
  if (SCENE !== 'battle' || !B) return;
  if (ev.key === 'Escape') cancel();
  const u = B.units.find(v => v.id === sel);
  if ((ev.key === '1' || ev.key === '2') && u && u.team === 'ua') { const wid = U(u).weapons[+ev.key - 1]; if (wid) armWeapon(wid); }
});

// ---------- debrief & upgrades ----------
let lastResult = null;
function showDebrief(res) {
  lastResult = res;
  const M = B.mission;
  CAMP.aid += res.aid;
  const wiped = res.reason === 'wiped', gridOut = res.reason === 'grid' || CAMP.grid <= 0;
  if (gridOut) { store.del('sunflower-v1'); setTimeout(() => { SCENE = 'campaign'; show('gameover'); }, 1200 * SPEED); return; }
  setTimeout(() => {
    SCENE = 'campaign';
    show('debrief');
    const title = wiped ? '小队覆灭' : res.win ? '任务完成' : '任务部分完成';
    $('dbTitle').innerHTML = `<span class="mcode big">${M.code}</span><div><small>${esc(M.name)}</small><h2 class="${wiped ? 'bad' : res.win ? 'good' : 'mid'}">${title}</h2></div>`;
    $('dbText').textContent = wiped ? '特遣队失去了全部作战单位。可以重新部署，再推演一次这场战斗。' : res.win ? M.outcome.win : M.outcome.partial;
    $('dbObjs').innerHTML = res.objectives.map(o => `<li class="${o.done ? 'ok' : 'bad'}"><i></i><span>${esc(o.text)}</span>${o.reward ? `<em>${o.done ? '援助 +' + o.reward : '—'}</em>` : ''}</li>`).join('');
    const s = res.stats;
    $('dbStats').innerHTML = `
      <div><b class="num">${res.civilians}</b><span>守护的平民</span></div>
      <div><b class="num">${s.kills}</b><span>击毁敌军</span></div>
      <div><b class="num">${s.gridLost}</b><span>电网损失</span></div>
      <div><b class="num">${CAMP.grid}/${CAMP.gridMax}</b><span>电网剩余</span></div>`;
    const notes = [];
    if (res.consequence) notes.push(res.consequence.text);
    if (res.repair) notes.push('后方抢修队连夜作业：电网 +1。');
    $('dbConseq').hidden = !notes.length;
    $('dbConseq').textContent = notes.join(' ');
    $('dbConseq').classList.toggle('calm', !res.consequence);
    $('btnRetry').hidden = !wiped;
    $('btnNext').textContent = wiped ? '放弃并继续' : CAMP.mission + 1 >= MISSIONS.length ? '完成战区' : '返回战役地图';
    renderShop();
  }, 900 * SPEED);
}
function renderShop() {
  $('shopAid').textContent = CAMP.aid;
  $('shop').innerHTML = UPGRADES.map(up => {
    const lvl = CAMP.up[up.id] || 0, maxed = up.id === 'grid' ? CAMP.grid >= CAMP.gridMax : lvl >= up.max;
    return `<button type="button" class="up" data-up="${up.id}" ${maxed || CAMP.aid < up.cost ? 'disabled' : ''}>
      <span class="uname">${esc(up.name)}${up.id !== 'grid' && up.max > 1 ? ` <small>${lvl}/${up.max}</small>` : ''}</span>
      <span class="udesc">${esc(up.desc)}</span><span class="ucost">${maxed ? (up.id === 'grid' ? '电网已满' : '已装备') : `援助 ${up.cost}`}</span></button>`;
  }).join('');
}
function buy(id) {
  const up = UPGRADES.find(u => u.id === id);
  if (!up || CAMP.aid < up.cost) return;
  if (id === 'grid') { if (CAMP.grid >= CAMP.gridMax) return; CAMP.grid++; }
  else { if ((CAMP.up[id] || 0) >= up.max) return; CAMP.up[id] = (CAMP.up[id] || 0) + 1; }
  CAMP.aid -= up.cost; AUDIO.select();
  renderShop();
}
function continueCampaign() {
  if (lastResult && lastResult.reason !== 'wiped') CAMP.mission++;
  else if (lastResult && lastResult.reason === 'wiped') CAMP.mission++;
  store.set('sunflower-v1', CAMP);
  if (CAMP.mission >= MISSIONS.length) { store.del('sunflower-v1'); playStory(EPILOGUE, () => { showTitle(); }); return; }
  showCampaign();
}

// ---------- wiring ----------
$('btnNew').onclick = () => { AUDIO.init(); AUDIO.click(); CAMP = freshCamp(); store.set('sunflower-v1', CAMP); playStory(PROLOGUE, showCampaign); };
$('btnContinue').onclick = () => { AUDIO.init(); AUDIO.click(); CAMP = Object.assign(freshCamp(), store.get('sunflower-v1')); showCampaign(); };
$('btnBrief').onclick = () => { AUDIO.click(); showBriefing(); };
$('briefing').addEventListener('click', ev => { if (dlg && !ev.target.closest('button')) nextLine(); });
$('btnSkip').onclick = ev => { ev.stopPropagation(); showMissionCard(); };
$('btnDeploy').onclick = () => { AUDIO.click(); beginDeploy(); };
$('btnStart').onclick = () => { AUDIO.click(); sel = null; mode = null; $('deploy').hidden = true; startBattle(); };
$('btnEnd').onclick = () => { AUDIO.click(); enemyPhase(); };
$('btnReset').onclick = () => { if (B.phase !== 'player' || busy || B.resetLeft <= 0) return; restoreSnapshot(B.snap); sel = null; mode = null; toast('启用作战预案：本回合重新部署', ''); renderHud(); };
$('btnTB2').onclick = () => { if (B.phase !== 'player' || busy || B.tb2Left <= 0) return; mode = mode === 'support' ? null : 'support'; sel = null; AUDIO.click(); renderHud(); };
$('roster').addEventListener('click', ev => { const b = ev.target.closest('[data-uid]'); if (!b || busy) return; const u = B.units.find(v => v.id === +b.dataset.uid); if (u) { selectUnit(u); renderHud(); } });
$('unitCard').addEventListener('click', ev => {
  const w = ev.target.closest('[data-wid]'); if (w) { armWeapon(w.dataset.wid); return; }
  if (ev.target.closest('#btnUndo')) { const u = B.units.find(v => v.id === sel); if (u && u.prev && !u.acted) { u.x = u.rx = u.prev.x; u.y = u.ry = u.prev.y; u.face = u.prev.face; u.prev = null; u.moved = false; mode = 'move'; renderHud(); } }
});
$('shop').addEventListener('click', ev => { const b = ev.target.closest('[data-up]'); if (b) buy(b.dataset.up); });
$('btnNext').onclick = () => { AUDIO.click(); continueCampaign(); };
$('btnRetry').onclick = () => { AUDIO.click(); showBriefing(); showMissionCard(); };
$('btnRestart').onclick = () => { AUDIO.click(); CAMP = freshCamp(); showTitle(); };
$('btnSound').onclick = () => { AUDIO.init(); AUDIO.setMuted(!AUDIO.muted); $('btnSound').textContent = AUDIO.muted ? '声音：关' : '声音：开'; };
$('btnMusic').onclick = () => { AUDIO.init(); AUDIO.toggleMusic(!AUDIO.musicOn); $('btnMusic').textContent = AUDIO.musicOn ? '音乐：开' : '音乐：关'; };
$('btnSpeed').onclick = () => { SPEED = SPEED === 1 ? 0.55 : 1; $('btnSpeed').textContent = SPEED === 1 ? '动画：标准' : '动画：快速'; };
