// Blocks until the executor has something to do, using the same rules as AGENTS.md section 1:
//  - a card marked 需修改 whose branch already carries the reviewer's latest "Review" commit, or
//  - a card marked 待开发 with all dependencies 已完成 and no zcode/T-xx branch on the remote yet.
// Prints what it found and exits 0. Checks once a minute; costs no model tokens while waiting.
// Usage: node tools/wait-for-work.js [--once]
const { execSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const sh = cmd => execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const once = process.argv.includes('--once');

function findWork() {
  sh('git -c core.quotepath=off fetch -q origin --prune');
  // The board lives on the integration branch (see AGENTS.md); main only receives milestone merges.
  const board = sh('git -c core.quotepath=off show origin/claude/inspiring-johnson-7m5bvj:docs/tasks/BOARD.md');
  const rows = board.split('\n').filter(l => /^\|\s*T-\d+/.test(l)).map(l => {
    const c = l.split('|').map(s => s.trim());
    return { id: c[1], title: c[2].replace(/\[([^\]]+)\].*/, '$1'), status: c[3], deps: (c[4].match(/T-\d+/g) || []) };
  });
  const done = new Set(rows.filter(r => r.status === '已完成').map(r => r.id));
  const branches = sh('git branch -r --list "origin/zcode/T-*"').split('\n').map(s => s.trim()).filter(Boolean);
  const branchOf = id => branches.find(b => b === `origin/zcode/${id}` || b.startsWith(`origin/zcode/${id}-`));
  for (const r of rows) {
    if (r.status !== '需修改') continue;
    const b = branchOf(r.id);
    if (b && sh(`git log -1 --format=%s ${b}`).startsWith('Review')) return `${r.id} 需修改：${r.title}`;
  }
  for (const r of rows) {
    if (r.status === '待开发' && r.deps.every(d => done.has(d)) && !branchOf(r.id)) return `${r.id} 待开发：${r.title}`;
  }
  return null;
}

(async () => {
  for (;;) {
    let w = null;
    try { w = findWork(); } catch (e) { /* network hiccup: try again next minute */ }
    if (w) { console.log('有新任务 ' + w); process.exit(0); }
    if (once) { console.log('没有可做的任务'); process.exit(0); }
    await new Promise(r => setTimeout(r, 60 * 1000));
  }
})();
