# AGENTS.md：给编码代理的工作协议

本项目由两个 AI 协作开发：**审查方**（Claude）负责拆任务、审查和合并；**执行方**（你）负责写代码。
人类负责人只会对你说一句“继续”。收到后，严格按下面的协议执行，不需要再问人类要做什么。

## 1. 收到“继续”时的固定流程

1. 同步代码：
   ```
   git fetch origin
   git checkout main && git pull origin main
   ```
2. 读看板 `docs/tasks/BOARD.md`（以 `origin/main` 上的版本为准），按以下优先级挑任务：
   1. 状态为 **需修改** 的任务：切到它的分支 `git checkout zcode/T-xx && git pull origin zcode/T-xx`，
      读卡片最下方最新一轮“审查意见”，逐条修改。
   2. 否则，挑编号最小、状态为 **待开发**、远端还没有 `zcode/T-xx` 分支、并且“依赖”一栏的任务都已是 **已完成** 的任务：
      `git checkout -b zcode/T-xx origin/main`。
   3. 两种都没有：回复“没有可做的任务”，然后结束。
3. 读任务卡 `docs/tasks/T-xx-*.md`，只做卡片要求的事。
4. 自测（见第 3 节），必须全部通过。
5. 在任务卡的“执行记录”里追加一段（不要改其他人写的内容）：改了什么、自测结果、需要审查方决定的问题。
6. 提交并推送：
   ```
   git merge origin/main        # 先合入最新主干，有冲突就在本分支解决
   git add -A
   git commit -m "T-xx: 一句话说明"
   git push -u origin zcode/T-xx
   ```
7. 回复人类一句话：`T-xx 已推送，等待审查`。

## 2. 硬性规则

- **只改任务卡“改动范围”里列出的文件**，外加该卡片文件本身和 `docs/tasks/shots/T-xx/`。改了范围外的文件，自动检查会直接判失败。
- **永远不要**推送到 `main`，不要改 `docs/tasks/BOARD.md`，不要删除或改写别人写的执行记录和审查意见。
- 拿不准的地方（需求不清、要改范围外的文件、史实不确定）：在执行记录里写清楚问题，推送后停下，不要自己猜。
- 不引入外部库、外部图片或音频。美术用体素模型（`game/js/models.js`），音效用 WebAudio 合成（`game/js/audio.js`）。
- 代码风格跟周围保持一致：2 空格缩进、单引号、`'use strict'`、全局函数，不使用 ES module。注释密度和命名方式参照同文件已有代码。
- 所有面向玩家的文字用简体中文，语气克制、写实。

## 3. 自测（推送前必须全部通过）

```
node tools/check.js                                  # 语法检查 + 改动范围检查
node tools/playtest.js /tmp/pt-T-xx                  # 机器人打通整章，结尾输出 ERRORS none（截图输出到仓库外的临时目录）
```
- 第一次运行前需要安装依赖：`npm ci && npx playwright install chromium`。
- `playtest.js` 的输出以 `ERRORS none` 结尾，并且退出码为 0，才算通过。
- 卡片要求截图时，只把**卡片点名的那几张**从临时目录复制到 `docs/tasks/shots/T-xx/`，并在执行记录里写上文件名。不要提交其他截图，避免仓库膨胀。

## 4. 项目结构

浏览器直接打开 `game/index.html` 就能运行，不需要构建。脚本按下面的顺序加载，共享全局作用域：

| 文件 | 负责什么 |
|---|---|
| `game/js/util.js` | 通用工具：缓动、hash、`sleep`、`shade`、`store` |
| `game/js/gfx.js` | 画布缩放、像素绘制基础函数、体素引擎（`Vox`、`bake`、`sprite`）、`tween` |
| `game/js/models.js` | 所有体素模型：`UNIT_MODEL`、`MUZZLE`、建筑和地形道具 |
| `game/js/audio.js` | 合成音效和配乐 |
| `game/js/data.js` | **数据**：单位、武器、地块、角色、任务（地图、敌军、增援、目标、对话）、升级。改数值和关卡主要改这里 |
| `game/js/battle.js` | 规则：移动、瞄准、伤害、推击、敌方 AI、回合流程、任务结算 |
| `game/js/render.js` | 战场渲染、敌方意图显示、所有战斗动画和特效 |
| `game/js/ui.js` | 标题、过场、战役地图、简报对话、战斗 HUD、结算、补给 |
| `game/js/main.js` | 主循环、启动，以及给自动测试用的 `window.__sf` |

关键约定：
- 坐标是 8×8 网格，`x` 向屏幕右下，`y` 向屏幕左下。`center(x, y)` 返回地块中心的屏幕坐标。
- 体素模型的 `+x` 是车头方向，`z` 向上，一个体素在屏幕上占 2 个美术像素。
- 游戏逻辑用 `await` 等待动画完成（`tween`、`fly`、`sleep`），测试时把 `SPEED` 调到接近 0 来跳过动画。

## 5. 题材与史实底线

- 装备必须符合所在战区的时间点，参见 `docs/GDD.md` 第 10 节“史实校对清单”。
- 不把暴行做成玩法；不出现真实在世人物；平民永远是被保护的对象。
- 敌方的“恶”只体现在机制上，不做丑化民族的描写。
