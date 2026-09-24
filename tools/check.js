// Fast checks run before every push and in CI:
//  1. every game and tool script parses;
//  2. on a zcode/T-xx branch, only files listed in the task card's "改动范围" were changed.
// Usage: node tools/check.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const sh = cmd => execSync(cmd, { cwd: root, encoding: 'utf8' }).trim();
let failed = false;
const fail = msg => { console.error('✗ ' + msg); failed = true; };

// 1. syntax
const scripts = [...fs.readdirSync(path.join(root, 'game/js')).map(f => 'game/js/' + f), ...fs.readdirSync(path.join(root, 'tools')).filter(f => f.endsWith('.js')).map(f => 'tools/' + f)];
for (const f of scripts) {
  try { execSync(`node --check "${f}"`, { cwd: root, stdio: 'pipe' }); }
  catch (e) { fail(`语法错误 ${f}\n${e.stderr}`); }
}
if (!failed) console.log(`✓ 语法检查通过（${scripts.length} 个文件）`);

// 2. scope
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || sh('git rev-parse --abbrev-ref HEAD');
const m = branch.match(/^zcode\/(T-\d+)/);
if (!m) { console.log(`- 分支 ${branch} 不是任务分支，跳过改动范围检查`); process.exit(failed ? 1 : 0); }
const id = m[1];
const cardName = fs.readdirSync(path.join(root, 'docs/tasks')).find(f => f.startsWith(id + '-') && f.endsWith('.md'));
if (!cardName) { fail(`找不到任务卡 docs/tasks/${id}-*.md`); process.exit(1); }
const card = fs.readFileSync(path.join(root, 'docs/tasks', cardName), 'utf8');
const scopeLine = card.split('\n').find(l => l.includes('改动范围'));
if (!scopeLine) { fail(`任务卡 ${cardName} 缺少“改动范围”`); process.exit(1); }
const allowed = [...scopeLine.matchAll(/`([^`]+)`/g)].map(x => x[1]);
allowed.push(`docs/tasks/${cardName}`, `docs/tasks/shots/${id}/**`);
const toRe = g => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$');
const res = allowed.map(toRe);
try { sh('git rev-parse --verify origin/main'); } catch (e) { fail('找不到 origin/main，先运行 git fetch origin'); process.exit(1); }
// Three-dot diff: only what this branch changed since it last took in main.
const changed = new Set([
  ...sh('git diff --name-only origin/main...HEAD').split('\n'),
  ...sh('git diff --name-only HEAD').split('\n'),
  ...sh('git ls-files --others --exclude-standard').split('\n'),
].filter(Boolean));
const outside = [...changed].filter(f => !res.some(r => r.test(f)));
if (outside.length) fail(`${id} 改了范围外的文件：\n  ${outside.join('\n  ')}\n  允许的范围：${allowed.join('、')}`);
else console.log(`✓ 改动范围检查通过（${id}，${changed.size} 个文件）`);
process.exit(failed ? 1 : 0);
