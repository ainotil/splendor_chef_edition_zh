import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import { ChefsTableNoDraft, setup } from './game.js';
import { CHEFS } from './data/chefs.js';

// 联网模式（非同屏）：每位玩家一个客户端，状态经过 playerView 过滤
function table(change = () => {}, numPlayers = 3) {
  const game = {
    ...ChefsTableNoDraft,
    seed: 'online',
    setup: (ctx) => { const G = setup(ctx); change(G); return G; },
  };
  const multiplayer = Local();
  const clients = Array.from({ length: numPlayers }, (_, i) =>
    Client({ game, numPlayers, multiplayer, playerID: String(i) }));
  clients.forEach(c => c.start());
  return clients;
}

const chef = id => CHEFS.find(c => c.id === id);

describe('联网：每人只看到自己该看的', () => {
  it('牌堆只给张数，看不到是哪张', () => {
    const [p0] = table();
    const { decks } = p0.getState().G;
    expect(decks[1].length).toBeGreaterThan(0);
    expect(decks[1].every(c => c === null)).toBe(true);
  });

  it('别人摸的暗牌只看得到等级；自己的看得到全部', () => {
    const [p0, p1] = table();
    p0.moves.reserveFromDeck(3);

    const mine = p0.getState().G.players['0'].reserved[0];
    expect(mine.name).toBeTruthy();
    expect(mine.cost).toBeTruthy();

    const seenByOther = p1.getState().G.players['0'].reserved[0];
    expect(seenByOther).toEqual({ id: mine.id, tier: 3, blind: true });
  });

  it('从市场预订的明牌，别人也看得到', () => {
    const [p0, p1] = table();
    p0.moves.reserve(1, 0);
    expect(p1.getState().G.players['0'].reserved[0].cost).toBeTruthy();
  });
});

describe('联网：偷味恶魔由被偷的人自己选', () => {
  function thiefTable() {
    return table(G => {
      G.chefs = [chef('devil-thief')];
      G.players['0'].cards = ['soy', 'soy', 'soy', 'chili', 'chili', 'chili']
        .map((b, i) => ({ id: 'C' + i, tier: 1, bonus: b, points: 0, cost: {} }));
      for (const id of ['1', '2']) { G.players[id].tokens.sugar = 1; G.bank.sugar -= 1; }
    });
  }

  it('小偷不能替别人选；被偷的人在自己的客户端上交', () => {
    const [p0, p1, p2] = thiefTable();
    p0.moves.takeTwo('peppercorn');
    p0.moves.chooseChef('devil-thief');

    p0.moves.giveToThief('1', 'sugar');            // 小偷替 1 号交：不行
    expect(p0.getState().G.thief.pending).toEqual(['1', '2']);

    p1.moves.giveToThief('2', 'sugar');            // 1 号替 2 号交：也不行
    expect(p0.getState().G.thief.pending).toEqual(['1', '2']);

    p1.moves.giveToThief('1', 'sugar');
    p2.moves.giveToThief('2', 'sugar');
    const { G, ctx } = p0.getState();
    expect(G.players['0'].tokens.sugar).toBe(2);
    expect(G.thief).toBeNull();
    expect(ctx.currentPlayer).toBe('1');
  });
});
