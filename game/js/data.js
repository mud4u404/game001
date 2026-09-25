'use strict';
// ---------- units ----------
// cls: ha heavy armour · la light armour · soft trucks & towed guns · inf infantry · air aircraft
// mob: track / wheel pay 2 movement per muddy field (Feb–Mar thaw), 1 on roads; foot pays 1 everywhere.
const UNITS = {
  t64:   { name: 'T-64BV 主战坦克', short: 'T-64BV', team: 'ua', cls: 'ha', hp: 4, move: 4, mob: 'track', weapons: ['gun125', 'nsvt'], pilot: 'mykola', desc: '第1独立坦克旅的老式主战坦克，挂着“接触-1”反应装甲。' },
  atgm:  { name: '反坦克组', short: '标枪/毒刺', team: 'ua', cls: 'inf', hp: 2, move: 3, mob: 'foot', weapons: ['javelin', 'stinger'], pilot: 'taras', desc: '国土防卫部队的反坦克小组。可以进入森林，受到的伤害 -1。' },
  d30:   { name: 'D-30 榴弹炮', short: 'D-30', team: 'ua', cls: 'soft', hp: 2, move: 3, mob: 'wheel', weapons: ['how122'], pilot: 'ivanna', desc: '122毫米牵引榴弹炮班。需要有友军在目标附近观察才能开火。' },
  t72:   { name: 'T-72B3 坦克', team: 'ru', cls: 'ha', hp: 4, move: 4, mob: 'track', atk: 't72gun', armor: true },
  btr:   { name: 'BTR-82A 装甲车', team: 'ru', cls: 'la', hp: 2, move: 4, mob: 'wheel', amph: true, atk: 'gun30', armor: true },
  cmd:   { name: '团指挥车', team: 'ru', cls: 'la', hp: 2, move: 4, mob: 'wheel', amph: true, atk: null, armor: true },
  vdv:   { name: '空降兵班', team: 'ru', cls: 'inf', hp: 1, move: 3, mob: 'foot', atk: 'rpg' },
  grad:  { name: 'BM-21 “冰雹”', team: 'ru', cls: 'soft', hp: 2, move: 3, mob: 'wheel', atk: 'grad' },
  ka52:  { name: '卡-52 武装直升机', team: 'ru', cls: 'air', hp: 3, move: 5, mob: 'air', atk: 'vikhr', alt: 36 },
  mi8:   { name: '米-8 运输直升机', team: 'ru', cls: 'air', hp: 2, move: 5, mob: 'air', atk: 'land', alt: 30 },
  orlan: { name: '奥兰-10 侦察无人机', team: 'ru', cls: 'air', hp: 1, move: 5, mob: 'air', atk: null, alt: 44, spotter: true },
  magura:  { name: '海上无人艇', short: '无人艇', team: 'ua', cls: 'la', hp: 1, move: 5, mob: 'sea', weapons: ['seaRam'], pilot: 'olena', desc: '装满炸药的无人快艇。撞击目标后引爆，自身随之损失。' },
  neptune: { name: '“海王星”发射车', short: '海王星', team: 'ua', cls: 'soft', hp: 2, move: 3, mob: 'wheel', weapons: ['neptune'], pilot: 'dmytro', desc: '岸基反舰导弹发射车，只能攻击水面舰艇。' },
  tdf:     { name: '国土防卫步兵班', short: '步兵班', team: 'ua', cls: 'inf', hp: 3, move: 3, mob: 'foot', weapons: ['pkm', 'rpg'], pilot: 'roman', desc: '基辅本地人组成的国土防卫部队步兵班。熟悉每一条街道，可以进入森林。' },
  bmp2:    { name: 'BMP-2 步兵战车', short: 'BMP-2', team: 'ua', cls: 'la', hp: 3, move: 4, mob: 'track', weapons: ['a42', 'konkurs'], pilot: 'serhiy', desc: '第72机械化旅的步兵战车。机关炮能对空，还带 1 发反坦克导弹。' },
  raptor:  { name: '03160 型“猛禽”巡逻艇', team: 'ru', cls: 'la', hp: 2, move: 5, mob: 'sea', atk: 'kord', armor: true },
  civ:   { name: '撤离的平民', team: 'civ', cls: 'inf', hp: 1, move: 3, mob: 'foot', stable: true },
};
const CLASS_NAME = { ha: '重装甲', la: '轻装甲', soft: '无装甲', inf: '步兵', air: '空中', bld: '建筑' };

