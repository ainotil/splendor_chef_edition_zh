import { describe, it, expect } from 'vitest';
import { clientWith } from './testing.js';
import { CHEFS } from './data/chefs.js';
import { payment } from './state.js';

const chef = id => CHEFS.find(c => c.id === id);

// 给玩家一些已购买的食谱（只关心折扣颜色和口碑）
function giveCards(G, id, colors, points = 0) {
  G.players[id].cards = colors.map((b, i) => ({ id: `${id}-C${i}`, tier: 1, bonus: b, points, cost: {} }));
}
function giveTokens(G, id, tokens) {
  for (const [t, n] of Object.entries(tokens)) {
    G.players[id].tokens[t] += n;
    G.bank[t] -= n;
  }
}
const card = (id, cost, tier = 1) => ({ id, tier, bonus: 'soy', points: 0, cost });

describe('天使：持续生效', () => {
  it('甜点天使：冰箱容量 +2，10 个也不用扔', () => {
    const client = clientWith(G => {
      G.players['0'].chefs = [chef('angel-dessert')];
      giveTokens(G, '0', { sugar: 4, soy: 3 });   // 7 个
    });
    client.moves.takeThree(['chili', 'peppercorn', 'vinegar']);   // 10 个
    const { ctx } = client.getState();
    expect(ctx.activePlayers).toBeNull();
    expect(ctx.currentPlayer).toBe('1');
  });

  it('甜点天使：超过 10 个还是要扔', () => {
    const client = clientWith(G => {
      G.players['0'].chefs = [chef('angel-dessert')];
      giveTokens(G, '0', { sugar: 4, soy: 4 });   // 8 个
    });
    client.moves.takeThree(['chili', 'peppercorn', 'vinegar']);   // 11 个
    expect(client.getState().ctx.activePlayers).toEqual({ '0': 'discard' });
  });

  it('汤品天使：预订时拿 2 个高汤', () => {
    const client = clientWith(G => { G.players['0'].chefs = [chef('angel-soup')]; });
    client.moves.reserve(1, 0);
    const { G } = client.getState();
    expect(G.players['0'].tokens.stock).toBe(2);
    expect(G.bank.stock).toBe(5);
  });

  it('汤品天使：桌上只剩 1 个高汤就只拿 1 个', () => {
    const client = clientWith(G => { G.players['0'].chefs = [chef('angel-soup')]; G.bank.stock = 1; });
    client.moves.reserve(1, 0);
    expect(client.getState().G.players['0'].tokens.stock).toBe(1);
  });

  it('慢炖天使：该色剩 3 个也能拿 2 个；没有天使不行', () => {
    const withStew = clientWith(G => { G.players['0'].chefs = [chef('angel-stew')]; G.bank.soy = 3; });
    withStew.moves.takeTwo('soy');
    expect(withStew.getState().G.players['0'].tokens.soy).toBe(2);

    const without = clientWith(G => { G.bank.soy = 3; });
    without.moves.takeTwo('soy');
    expect(without.getState().G.players['0'].tokens.soy).toBe(0);
  });

  it('万味天使：请来时从桌上拿 2 个高汤', () => {
    const client = clientWith(G => {
      G.chefs = [chef('angel-umami')];
      giveCards(G, '0', ['sugar', 'sugar', 'chili', 'chili', 'vinegar', 'vinegar']);
    });
    client.moves.takeTwo('soy');
    client.moves.chooseChef('angel-umami');
    const { G, ctx } = client.getState();
    expect(G.players['0'].tokens.stock).toBe(2);
    expect(G.bank.stock).toBe(5);
    expect(ctx.currentPlayer).toBe('1');
  });

  it('万味天使：桌上只剩 1 个高汤就只拿 1 个', () => {
    const client = clientWith(G => {
      G.chefs = [chef('angel-umami')];
      G.bank.stock = 1;
      giveCards(G, '0', ['sugar', 'sugar', 'chili', 'chili', 'vinegar', 'vinegar']);
    });
    client.moves.takeTwo('soy');
    client.moves.chooseChef('angel-umami');
    expect(client.getState().G.players['0'].tokens.stock).toBe(1);
  });

  it('万味天使：拿到的高汤让冰箱超了，要先扔', () => {
    const client = clientWith(G => {
      G.chefs = [chef('angel-umami')];
      giveCards(G, '0', ['sugar', 'sugar', 'chili', 'chili', 'vinegar', 'vinegar']);
      giveTokens(G, '0', { sugar: 6 });
    });
    client.moves.takeTwo('soy');                   // 8 个
    client.moves.chooseChef('angel-umami');        // 10 个
    expect(client.getState().ctx.activePlayers).toEqual({ '0': 'discard' });
  });

  it('万味天使：买食谱时不再能把调味当任意调味用', () => {
    const player = { tokens: { sugar: 2, soy: 0, chili: 1, peppercorn: 0, vinegar: 0, stock: 0 }, cards: [], reserved: [], chefs: [chef('angel-umami')] };
    expect(payment(player, card('X', { sugar: 3 }))).toBeNull();
  });

  it('备菜天使：可以预订第 4 张，第 5 张不行', () => {
    const client = clientWith(G => {
      G.players['0'].chefs = [chef('angel-prep')];
      G.players['0'].reserved = [card('R1', {}), card('R2', {}), card('R3', {})];
    });
    client.moves.reserve(1, 0);
    expect(client.getState().G.players['0'].reserved).toHaveLength(4);
  });
});

