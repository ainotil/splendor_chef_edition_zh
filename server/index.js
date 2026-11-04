// 联网对战服务器：boardgame.io 自带的服务器，负责保存每局状态、校验每一步、广播给所有人。
//
// 环境变量：
//   API_SECRET       房间密码。建房、加入、查看房间都要在请求头 api-secret 里带上它（boardgame.io 自带的检查）
//   ALLOWED_ORIGINS  允许连接的网页地址，逗号分隔，例如 https://ainotil.github.io
//   PORT             端口，Render 会自动设置；本地默认 8000
//
// 本地运行：API_SECRET=xxx npm run server
import { Server, Origins } from 'boardgame.io/server';
import { ChefsTable } from '../src/game/game.js';

if (!process.env.API_SECRET) {
  console.error('缺少 API_SECRET（房间密码）。没有它任何人都能建房间，服务器拒绝启动。');
  process.exit(1);
}

const origins = [
  ...(process.env.ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean),
  Origins.LOCALHOST_IN_DEVELOPMENT,
];

const server = Server({ games: [ChefsTable], origins });

// Render 的健康检查和"叫醒"用：不需要密码，只回一个 ok。
// 要在 run() 之前加：boardgame.io 的密码检查是 run() 时才挂上的，这样 /health 走在它前面
server.app.use(async (ctx, next) => {
  if (ctx.path === '/health') { ctx.body = 'ok'; return; }
  await next();
});

// 房主（1 号位）解散还在等人的房间：整个房间删掉，其他人的等候室查不到房间就会回首页。
// boardgame.io 只有"离开"（让出自己的座位），没有"解散"。挂在它的 router 上，
// 这样和自带接口一样要过 CORS 和 api-secret 检查（run() 时才挂上，所以要在 run() 之前加）
server.router.post('/games/:name/:id/dissolve', async (ctx) => {
  const { playerID, credentials } = await readJson(ctx.req);
  const matchID = ctx.params.id;
  const { metadata } = await server.db.fetch(matchID, { metadata: true });
  if (!metadata) ctx.throw(404, '没有这个房间');
  if (playerID !== '0') ctx.throw(403, '只有房主能解散房间');
  if (!(await server.auth.authenticateCredentials({ playerID, credentials, metadata }))) ctx.throw(403, '凭证不对');
  if (Object.values(metadata.players).every(p => p.name)) ctx.throw(409, '人已到齐，游戏已经开始，不能解散');
  await server.db.wipe(matchID);
  ctx.body = {};
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    let text = '';
    req.on('data', chunk => { text += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(text || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const port = Number(process.env.PORT ?? 8000);
server.run(port, () => console.log(`主厨餐桌服务器已启动：端口 ${port}，允许的网页：${origins.join(', ')}`));