// ---------- weapons ----------
// kind: line = direct fire, first obstacle in a straight line · lock = top attack on a vehicle in range
// aa = air target in range · arc = indirect fire on any tile in range · melee = adjacent · grad = two-tile rocket strip
const WEAPONS = {
  gun125:  { name: '125毫米主炮', kind: 'line', range: 8, dmg: { ha: 2, la: 3, soft: 3, inf: 2, bld: 1 }, push: true, fx: 'shell', desc: '直射。命中直线上第一个地面目标，并把它击退 1 格。' },
  nsvt:    { name: 'NSVT 高射机枪', kind: 'line', range: 3, hitsAir: true, dmg: { inf: 1, soft: 1, la: 1, air: 1, ha: 0, bld: 0 }, fx: 'mg', desc: '射程 3。能打到直升机和无人机，对重装甲无效。' },
  javelin: { name: 'FGM-148 标枪', kind: 'lock', min: 2, range: 5, ammo: 'jav', dmg: { ha: 3, la: 3, soft: 2, inf: 1 }, fx: 'javelin', desc: '攻顶攻击：越过障碍，锁定 2–5 格内的车辆。' },
  stinger: { name: 'FIM-92 毒刺', kind: 'aa', min: 1, range: 5, ammo: 'sting', dmg: { air: 3 }, fx: 'stinger', desc: '锁定 5 格内的空中目标。' },
  how122:  { name: '122毫米榴弹', kind: 'arc', min: 2, range: 6, spot: 3, dmg: { ha: 1, la: 2, soft: 2, inf: 2, bld: 1 }, blast: true, crater: true, fx: 'artillery', desc: '曲射 2–6 格。落点必须在其他友军的观察范围内。落点四周的单位被震退 1 格。' },
  tb2:     { name: 'TB2 无人机打击', kind: 'any', dmg: { ha: 2, la: 2, soft: 2, inf: 2, bld: 1 }, crater: true, fx: 'tb2', desc: 'MAM-L 制导炸弹，对任意地面目标造成 2 点伤害。' },
  seaRam:  { name: '撞击引爆', kind: 'melee', dmg: { la: 4, ha: 4, soft: 4, inf: 2, bld: 1 }, selfDestruct: true, fx: 'rpg', desc: '撞击相邻目标并引爆，4 点伤害。无人艇随之损失。' },
  neptune: { name: 'R-360 反舰导弹', kind: 'naval', min: 2, range: 8, ammo: 'nep', dmg: { la: 4, ha: 4, soft: 3 }, fx: 'atgm', desc: '锁定 2–8 格内的水面舰艇，4 点伤害。每场任务 2 发。' },
  t72gun:  { name: '125毫米主炮', kind: 'line', range: 8, dmg: { ha: 2, la: 3, soft: 3, inf: 2, bld: 1 }, fx: 'shell' },
  gun30:   { name: '30毫米机关炮', kind: 'line', range: 3, dmg: { ha: 1, la: 1, soft: 2, inf: 2, bld: 1 }, fx: 'mg' },
  rpg:     { name: 'RPG-7 火箭筒', kind: 'melee', dmg: { ha: 2, la: 2, soft: 2, inf: 1, bld: 1 }, fx: 'rpg' },
  grad:    { name: '122毫米火箭齐射', kind: 'grad', min: 3, range: 5, dmg: { ha: 1, la: 1, soft: 1, inf: 1, bld: 1 }, fx: 'grad' },
  vikhr:   { name: '“旋风”反坦克导弹', kind: 'line', range: 4, overForest: true, dmg: { ha: 3, la: 3, soft: 3, inf: 1, bld: 1 }, fx: 'atgm' },
  kord:    { name: '12.7毫米机枪', kind: 'line', range: 3, dmg: { inf: 2, soft: 2, la: 1, ha: 0, bld: 1 }, fx: 'mg' },
  pkm:     { name: 'PKM 通用机枪', kind: 'line', range: 3, dmg: { inf: 2, soft: 1, la: 0, ha: 0, bld: 0 }, fx: 'mg', desc: '射程 3。压制步兵，对装甲无效。' },
  a42:     { name: '2A42 30毫米机关炮', kind: 'line', range: 4, hitsAir: true, dmg: { ha: 1, la: 2, soft: 2, inf: 2, air: 1, bld: 1 }, fx: 'mg', desc: '射程 4。可以打直升机和无人机。' },
  konkurs: { name: '9M113“竞赛”反坦克导弹', kind: 'line', range: 5, ammo: 'kon', dmg: { ha: 3, la: 3, soft: 2, inf: 1, bld: 1 }, fx: 'atgm', desc: '直射导弹，射程 5，每场任务 1 发。' },
  msta:    { name: '152毫米炮火', dmg: { ha: 1, la: 2, soft: 2, inf: 2, bld: 1 }, fx: 'barrage' },
};

