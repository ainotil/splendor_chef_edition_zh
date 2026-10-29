import { describe, it, expect } from 'vitest';
import { clientWith } from './testing.js';
import { payment, emptyTokens } from './state.js';

// 做一个假玩家：tokens 只写需要的，其余为 0
function player({ tokens = {}, bonus = [] } = {}) {
  return {
    tokens: { ...emptyTokens(), ...tokens },
    cards: bonus.map(b => ({ bonus: b, points: 0 })),
    reserved: [],
    chefs: [],
  };
}

const mapo = { id: 'T2', tier: 2, bonus: 'peppercorn', points: 2, cost: { soy: 3, chili: 2 } };
const duck = { id: 'T3', tier: 3, bonus: 'soy', points: 4, cost: { sugar: 3 } };

describe('payment（纯计算）', () => {
  it('调味刚好够', () => {
    const p = player({ tokens: { soy: 3, chili: 2 } });
    expect(payment(p, mapo)).toMatchObject({ soy: 3, chili: 2, stock: 0 });
  });

  it('折扣减少要付的数量', () => {
    const p = player({ tokens: { soy: 3, chili: 2 }, bonus: ['soy', 'soy', 'chili'] });
    expect(payment(p, mapo)).toMatchObject({ soy: 1, chili: 1, stock: 0 });
  });

  it('不够的用高汤补', () => {
    const p = player({ tokens: { soy: 2, chili: 1, stock: 2 } });
    expect(payment(p, mapo)).toMatchObject({ soy: 2, chili: 1, stock: 2 });
  });

  it('高汤也不够就付不起', () => {
    const p = player({ tokens: { soy: 2, chili: 1, stock: 1 } });
    expect(payment(p, mapo)).toBeNull();
  });

  it('多出来的调味不会被付掉', () => {
    const p = player({ tokens: { soy: 5, chili: 4, vinegar: 3, stock: 2 } });
    expect(payment(p, mapo)).toMatchObject({ soy: 3, chili: 2, vinegar: 0, stock: 0 });
  });

  it('三级菜和其他菜一样付：折扣全抵掉就免费', () => {
    const p = player({ bonus: ['sugar', 'sugar', 'sugar'] });
    expect(payment(p, duck)).toMatchObject({ sugar: 0, stock: 0 });
  });

  it('三级菜差的部分用高汤补，不用额外多付', () => {
    const p = player({ tokens: { sugar: 1, stock: 2 }, bonus: ['sugar'] });
    expect(payment(p, duck)).toMatchObject({ sugar: 1, stock: 1 });
  });

  it('二级菜全抵掉可以免费买', () => {
    const p = player({ bonus: ['soy', 'soy', 'soy', 'chili', 'chili'] });
    expect(payment(p, mapo)).toMatchObject({ soy: 0, chili: 0, stock: 0 });
  });
});

// 用固定的 G 开局，方便构造"手里有什么、市场有什么"

describe('buy（行动）', () => {
  it('买市场的牌：付款退回桌上、食谱到面前、市场补牌', () => {
    const client = clientWith(G => {
      G.market[2][0] = mapo;
      G.players['0'].tokens.soy = 3;
      G.players['0'].tokens.chili = 2;
      G.bank.soy -= 3;
      G.bank.chili -= 2;
    });
    const topOfDeck = client.getState().G.decks[2][0];

    client.moves.buy(2, 0);
    const { G, ctx } = client.getState();
    const me = G.players['0'];

    expect(me.cards.map(c => c.id)).toEqual(['T2']);
    expect(me.tokens.soy).toBe(0);
    expect(G.bank.soy).toBe(10);
    expect(G.bank.chili).toBe(10);
    expect(G.market[2][0].id).toBe(topOfDeck.id);
    expect(ctx.currentPlayer).toBe('1');
  });

  it('付不起就拒绝，什么都不变', () => {
    const client = clientWith(G => { G.market[2][0] = mapo; });
    client.moves.buy(2, 0);
    const { G, ctx } = client.getState();

    expect(G.players['0'].cards).toHaveLength(0);
    expect(G.market[2][0].id).toBe('T2');
    expect(ctx.currentPlayer).toBe('0');
  });

  it('买自己预订的牌：从手里移走，市场不变', () => {
    const client = clientWith(G => {
      G.players['0'].reserved = [duck];
      G.players['0'].tokens.sugar = 3;
      G.bank.sugar -= 3;
    });
    const marketBefore = client.getState().G.market[3].map(c => c.id);

    client.moves.buyReserved(0);
    const { G } = client.getState();
    const me = G.players['0'];

    expect(me.cards.map(c => c.id)).toEqual(['T3']);
    expect(me.reserved).toHaveLength(0);
    expect(G.bank.sugar).toBe(10);
    expect(G.market[3].map(c => c.id)).toEqual(marketBefore);
  });

  it('用高汤补差额，高汤退回桌上', () => {
    const client = clientWith(G => {
      G.market[2][0] = mapo;
      Object.assign(G.players['0'].tokens, { soy: 3, chili: 1, stock: 1 });
      G.bank.soy -= 3; G.bank.chili -= 1; G.bank.stock -= 1;
    });
    client.moves.buy(2, 0);
    const { G } = client.getState();

    expect(G.players['0'].tokens.stock).toBe(0);
    expect(G.bank.stock).toBe(7);
  });

  it('预订位置不存在就拒绝', () => {
    const client = clientWith(() => {});
    client.moves.buyReserved(0);
    expect(client.getState().ctx.currentPlayer).toBe('0');
  });

  it('买三级菜：折扣全抵掉时什么都不用付，手里的调味不动', () => {
    const roast = { id: 'R', tier: 3, bonus: 'soy', points: 4, cost: { sugar: 3, chili: 3 } };
    const client = clientWith(G => {
      G.market[3][0] = roast;
      G.players['0'].cards = ['sugar', 'sugar', 'sugar', 'chili', 'chili', 'chili']
        .map((b, i) => ({ id: 'B' + i, bonus: b, points: 0 }));
      Object.assign(G.players['0'].tokens, { sugar: 2, chili: 2 });
      G.bank.sugar -= 2; G.bank.chili -= 2;
    });
    client.moves.buy(3, 0);
    const { G } = client.getState();

    expect(G.players['0'].cards.map(c => c.id)).toContain('R');
    expect(G.players['0'].tokens).toMatchObject({ sugar: 2, chili: 2 });
    expect(G.bank.sugar).toBe(8);
  });
});