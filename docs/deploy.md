# 上云说明书

网页放在 **GitHub Pages**，联网服务器放在 **Render** 免费方案，两边都不花钱，大约 15 分钟配完。

```
浏览器 ──打开网页──▶ GitHub Pages（静态网页，dist/）
   │
   └──建房 / 加入 / 每一步行动──▶ Render（boardgame.io 服务器，server/index.js）
```

- 网页打包时写死服务器地址（`VITE_SERVER_URL`）。没配地址的网页只有同屏模式。
- 服务器用 `API_SECRET` 当房间密码：建房、加入、查看房间都要带上，不知道密码的人进不来。
- 服务器只接受 `ALLOWED_ORIGINS` 里的网页连接。
- 除了 boardgame.io 自带的房间接口，`server/index.js` 还加了一个 `POST /games/chefs-table/:id/dissolve`：房主在人到齐前解散房间。它同样要带密码，并校验房主的凭证。

## 需要准备

- 一个 GitHub 账号，仓库已推送到 GitHub。
- 用同一个 GitHub 账号登录 [render.com](https://render.com)。

## 第 1 步：部署服务器（Render）

1. Render 后台选 **New → Blueprint**，选这个仓库。Render 会读根目录的 `render.yaml`。
2. 按提示填 `API_SECRET`：这就是房间密码，之后发给一起玩的朋友。不要写进仓库。
3. 等部署完成，记下服务器地址，例如 `https://chefs-table-server.onrender.com`。
4. 浏览器打开 `<服务器地址>/health`，看到 `ok` 就说明服务器在运行。

`render.yaml` 里的设置：

| 项 | 值 | 说明 |
| --- | --- | --- |
| `buildCommand` | `npm ci` | 装依赖 |
| `startCommand` | `npm run server` | 启动 `server/index.js` |
| `healthCheckPath` | `/health` | 不需要密码，也用来叫醒休眠的服务器 |
| `NODE_VERSION` | `24` | 和 `.nvmrc` 一致 |
| `API_SECRET` | 后台填写 | 房间密码；缺了服务器拒绝启动 |
| `ALLOWED_ORIGINS` | `https://ainotil.github.io` | 网页地址，逗号分隔可写多个；**换了 GitHub 用户名要改这里** |

## 第 2 步：部署网页（GitHub Pages）

1. 仓库 **Settings → Pages**，Source 选 **GitHub Actions**。
2. **Settings → Secrets and variables → Actions → Variables**，新建变量 `SERVER_URL`，值是第 1 步的服务器地址（末尾不要 `/`）。
3. 推送到 `main`（或在 Actions 页面手动运行 **Pages**）。`.github/workflows/pages.yml` 会测试、打包并发布。
4. 网页地址是 `https://<用户名>.github.io/<仓库名>/`。

打包时设置的两个环境变量：

| 变量 | 来源 | 作用 |
| --- | --- | --- |
| `VITE_BASE` | 仓库名，自动生成 | 网页挂在 `/<仓库名>/` 下 |
| `VITE_SERVER_URL` | 仓库变量 `SERVER_URL` | 联网服务器地址 |

## 第 3 步：试一局

1. 打开网页 → **进入联网大厅** → 输密码和名字 → 选人数 → **建房间**。
2. 用无痕窗口打开邀请链接，输同一个密码，选空座位。
3. 人齐自动开始。

## 免费方案的限制

- 服务器 15 分钟没人连就休眠，下次打开大厅要等半分钟左右。大厅一打开就会去叫醒它。
- 房间存在服务器内存里：休眠或重新部署时，进行中的对局会丢失。一局一般 1 小时内打完，问题不大；开局前先打开大厅把服务器叫醒即可。

需要对局不丢失时，有两个方向：换成不休眠的付费实例；或者给 boardgame.io 服务器接一个持久化存储（`Server({ db })`，例如 `bgio-postgres`），房间就能在重启后恢复。

## 常见问题

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| 首页没有“进入联网大厅” | 打包时没有 `SERVER_URL` | 检查仓库变量，重新运行 Pages workflow |
| 大厅提示“连不上服务器” | 服务器正在醒来，或地址写错 | 等半分钟再试；打开 `/health` 确认 |
| 提示“密码不对” | 和 Render 里的 `API_SECRET` 不一致 | 在 Render 后台核对 |
| 浏览器控制台报 CORS 错误 | 网页地址不在 `ALLOWED_ORIGINS` | 在 Render 后台或 `render.yaml` 里加上网页地址（只写到域名，不带路径） |
| 提示“没有这个房间” | 房间号写错，或服务器重启后房间没了 | 重新建房 |
| 网页打开是空白 | `VITE_BASE` 与仓库名不一致 | 用 workflow 打包，不要手动上传 `dist/` |

## 换别的平台

- **网页**：任何静态托管都行（Netlify、Vercel、Cloudflare Pages）。构建命令 `npm run build`，输出目录 `dist`，按需设置 `VITE_BASE` 和 `VITE_SERVER_URL`。
- **服务器**：任何能跑 Node 24 长连接（WebSocket）的平台都行（Railway、Fly.io、自己的 VPS）。启动命令 `npm run server`，设置 `API_SECRET`、`ALLOWED_ORIGINS`，端口读 `PORT`。不支持 WebSocket 的无服务器平台（如 Vercel Functions）不行。