// ---------- tiles ----------
// . muddy field · r road · R runway · f forest · w river · d ruined bridge with a plank footbridge
// buildings: h house · b apartment block · c church · S substation · H hangar (military, no civilians)
const TILE = {
  '.': { name: '解冻的农田', note: '泥泞：车辆移动消耗 2' },
  r: { name: '公路', note: '车辆移动消耗 1' },
  R: { name: '机场跑道', note: '车辆移动消耗 1' },
  f: { name: '森林', note: '车辆无法进入。步兵在其中受到的伤害 -1' },
  w: { name: '河流', note: '只有两栖车辆能通过。其他地面单位落水即沉没' },
  o: { name: '外海', note: '只有舰艇和两栖车辆能进入。地面单位落水即沉没' },
  s: { name: '沙滩', note: '车辆移动消耗 2' },
  d: { name: '断桥', note: '只剩木板便桥，只有步兵能通过' },
};
const BLD = {
  h: { name: '民房', hp: 1, pop: 4, civil: true },
  b: { name: '赫鲁晓夫楼', hp: 2, pop: 120, civil: true },
  c: { name: '教堂', hp: 1, pop: 25, civil: true },
  S: { name: '变电站', hp: 2, pop: 0, civil: true },
  H: { name: '机库', hp: 3, pop: 0, civil: false },
};

// ---------- characters ----------
const CHARS = {
  oksana: { name: '奥克桑娜·博伊科 少校', call: '基石', role: '作战参谋', face: { skin: '#e0b896', hair: '#3a2a20', style: 'bun', headset: true, uniform: '#56603a' } },
  mykola: { name: '米科拉·舍甫琴科 上士', call: '老鹰', role: 'T-64BV 车长', face: { skin: '#d2a47e', hair: '#6b5a4a', style: 'tanker', mustache: '#5a4a3a', uniform: '#4d5733' } },
  taras:  { name: '塔拉斯·梅利尼克', call: '教授', role: '反坦克组组长', face: { skin: '#e0b896', hair: '#8a8378', style: 'helmet', beard: '#9a9388', glasses: true, uniform: '#5f6f3c' } },
  ivanna: { name: '伊万娜·霍尔丁 中尉', call: '计算器', role: 'D-30 炮班长', face: { skin: '#ecc4a0', hair: '#b0763c', style: 'beanie', uniform: '#56603a' } },
  olena:  { name: '奥列娜·克拉夫丘克 中士', call: '海燕', role: '无人艇操作员', face: { skin: '#e8c0a0', hair: '#2a2420', style: 'beanie', headset: true, uniform: '#2f3b4a' } },
  dmytro: { name: '德米特罗·邦达连科 上尉', call: '灯塔', role: '“海王星”发射车车长', face: { skin: '#d8ae88', hair: '#2e2620', style: 'helmet', mustache: '#3a2a20', uniform: '#4d5733' } },
  roman:  { name: '罗曼·特卡琴科', call: '邮差', role: '国土防卫步兵班长', face: { skin: '#dcb08a', hair: '#5a4632', style: 'helmet', beard: '#5a4632', uniform: '#5f6f3c' } },
  serhiy: { name: '谢尔希·莫罗兹 中士', call: '铁匠', role: 'BMP-2 车长', face: { skin: '#e0b896', hair: '#2e2620', style: 'tanker', uniform: '#4d5733' } },
  radio:  { name: '无线电截获', call: '截获', role: '俄军频道', face: { radio: true } },
};

