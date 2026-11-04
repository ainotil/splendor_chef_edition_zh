# 主厨餐桌 · Splendor: The Chef's Table

一个专门面向 5 人局的 Splendor 私人改版的数字原型。保留原版"拿资源—买卡—折扣滚雪球"的骨架，用中餐五味主题、家常菜开局、座位补偿、冰箱上限和善恶主厨系统，解决 5 人局资源枯竭、节奏失衡和先手优势的问题。

想马上玩：见[快速开始](docs/quickstart.md)。

## 文档

| 文档 | 给谁看 |
| --- | --- |
| [快速开始](docs/quickstart.md) | 想玩、想本地跑、想改数值的人 |
| [规则说明书](docs/rules.md) | 玩家：完整规则、10 位主厨、各人数数值 |
| [上云说明书](docs/deploy.md) | 开服的人：GitHub Pages + Render 免费部署、常见问题 |
| [策划案](docs/proposal.md) | 设计思路、数值推导、模拟数据、试玩计划 |

## 常用命令

需要 Node.js 24（见 `.nvmrc`），先 `npm install`。

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器，同屏试玩 |
| `npm test` | 跑一遍全部测试 |
| `npm run test:watch` | 改代码时自动重跑测试 |
| `npm run lint` | ESLint 检查 |
| `npm run build` | 打包到 `dist/` |
| `npm run check` | lint + 测试 + 打包，提交前跑一次 |
| `npm run simulate` | 用机器人批量对局，统计 2–5 人局的节奏和座位胜率（见 `scripts/simulate.js`） |
| `npm run server` | 启动联网服务器（需要环境变量 `API_SECRET`，见[上云说明书](docs/deploy.md)） |

CI（`.github/workflows/ci.yml`）在每次推送到 `main` 和每个 PR 上跑同样的检查；`pages.yml` 把网页发布到 GitHub Pages。

## 目录结构

```
src/
  game/              规则引擎（纯逻辑，不依赖 React；服务器和模拟脚本也直接用）
    constants.js     按人数的数值表 RULES：每色调味数、高汤、冰箱、主厨、终局分数、座位补偿
    data/            90 张食谱、10 位主厨
    state.js         纯函数：折扣、口碑、付款、天使的持续技能、主厨条件、排名
    draft.js         开局阶段：家常菜反向挑选 + 座位补偿
    moves.js         正式游戏的行动：拿 3 个 / 拿 2 个 / 预订 / 购买 / 冰箱弃牌
    skills.js        主厨：请主厨、恶魔和"到来时"天使的效果、偷味 / 撤菜环节
    turn.js          回合收尾：行动 → 弃牌 → 选主厨 → 结束回合
    game.js          boardgame.io 游戏定义：setup、阶段、环节、回合顺序、终局、playerView
    testing.js       测试辅助函数
    *.test.js        Vitest 测试
  board/             React 界面（同屏和联网共用）
    Board.jsx        整体布局 + 底栏
    StatusBar.jsx    顶部状态栏：提示和操作按钮
    Table.jsx        桌面：家常菜挑选、市场、调味堆、主厨
    Sidebar.jsx      右侧玩家栏
    Screens.jsx      整页画面：联网等人入座、终局结算
    Help.jsx         新手教程
    OnlineLobby.jsx  联网大厅
    Flights.jsx      代币和食谱的飞行动画
    labels.js        代币中文名、颜色、图标
  assets/            调料图标
  online.js          联网大厅：连服务器、带密码建房 / 加入、记住上一局
  App.jsx            首页和路由：同屏 / 联网大厅 / 对局
server/
  index.js           联网服务器（boardgame.io Server）
scripts/
  simulate.js        数值模拟（贪心机器人批量对局）
  *.py               调料图标的生成和导入
docs/                快速开始、规则说明书、上云说明书、策划案
```

## 设计约定

- **联网时每人只收到自己该看的**：牌堆顺序和别人摸的暗牌在 `playerView`（`game.js`）里藏掉。同屏模式（`G.hotseat`）不藏。
- **状态只存事实，不存推导值**：口碑和折扣每次从已购买的食谱和主厨实时算出来，见 `state.js`。
- **非法行动一律返回 `INVALID_MOVE`**，不改变任何状态。
- **加主厨**：`data/chefs.js` 加一行；持续技能写在 `state.js`，到来时效果写在 `skills.js`，再补 `skills.test.js`。
- **改规则要同步三处**：代码、[规则说明书](docs/rules.md)、新手教程 `Help.jsx`。
- **调数值只改 `constants.js`**：每局开始时按人数取一份存进 `G.rules`，规则和界面都从这里读。改完跑 `npm run simulate` 看节奏和座位胜率有没有变坏。
- 代币键名：`sugar` 糖、`soy` 酱油、`chili` 辣椒、`peppercorn` 花椒、`vinegar` 醋、`stock` 高汤。

## 技术栈

[boardgame.io](https://boardgame.io) 0.50 · React 19 · Vite · Vitest · ESLint
