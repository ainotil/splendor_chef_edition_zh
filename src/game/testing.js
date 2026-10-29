import { Client } from 'boardgame.io/client';
import { ChefsTableNoDraft, setup } from './game.js';

// 测试用：同屏模式的游戏（不隐藏信息），可以直接看到牌堆
export function hotseat(game, seed = 'test') {
  return { ...game, seed, setup: (ctx) => game.setup(ctx, { hotseat: true }) };
}

// 测试用：跳过开局，先用 change(G) 改好桌面，再开一局 5 人同屏游戏
export function clientWith(change) {
  const game = {
    ...ChefsTableNoDraft,
    seed: 'test',
    setup: (ctx) => {
      const G = setup(ctx, { hotseat: true });
      change(G);
      return G;
    },
  };
  return Client({ game, numPlayers: 5 });
}
