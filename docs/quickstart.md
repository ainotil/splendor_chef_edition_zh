# 快速开始

## 我只想玩

**联网版**（各自用自己的电脑）：

1. 打开网页地址（GitHub Pages，例如 `https://ainotil.github.io/splendor_chef_edition_zh/`）。
3. 点 **进入联网大厅**，输入房间密码（问开服的人要）和自己的名字。
4. 一个人选人数、点 **建房间**，把房间号或邀请链接发给其他人。
5. 其他人打开链接，输同一个密码和名字，选空座位。人齐自动开始。

第一次打开大厅可能要等半分钟：免费服务器没人用时会休眠。刷新页面会回到自己的座位。

**单人版**（和电脑玩）：首页选人数和自己的座位，点 **开始单人游戏**。其余座位由电脑接手，每步停顿不到 1 秒，让你看清它做了什么。电脑和数值模拟用的是同一个贪心机器人：会算账，但不会故意卡你的牌。

**同屏版**（一台电脑轮流玩）：首页选人数，点 **开始同屏游戏**。

**不会玩？** 游戏里点右上角的 **?**，有 8 步图文教程；完整规则见[规则说明书](rules.md)。

## 我想在自己电脑上跑

需要 [Node.js 24](https://nodejs.org)（版本写在 `.nvmrc`）。

```bash
git clone https://github.com/ainotil/splendor_chef_edition.git
cd splendor_chef_edition
npm install
npm run dev        # 打开终端里显示的地址，同屏试玩
```

本地试联网：

```bash
API_SECRET=随便一个密码 PORT=8765 npm run server        # 终端 1
VITE_SERVER_URL=http://localhost:8765 npm run dev       # 终端 2
```

然后开两个浏览器窗口（一个用无痕模式），各自进大厅、用同一个密码。

## 我想改规则或数值

| 想改什么 | 改哪里 | 改完跑什么 |
| --- | --- | --- |
| 按人数的数值（调料、高汤、冰箱、终局分、座位补偿） | `src/game/constants.js` 的 `RULES` | `npm run simulate` 看节奏和座位胜率 |
| 食谱名字 | `src/game/data/recipes.js` | `npm test` |
| 主厨条件、说明文字 | `src/game/data/chefs.js` | `npm test` |
| 天使的持续技能 | `src/game/state.js`（`fridgeLimit`、`maxReserved` 等） | `npm test` |
| 恶魔 / 到来时的效果 | `src/game/skills.js` | `npm test` |
| 四种行动、付款 | `src/game/moves.js`、`state.js` 的 `payment` | `npm test` |
| 电脑玩家的策略 | `src/game/bot.js`（模拟脚本也用它） | `npm test`，再 `npm run simulate` 看数据有没有变 |
| 新手教程文字 | `src/board/Help.jsx` | `npm run dev` 看一眼 |

提交前跑一次 `npm run check`（lint + 测试 + 打包），和 CI 跑的一样。

改了规则，记得同时改[规则说明书](rules.md)和教程。

## 我想自己开服

见[上云说明书](deploy.md)。全部用免费方案，大约 15 分钟。