// ---------- missions ----------
const MISSIONS = [
  {
    id: 'hostomel', code: '1-1', name: '霍斯托梅尔机场', date: '2022年2月24日 下午', place: '基辅州 · 霍斯托梅尔', chapter: 0,
    mapPos: [0.38, 0.5], turns: 4, face: { ua: [0, -1], ru: [0, 1] },
    map: ['ffff.fff', 'f..H..Hf', 'RRRRRRRR', 'RRRRRRRR', '..r...r.', 'f.r..f..', 'hhr.h..f', 'b.rh.hf.'],
    deploy: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [2, 6], [3, 6], [5, 6], [6, 6], [1, 7], [2, 7], [4, 7]],
    squad: { t64: [3, 4], atgm: [5, 5], d30: [2, 6] },
    enemies: [['vdv', 2, 3], ['vdv', 5, 2], ['vdv', 7, 3], ['ka52', 6, 0]],
    waves: [
      { turn: 1, units: [['mi8', 0, 0]] },
      { turn: 2, units: [['mi8', 7, 0], ['vdv', 0, 2]] },
      { turn: 3, units: [['ka52', 7, 1]] },
    ],
    barrage: null,
    objectives: [
      { id: 'runway', kind: 'primary', text: '炮击跑道，制造 3 个弹坑', reward: 5, eval: B => ({ cur: countTiles(B, t => t.t === 'R' && t.crater), max: 3 }) },
      { id: 'heli', kind: 'bonus', text: '击落 2 架直升机', reward: 2, eval: B => ({ cur: B.stats.heli, max: 2 }) },
      { id: 'village', kind: 'bonus', text: '民用建筑被击中不超过 2 次', reward: 1, eval: B => ({ cur: B.stats.bldHit, max: 2, inverse: true }) },
    ],
    brief: [
      ['oksana', '“向日葵”，这里是“基石”。空降兵已经占领了霍斯托梅尔机场西侧跑道，第一波大约两百人，全是直升机运来的。'],
      ['oksana', '他们在等运输机。只要跑道还能用，今晚就会有整团的伊尔-76 落在这里，离首都只有二十五公里。'],
      ['ivanna', '我的 D-30 在镇子里展开了。但我看不见跑道，得有人在前面替我盯着落点。'],
      ['mykola', '卡-52 还在头顶绕圈，它们会先找我的坦克。教授，你的毒刺准备好了吗？'],
      ['taras', '准备好了，就一发。别让我浪费在不值得的目标上。'],
      ['oksana', '任务：把跑道炸烂，坚守到天黑。镇上还有居民没撤出来，尽量别让他们的房子挨炮。'],
    ],
    tips: ['榴弹炮的落点必须在其他友军 3 格以内。', '标枪和毒刺弹药有限，任务之间可以补充。', '击落直升机可以阻止它降下空降兵。'],
    outcome: {
      win: '天黑前，跑道上布满弹坑。原定降落的伊尔-76 编队被迫返航，俄军用空降夺取首都门户的计划落空了。',
      partial: '跑道仍然可以使用。夜里，更多空降兵被送到了基辅西北方向。',
    },
    consequence: B => (objDone(B, 'runway') ? null : { flag: 'runwayOpen', text: '跑道未被破坏：后续任务将出现更多空降兵。' }),
  },
  {
    id: 'irpin', code: '1-2', name: '伊尔平断桥', date: '2022年3月5日 清晨', place: '基辅州 · 伊尔平', chapter: 0,
    mapPos: [0.395, 0.635], turns: 5, face: { ua: [1, 0], ru: [-1, 0] },
    map: ['fb.h.w.f', 'h.b.rw.b', '.bSbrw..', '....rw.f', 'fh.b.w..', '.c..rw.h', 'rrrrrdrr', 'ff.h.wf.'],
    deploy: [[0, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [2, 4], [4, 4], [0, 5], [2, 5], [3, 5], [4, 5], [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [2, 7], [4, 7], [4, 2], [4, 1]],
    squad: { t64: [4, 4], atgm: [4, 2], d30: [2, 5] },
    enemies: [['t72', 7, 3], ['btr', 6, 4], ['grad', 7, 4], ['orlan', 6, 2], ['vdv', 6, 5]],
    waves: [
      { turn: 1, units: [['vdv', 7, 2]] },
      { turn: 2, units: [['btr', 7, 7]] },
      { turn: 3, units: [['t72', 7, 0]] },
      { turn: 4, units: [['btr', 6, 1]] },
    ],
    extraWaves: { runwayOpen: [{ turn: 2, units: [['vdv', 7, 5]] }] },
    barrage: { from: 1, count: 1 },
    civ: { path: [[6, 6], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6]], groups: [1, 2, 3], speed: 3 },
    objectives: [
      { id: 'evac', kind: 'primary', text: '护送至少 2 批平民过河', reward: 5, eval: B => ({ cur: B.stats.evac, max: 2 }) },
      { id: 'evac3', kind: 'bonus', text: '3 批平民全部过河', reward: 2, eval: B => ({ cur: B.stats.evac, max: 3 }) },
      { id: 'sub', kind: 'bonus', text: '变电站完好', reward: 1, eval: B => ({ cur: countTiles(B, t => t.t === 'S' && bldAlive(t)), max: 1 }) },
      { id: 'orlan', kind: 'bonus', text: '击落奥兰-10 无人机', reward: 1, eval: B => ({ cur: B.stats.orlan, max: 1 }) },
    ],
    brief: [
      ['oksana', '2月25日，我们自己炸掉了伊尔平河上的桥，挡住了装甲纵队。现在，这座断桥是城里居民唯一的出路。'],
      ['oksana', '俄军炮兵盯着这条路。天上那架奥兰-10 看到哪里，炮弹就落到哪里。'],
      ['taras', '我在基辅教了二十年历史。从没想过会亲眼看着人们踩着木板过河。'],
      ['mykola', '对岸的 BTR 是两栖的，会游泳。别以为这条河能挡住它们。'],
      ['ivanna', '平民走的那条路在我的射界里。给我观察员，我能把靠近桥头的东西都清掉。'],
      ['oksana', '任务：让至少两批平民过河，先把那架无人机打下来。平民不会躲，挡在他们前面的只有你们。'],
    ],
    tips: ['奥兰-10 活着时，敌方炮火会多一发，而且专打你的单位。', '平民每回合沿公路走 3 格，能从我方单位身边穿过，但会被敌人挡住。', 'NSVT 高射机枪可以打无人机。'],
    outcome: {
      win: '那几天，数千名居民踩着断桥下的木板撤离了伊尔平。士兵们在桥下接过老人和孩子，一个一个送到对岸。',
      partial: '撤离路线被炮火切断，许多居民被困在了伊尔平城内。',
    },
    consequence: B => (B.stats.evac >= 2 ? null : { flag: 'civFail', text: '撤离失败：民防准备不足。' }),
  },
  {
    id: 'skybyn', code: '1-3', name: '斯凯宾伏击', date: '2022年3月10日 上午', place: '布罗瓦里方向 · 斯凯宾村', chapter: 0,
    mapPos: [0.71, 0.635], turns: 5, face: { ua: [0, -1], ru: [-1, 0] },
    map: ['ffff.fff', '.f..f...', 'h.h..h.h', 'rrrrrrrr', '.h.c..h.', '..f....f', 'ff..ff..', 'fff.ffff'],
    deploy: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [2, 5], [0, 5], [1, 5], [3, 5], [4, 5], [0, 6], [1, 6], [2, 6], [3, 6], [3, 7]],
    squad: { t64: [3, 5], atgm: [1, 1], d30: [0, 6] },
    enemies: [['t72', 6, 3], ['cmd', 7, 3]],
    convoy: true,
    waves: [
      { turn: 1, units: [['btr', 7, 3]] },
      { turn: 2, units: [['t72', 7, 3]] },
      { turn: 3, units: [['btr', 7, 3]] },
      { turn: 4, units: [['t72', 7, 3]] },
    ],
    extraWaves: { runwayOpen: [{ turn: 2, units: [['vdv', 7, 1]] }] },
    barrage: { from: 3, count: 1 },
    objectives: [
      { id: 'block', kind: 'primary', text: '最多 1 辆车突破西侧', reward: 5, eval: B => ({ cur: B.stats.escaped, max: 1, inverse: true }) },
      { id: 'armor', kind: 'bonus', text: '击毁 4 辆装甲车辆', reward: 2, eval: B => ({ cur: B.stats.armor, max: 4 }) },
      { id: 'cmd', kind: 'bonus', text: '击毁团指挥车', reward: 1, eval: B => ({ cur: B.stats.cmd, max: 1 }) },
      { id: 'village', kind: 'bonus', text: '民用建筑被击中不超过 1 次', reward: 1, eval: B => ({ cur: B.stats.bldHit, max: 1, inverse: true }) },
    ],
    brief: [
      ['oksana', '侦察报告：一个坦克团的纵队正沿公路从东北开往布罗瓦里。三十多辆装甲车，车距很近。'],
      ['mykola', '三月的地里全是烂泥，他们离不开公路。打掉头车，后面的就全堵在村子里了。'],
      ['ivanna', '村口的公路我已经标定好了。只要有人盯着，炮弹会准时落下去。'],
      ['taras', '纵队中间那辆竖着天线的车，是他们的指挥车。'],
      ['oksana', '这是一次伏击。先选好阵地再开火。不能让他们冲过这个村子。'],
    ],
    tips: ['纵队保持行军队形，每回合最多前进 2 格。', '被击毁的车辆会变成残骸，堵住公路；车辆绕进农田每格消耗 2 点移动力。', '步兵躲在森林里受到的伤害 -1。'],
    outcome: {
      win: '纵队丢下燃烧的坦克撤出了斯凯宾。3月29日，俄方宣布从基辅方向“大幅减少军事活动”。',
      partial: '纵队冲过了村子，布罗瓦里方向的防线被迫后撤。',
    },
    consequence: () => null,
  },
  {
    id: 'odesa', code: '2-1', name: '敖德萨湾', date: '2022年4月上旬 夜间', place: '敖德萨州 · 敖德萨湾',
    chapter: 1, mapPos: [0.56, 0.54], turns: 4, face: { ua: [0, 1], ru: [0, -1] },
    map: ['b.h.fbh.', '.h.r.h.f', 'rrrrrrrr', '.f..h..f', 'ssssssss', 'oooooooo', 'oooooooo', 'oooooooo'],
    deploy: [[0, 1], [2, 1], [4, 1], [6, 1], [0, 3], [2, 3], [3, 3], [5, 3], [6, 3], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2]],
    squad: { t64: [3, 3], atgm: [5, 3], neptune: [2, 1] },
    enemies: [['raptor', 2, 6], ['raptor', 5, 7], ['btr', 6, 6], ['ka52', 7, 5]],
    waves: [
      { turn: 1, units: [['btr', 1, 7]] },
      { turn: 2, units: [['raptor', 7, 7]] },
      { turn: 3, units: [['btr', 3, 7], ['btr', 6, 7]] },
    ],
    barrage: null,
    objectives: [
      { id: 'landing', kind: 'primary', text: '上岸的敌军不超过 1 个', reward: 5, eval: B => ({ cur: B.units.filter(u => u.team === 'ru' && !u.dead && !isAir(u) && !isWater(TILEAT(u.x, u.y))).length, max: 1, inverse: true }) },
      { id: 'naval', kind: 'bonus', text: '击沉 2 艘巡逻艇', reward: 2, eval: B => ({ cur: B.stats.naval, max: 2 }) },
      { id: 'heli', kind: 'bonus', text: '击落卡-52', reward: 1, eval: B => ({ cur: B.stats.heli, max: 1 }) },
      { id: 'city', kind: 'bonus', text: '民用建筑被击中不超过 2 次', reward: 1, eval: B => ({ cur: B.stats.bldHit, max: 2, inverse: true }) },
    ],
    brief: [
      ['oksana', '“向日葵”，敖德萨外海发现俄军巡逻艇。它们在替登陆部队侦察海滩和雷区。'],
      ['dmytro', '“海王星”已经展开。两发导弹，够让它们知道这片海不欢迎客人。'],
      ['mykola', '沙滩上开不快，我守在公路上。谁想上岸，先过我这一关。'],
      ['taras', '卡-52 会低空掩护登陆，毒刺留给它。'],
      ['oksana', '任务：击沉巡逻艇，挡住登陆部队。整个敖德萨都在看着这片海。'],
    ],
    tips: ['“海王星”只能攻击水面舰艇，每场任务 2 发。', 'BTR 是两栖的，会从海上直接冲上沙滩。', '车辆在沙滩上每格消耗 2 点移动力。'],
    outcome: {
      win: '俄军巡逻艇撤出了敖德萨湾。几天后，4月13日夜，两枚“海王星”导弹击中了黑海舰队旗舰“莫斯科”号。',
      partial: '巡逻艇仍在外海游弋，把海岸防线的位置报给了舰队。',
    },
    consequence: () => null,
  },
];

