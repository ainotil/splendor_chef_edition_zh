import { describe, it, expect } from 'vitest';
import { Client } from 'boardgame.io/client';
import { ChefsTableNoDraft as ChefsTable } from './game.js';
import { hotseat } from './testing.js';
import { COLORS, RULES, rulesFor } from './constants.js';
import { RECIPES } from './data/recipes.js';
import { CHEFS } from './data/chefs.js';
import { bonuses, score, refill } from './state.js';

function newGame(seed = 'test') {
  const client = Client({ game: hotseat(ChefsTable, seed), numPlayers: 5 });
  return client.getState().G;
}

describe('data', () => {
  it('every recipe uses only known seasonings', () => {
    for (const r of RECIPES) {
      expect(COLORS).toContain(r.bonus);
      for (const c of Object.keys(r.cost)) expect(COLORS).toContain(c);
    }
  });

  it('every chef uses only known seasonings', () => {
    for (const chef of CHEFS) {
      for (const c of Object.keys(chef.requires)) expect(COLORS).toContain(c);
    }
  });
});

describe('setup', () => {
  it('fills the bank', () => {
    const G = newGame();
    expect(G.bank).toEqual({ stock: 7, sugar: 10, soy: 10, chili: 10, peppercorn: 10, vinegar: 10 });
  });

    it('deals 4 cards per tier, 5 starters from tier 1, rest stay in the decks', () => {
      const G = newGame();
      expect(G.starters).toHaveLength(5);
      expect(G.starters.every(c => c.tier === 1)).toBe(true);
      for (const [tier, total] of [[1, 40], [2, 30], [3, 20]]) {
        const starters = tier === 1 ? G.starters : [];
        expect(G.market[tier]).toHaveLength(4);
        expect(G.market[tier].length + G.decks[tier].length + starters.length).toBe(total);
        expect([...G.market[tier], ...G.decks[tier]].every(c => c.tier === tier)).toBe(true);
      }
    });

  it('picks 3 angels and 3 devils', () => {
    const G = newGame();
    expect(G.chefs.filter(c => c.side === 'angel')).toHaveLength(3);
    expect(G.chefs.filter(c => c.side === 'devil')).toHaveLength(3);
  });

  it('creates 5 empty players', () => {
    const G = newGame();
    expect(Object.keys(G.players)).toEqual(['0', '1', '2', '3', '4']);
    expect(G.players['0'].cards).toEqual([]);
    expect(G.players['0'].tokens).toEqual({ stock: 0, sugar: 0, soy: 0, chili: 0, peppercorn: 0, vinegar: 0 });
  });

  it('same seed gives the same shuffle, different seed does not', () => {
    const ids = G => G.market[1].map(c => c.id).join();
    expect(ids(newGame('a'))).toBe(ids(newGame('a')));
    expect(ids(newGame('a'))).not.toBe(ids(newGame('b')));
  });

  it('refill 从牌堆顶补到同一格，牌堆减少', () => {
    const G = {
      decks:  { 1: [{ id: 'A' }, { id: 'B' }] },
      market: { 1: [{ id: 'x' }, null, { id: 'y' }, { id: 'z' }] },
    };
    refill(G, 1, 1);

    expect(G.market[1][1].id).toBe('A');
    expect(G.decks[1].map(c => c.id)).toEqual(['B']);
  });

  it('牌堆空了就留空位 null', () => {
    const G = { decks: { 1: [] }, market: { 1: [{ id: 'x' }, { id: 'y' }] } };
    refill(G, 1, 0);

    expect(G.market[1][0]).toBeNull();
  });
  });

describe('helpers', () => {
  const player = {
    tokens: {}, reserved: [],
    cards: [{ bonus: 'sugar', points: 0 }, { bonus: 'sugar', points: 1 }, { bonus: 'chili', points: 2 }],
    chefs: [{ points: 3 }],
  };

  it('bonuses counts cards by seasoning', () => {
    expect(bonuses(player)).toEqual({ sugar: 2, soy: 0, chili: 1, peppercorn: 0, vinegar: 0 });
  });

  it('score adds cards and chefs', () => {
    expect(score(player)).toBe(6);
  });
});
describe('player count', () => {
  it.each([2, 3, 4, 5])('%i 人局：每人一张家常菜可选，玩家数正确', (numPlayers) => {
    const client = Client({ game: hotseat(ChefsTable), numPlayers });
    const { G } = client.getState();
    expect(Object.keys(G.players)).toHaveLength(numPlayers);
    expect(G.starters).toHaveLength(numPlayers);
  });

  it.each([2, 3, 4, 5])('%i 人局：桌面调味、高汤、主厨按人数摆放', (numPlayers) => {
    const rules = rulesFor(numPlayers);
    const { G } = Client({ game: hotseat(ChefsTable), numPlayers }).getState();
    expect(G.rules).toEqual(rules);
    for (const c of COLORS) expect(G.bank[c]).toBe(rules.seasoning);
    expect(G.bank.stock).toBe(rules.stock);
    expect(G.chefs.filter(c => c.side === 'angel')).toHaveLength(rules.chefs.angel);
    expect(G.chefs.filter(c => c.side === 'devil')).toHaveLength(rules.chefs.devil);
  });

  it('每种人数的数值都满足推导里的不变量', () => {
    for (const [n, r] of Object.entries(RULES).map(([n, r]) => [Number(n), r])) {
      expect(r.seasoning).toBe(2 * n);                         // 人均每色 2.0
      expect(5 * r.seasoning - n * r.fridge).toBe(2 * n);      // 冰箱塞满后桌面保底 20%
      expect(r.stock).toBe(n + 2);                             // 高汤 N + 2
      expect(r.chefs.angel + r.chefs.devil).toBe(n + 1);       // 主厨 N + 1
      expect(r.seatBonus).toHaveLength(n);
      expect(r.seatBonus).toHaveLength(n);
      expect(r.seatBonus[0]).toBe(0);                          // 先手不补偿
    }
  });

  it('不支持的人数直接报错', () => {
    expect(() => rulesFor(6)).toThrow();
  });
});
