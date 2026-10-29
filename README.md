# 主厨餐桌 · Splendor: The Chef's Table

一个专门面向 5 人局的 Splendor 私人改版的数字原型。保留原版"拿资源—买卡—折扣滚雪球"的骨架，用中餐五味主题、家常菜开局、座位补偿、招牌菜付费门槛和善恶主厨系统，解决 5 人局资源枯竭、节奏失衡和先手优势的问题。

完整策划案见 [docs/proposal.md](docs/proposal.md)。

## 快速开始

需要 Node.js 24（见 `.nvmrc`）。

```bash
npm install
npm run dev        # 本地同屏试玩，打开终端里显示的地址
```

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm test` | 跑一遍全部测试 |
| `npm run test:watch` | 改代码时自动重跑测试 |
| `npm run lint` | ESLint 检查 |
| `npm run build` | 打包到 `dist/` |
| `npm run check` | lint + 测试 + 打包，提交前跑一次 |
| `npm run simulate` | 用机器人批量对局，统计 2–5 人局的节奏和座位胜率（见 `scripts/simulate.js`） |
| `npm run server` | 启动联网服务器（需要环境变量 `API_SECRET`，见下方“联网部署”） |

CI（`.github/workflows/ci.yml`）在每次推送到 `main` 和每个 PR 上跑同样的检查。

## 联网部署（GitHub Pages + Render 免费方案）

网页放在 GitHub Pages，联网服务器放在 Render 免费方案。两边都不花钱。房间密码只存在服务器上，不知道密码的人建不了房也进不了房。

**1. 部署服务器（Render）**

1. 用 GitHub 账号登录 [render.com](https://render.com)，选 **New → Blueprint**，指向这个仓库。它会读 `render.yaml`。
2. 按提示填 `API_SECRET`：这就是房间密码，发给一起玩的朋友。
3. 部署完会得到一个地址，例如 `https://chefs-table-server.onrender.com`。打开 `/health` 看到 `ok` 就说明服务器在运行。

**2. 部署网页（GitHub Pages）**

1. 仓库 **Settings → Pages**，Source 选 **GitHub Actions**。
2. **Settings → Secrets and variables → Actions → Variables**，新建 `SERVER_URL`，值是上一步的服务器地址（不要末尾的 `/`）。
3. 推送到 `main`，`.github/workflows/pages.yml` 会自动打包发布到 `https://<用户名>.github.io/<仓库名>/`。

如果 GitHub Pages 地址不是 `https://ainotil.github.io`，记得改 `render.yaml` 里的 `ALLOWED_ORIGINS`（或在 Render 后台改）。

**3. 怎么玩**

一个人打开网页 → **进入联网大厅** → 输密码和名字 → 选人数 → **建房间**，把房间号或邀请链接发给朋友。朋友打开链接，输同一个密码和名字，选空座位。人齐自动开始。刷新页面会回到自己的座位。

**免费方案的限制**

- 服务器 15 分钟没人连就休眠。下一次打开大厅时要等半分钟左右醒来（大厅一打开就会去叫醒它）。
- 房间存在服务器内存里：服务器休眠或重新部署，进行中的对局就没了。一局一般 1 小时内打完，问题不大。

**本地试联网**

```bash
API_SECRET=随便一个密码 PORT=8765 npm run server        # 终端 1
VITE_SERVER_URL=http://localhost:8765 npm run dev       # 终端 2，然后开两个浏览器窗口（一个用无痕模式）
```

## 目录结构

```
src/
  game/              规则引擎（纯逻辑，不依赖 React）
    constants.js     按人数的数值表 RULES：每色调味数、高汤、冰箱、主厨、终局分数、座位补偿
    data/            90 张食谱、10 位主厨
    state.js         纯函数：折扣、口碑、付款计算、主厨条件、排名
    moves.js         正式游戏的行动：拿 3 个 / 拿 2 个 / 预订 / 购买 / 弃牌 / 选主厨
    draft.js         开局阶段：家常菜反向挑选 + 座位补偿
    game.js          boardgame.io 游戏定义：setup、阶段、回合顺序、终局
    testing.js       测试辅助函数
    *.test.js        Vitest 测试
  board/             React 界面（同屏和联网共用）
  online.js          联网大厅：连服务器、带密码建房 / 加入、记住上一局
server/
  index.js           联网服务器（boardgame.io Server）
docs/
  proposal.md        策划案
```

## 设计约定

- **联网时每人只收到自己该看的**：牌堆顺序和别人摸的暗牌在 `playerView`（`game.js`）里藏掉。同屏模式（`G.hotseat`）不藏。
- **状态只存事实，不存推导值**：口碑和折扣每次从已购买的食谱和主厨实时算出来，见 `state.js`。
- **非法行动一律返回 `INVALID_MOVE`**，不改变任何状态。
- **调数值只改 `constants.js`**：每局开始时按人数取一份存进 `G.rules`，规则和界面都从这里读。改完跑 `npm run simulate` 看节奏和座位胜率有没有变坏。
- 代币键名：`sugar` 糖、`soy` 酱油、`chili` 辣椒、`peppercorn` 花椒、`vinegar` 醋、`stock` 高汤。

## 技术栈

[boardgame.io](https://boardgame.io) 0.50 · React 19 · Vite · Vitest · ESLint