// ---------- campaign upgrades ----------
const UPGRADES = [
  { id: 'jav', name: '标枪补给', desc: '反坦克组每场任务多带 1 发标枪。', cost: 1, max: 2 },
  { id: 'sting', name: '毒刺补给', desc: '反坦克组每场任务多带 1 发毒刺。', cost: 1, max: 2 },
  { id: 't64hp', name: '加挂反应装甲', desc: 'T-64BV 生命值 +1。', cost: 2, max: 1 },
  { id: 'spot', name: '空中侦察分队', desc: '民用四旋翼无人机为炮兵校射：观察范围 3 → 5。', cost: 2, max: 1 },
  { id: 'tb2', name: 'TB2 再出动', desc: '每场任务多一次 TB2 打击。', cost: 2, max: 1 },
];

const PROLOGUE = [
  '2022年2月24日，凌晨5时',
  '巡航导弹击中了基辅、哈尔科夫、第聂伯罗的机场和军事设施。',
  '上午，数十架俄军直升机贴着基辅水库的水面低飞，扑向首都西北二十五公里的霍斯托梅尔机场。',
  '如果机场失守，运输机将把成团的伞兵直接送到基辅门口。',
  '你指挥的特遣队是离机场最近的一支部队。代号：“向日葵”。',
];
const EPILOGUE = [
  '3月底，俄军开始从基辅州撤退。',
  '4月2日，乌克兰宣布基辅州全境收复。',
  '在俄军撤出的布恰、伊尔平和霍斯托梅尔，人们找到了数百名平民的遗体。',
  '首都守住了。战争还远没有结束。',
];

const PROLOGUE2 = [
  '2022年3月，黑海。',
  '俄罗斯黑海舰队封锁了乌克兰的港口，登陆舰在敖德萨外海游弋。',
  '敖德萨人把沙袋堆上海滩，在港口入口布下水雷。',
  '“向日葵”特遣队被调往南方。',
];
const CHAPTERS = [
  { name: '战区一 · 基辅之冬', sub: '基辅州战略态势 · 2022年2–3月', geo: 'kyiv', prologue: PROLOGUE, epilogue: EPILOGUE },
  { name: '战区二 · 黑海', sub: '敖德萨州沿海 · 2022年3–10月', geo: 'odesa', prologue: PROLOGUE2, epilogue: [] },
];
const chapterOf = mi => MISSIONS[mi] ? MISSIONS[mi].chapter : CHAPTERS.length - 1;

function countTiles(B, fn) { let n = 0; for (const row of B.tiles) for (const t of row) if (fn(t)) n++; return n; }
function objDone(B, id) {
  const o = B.mission.objectives.find(o => o.id === id);
  if (!o) return false;
  const r = o.eval(B);
  return r.inverse ? r.cur <= r.max : r.cur >= r.max;
}
