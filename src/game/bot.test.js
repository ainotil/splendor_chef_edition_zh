import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { ChefsTable, setup } from './game.js';
import { botMove, playBotMove } from './bot.js';
import { clientWith } from './testing.js';

// 单人模式的一局：viewer 坐 1 号位，其余座位是电脑
function soloClient(numPlayers, seed = 'bot') {
  const ai = Array.from({ length: numPlayers }, (_, i) => String(i)).filter(id => id !== '0');
  const game = { ...ChefsTable, seed, setup: (ctx) => setup(ctx, { hotseat: true, ai, viewer: '0' }) };
  const client = Client({ game, numPlayers });
  client.start();
  return client;
}

// 让所有座位都由电脑走，直到结束（或走了 limit 步）
function autoplay(client, ids, limit = 5000) {
  for (let i = 0; i < limit; i++) {
    const { G, ctx } = client.getState();
    if (ctx.gameover) return i;
    const id = ids.find(id => botMove(G, ctx, id));
    if (id === undefined) throw new Error(`没人能走：${ctx.phase} ${JSON.stringify(ctx.activePlayers)}`);
    playBotMove(botMove(G, ctx, id), client.moves, client.events);
  }
  return limit;
}

describe('电脑玩家', () => {
  it('单人模式记下电脑座位和真人视角', () => {
    const { G } = soloClient(3).getState();
    expect(G.ai).toEqual(['1', '2']);
    expect(G.viewer).toBe('0');
  });

  it('联网和同屏模式没有电脑', () => {
    const client = Client({ game: ChefsTable, numPlayers: 3 });
    client.start();
    expect(client.getState().G.ai).toEqual([]);
  });

  it('不是自己的回合时不行动', () => {
    const client = soloClient(3);
    const { G, ctx } = client.getState();
    // 开局从最后一个座位开始挑
    expect(botMove(G, ctx, '2')).toMatchObject({ move: 'pickStarter' });
    expect(botMove(G, ctx, '1')).toBeNull();
    expect(botMove(G, ctx, '0')).toBeNull();
  });

  it('开局挑家常菜时拿够座位补偿', () => {
    const client = soloClient(5);
    const { G, ctx } = client.getState();
    const step = botMove(G, ctx, '4');
    expect(step.args[1]).toHaveLength(2);   // 5 号位补 2 个
  });

  it('偷味恶魔：被偷的电脑交出手里最多的调味', () => {
    const client = clientWith(G => {
      G.thief = { by: '0', pending: ['1'] };
      G.players['1'].tokens.soy = 3;
      G.players['1'].tokens.sugar = 1;
    });
    const { G, ctx } = client.getState();
    expect(botMove(G, ctx, '1')).toEqual({ move: 'giveToThief', args: ['1', 'soy'] });
  });

  for (const n of [2, 3, 4, 5]) {
    it(`${n} 人局全由电脑走能打完，每一步都合法`, () => {
      const client = soloClient(n, `bot-${n}`);
      const ids = client.getState().ctx.playOrder;
      const steps = autoplay(client, ids);
      const { ctx } = client.getState();
      expect(ctx.gameover).toBeTruthy();
      expect(steps).toBeLessThan(5000);
    });
  }
});