// 让玩家 0 满足某位恶魔的条件，桌上只放这一位；拿 2 个花椒后进入选主厨
function devilClient(devilId, colors, change = () => {}) {
  return clientWith(G => {
    G.chefs = [chef(devilId)];
    giveCards(G, '0', colors);
    change(G);
  });
}

describe('恶魔：到来时一次性生效', () => {
  it('偷味恶魔：其他人各自选 1 个调味交出来，交完结束回合', () => {
    const client = devilClient('devil-thief', ['soy', 'soy', 'soy', 'chili', 'chili', 'chili'], G => {
      giveTokens(G, '1', { sugar: 1 });
      giveTokens(G, '2', { soy: 2 });
      giveTokens(G, '3', { stock: 1 });          // 只有高汤：不用交
    });
    client.moves.takeTwo('peppercorn');
    client.moves.chooseChef('devil-thief');
    let { G, ctx } = client.getState();
    expect(ctx.activePlayers).toEqual({ '0': 'thiefGive', '1': 'thiefGive', '2': 'thiefGive' });
    expect(G.thief.pending).toEqual(['1', '2']);

    client.moves.giveToThief('1', 'stock');      // 高汤不算调味
    client.moves.giveToThief('1', 'soy');        // 手里没有
    expect(client.getState().G.thief.pending).toEqual(['1', '2']);

    client.moves.giveToThief('1', 'sugar');
    client.moves.giveToThief('2', 'soy');
    ({ G, ctx } = client.getState());
    expect(G.players['0'].tokens).toMatchObject({ sugar: 1, soy: 1, peppercorn: 2 });
    expect(G.players['2'].tokens.soy).toBe(1);
    expect(G.thief).toBeNull();
    expect(ctx.currentPlayer).toBe('1');
  });

  it('偷味恶魔：偷完冰箱超了要先弃牌，而且这回合不会再来第 2 位主厨', () => {
    const client = devilClient('devil-thief', ['soy', 'soy', 'soy', 'chili', 'chili', 'chili', 'sugar', 'sugar', 'sugar', 'vinegar', 'vinegar', 'vinegar'], G => {
      G.chefs.push(chef('angel-dessert'));        // 也满足甜点天使
      giveTokens(G, '0', { sugar: 6 });
      for (const id of ['1', '2', '3', '4']) giveTokens(G, id, { chili: 1 });
    });
    client.moves.takeTwo('peppercorn');          // 8 个
    client.moves.chooseChef('devil-thief');
    for (const id of ['1', '2', '3', '4']) client.moves.giveToThief(id, 'chili');   // 12 个
    expect(client.getState().ctx.activePlayers).toEqual({ '0': 'discard' });

    for (let i = 0; i < 4; i++) client.moves.discard('chili');
    const { G, ctx } = client.getState();
    expect(ctx.currentPlayer).toBe('1');
    expect(G.chefs.map(c => c.id)).toEqual(['angel-dessert']);   // 没有再弹出选主厨
  });

  it('打翻锅恶魔：其他人各扔 1 个高汤，没有的不受影响', () => {
    const client = devilClient('devil-spill', ['soy', 'soy', 'peppercorn', 'peppercorn', 'vinegar', 'vinegar'], G => {
      giveTokens(G, '1', { stock: 2 });
      giveTokens(G, '2', { stock: 1 });
    });
    client.moves.takeTwo('sugar');
    client.moves.chooseChef('devil-spill');
    const { G, ctx } = client.getState();
    expect(G.players['1'].tokens.stock).toBe(1);
    expect(G.players['2'].tokens.stock).toBe(0);
    expect(G.bank.stock).toBe(6);
    expect(G.lastEvent.text).toContain('打翻锅恶魔');
    expect(ctx.currentPlayer).toBe('1');
  });

  it('抢单恶魔：从口碑最高的对手预订里拿 1 张', () => {
    const client = devilClient('devil-snatch', ['sugar', 'sugar', 'sugar', 'chili', 'chili', 'chili'], G => {
      giveCards(G, '3', ['soy'], 5);              // 3 号座位口碑最高
      G.players['3'].reserved = [card('S1', {}), card('S2', {})];
      G.players['1'].reserved = [card('S3', {})];
    });
    client.moves.takeTwo('peppercorn');
    client.moves.chooseChef('devil-snatch');
    const { G } = client.getState();
    expect(G.players['0'].reserved).toHaveLength(1);
    expect(['S1', 'S2']).toContain(G.players['0'].reserved[0].id);
    expect(G.players['3'].reserved).toHaveLength(1);
    expect(G.players['1'].reserved).toHaveLength(1);
  });

  it('抢单恶魔：自己预订满了就没有效果', () => {
    const client = devilClient('devil-snatch', ['sugar', 'sugar', 'sugar', 'chili', 'chili', 'chili'], G => {
      G.players['0'].reserved = [card('R1', {}), card('R2', {}), card('R3', {})];
      giveCards(G, '3', ['soy'], 5);
      G.players['3'].reserved = [card('S1', {})];
    });
    client.moves.takeTwo('peppercorn');
    client.moves.chooseChef('devil-snatch');
    expect(client.getState().G.players['3'].reserved).toHaveLength(1);
  });

  it('涨价恶魔：其他人买食谱多付 1 个，持续两轮，到它主人第 2 个回合开始时取消', () => {
    const client = devilClient('devil-price', ['peppercorn', 'peppercorn', 'peppercorn', 'vinegar', 'vinegar', 'vinegar'], G => {
      G.market[1][0] = card('X', { sugar: 2 });
      giveTokens(G, '1', { sugar: 2 });           // 刚好够原价
    });
    client.moves.takeTwo('soy');
    client.moves.chooseChef('devil-price');
    expect(client.getState().G.priceHike).toEqual({ by: '0', roundsLeft: 2 });

    client.moves.buy(1, 0);                        // 玩家 1：差 1 个，买不了
    expect(client.getState().G.players['1'].cards).toHaveLength(0);

    client.moves.takeTwo('chili');                 // 玩家 1
    for (const c of ['peppercorn', 'vinegar', 'sugar']) client.moves.takeTwo(c);   // 玩家 2–4
    expect(client.getState().ctx.currentPlayer).toBe('0');
    expect(client.getState().G.priceHike).toEqual({ by: '0', roundsLeft: 1 });   // 第一轮过去，还在

    client.moves.takeTwo('soy');                   // 玩家 0
    client.moves.buy(1, 0);                        // 玩家 1：第二轮手里有 2 糖 + 2 辣椒，买得起，但要多付 1 个
    const p1 = client.getState().G.players['1'];
    expect(p1.cards.map(c => c.id)).toEqual(['X']);
    expect(p1.tokens).toMatchObject({ sugar: 0, chili: 1 });
    for (const c of ['peppercorn', 'vinegar', 'sugar']) client.moves.takeTwo(c);   // 玩家 2–4
    expect(client.getState().ctx.currentPlayer).toBe('0');
    expect(client.getState().G.priceHike).toBeNull();                             // 两轮到期
  });

  it('涨价恶魔：多出来的那个可以付任意调味', () => {
    const client = devilClient('devil-price', ['peppercorn', 'peppercorn', 'peppercorn', 'vinegar', 'vinegar', 'vinegar'], G => {
      G.market[1][0] = card('X', { sugar: 2 });
      giveTokens(G, '1', { sugar: 2, chili: 1 });
    });
    client.moves.takeTwo('soy');
    client.moves.chooseChef('devil-price');
    client.moves.buy(1, 0);
    const { G } = client.getState();
    expect(G.players['1'].cards.map(c => c.id)).toEqual(['X']);
    expect(G.players['1'].tokens).toMatchObject({ sugar: 0, chili: 0 });
  });

  it('撤菜恶魔：选一个等级，那一行 4 张全部换新', () => {
    const client = devilClient('devil-clear', ['soy', 'soy', 'chili', 'chili', 'vinegar', 'vinegar']);
    const before = client.getState().G;
    const oldIds = before.market[2].map(c => c.id);
    const deckSize = before.decks[2].length;

    client.moves.takeTwo('sugar');
    client.moves.chooseChef('devil-clear');
    expect(client.getState().ctx.activePlayers).toEqual({ '0': 'clearRow' });
    client.moves.clearRow(4);                      // 没有 4 级
    client.moves.clearRow(2);

    const { G, ctx } = client.getState();
    expect(G.market[2].map(c => c.id).some(id => oldIds.includes(id))).toBe(false);
    expect(G.decks[2]).toHaveLength(deckSize - 4);
    expect(ctx.currentPlayer).toBe('1');
  });
});
