# 向日葵防线 Sunflower Line

受《Into the Breach》启发的回合制战术游戏。背景是 2022 年的俄乌战争，玩家指挥乌克兰特遣队守卫基辅。

## 运行

用浏览器直接打开 `game/index.html`，不需要构建，也不需要服务器。第一章“基辅保卫战”的 3 个任务可以完整游玩。

## 目录

- `game/`：游戏本体（纯 JavaScript + Canvas，美术、音效、音乐全部由代码生成）
  - `js/data.js`：单位、武器、任务、剧情对话、升级。改数值和关卡主要改这里
  - `js/battle.js`：规则、敌方 AI、回合流程
  - `js/render.js`：战场渲染与战斗动画
  - `js/models.js`：体素模型（车辆、直升机、建筑、树木）
  - `js/ui.js`：标题、战役地图、简报、HUD、结算
  - `js/audio.js`：WebAudio 合成音效与配乐
- `docs/GDD.md`：游戏设计文档
- `tools/playtest.js`：自动试玩与截图（`NODE_PATH=$(npm root -g) node tools/playtest.js out/`）
