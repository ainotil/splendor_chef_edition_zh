import { COLORS, MAX_RESERVED, TAKE_TWO_MIN } from './constants.js'

// { sugar: 0, soy: 0, ..., stock: 0 }
export function emptyTokens() {
  const t = { stock: 0 };
  for (const c of COLORS) t[c] = 0;
  return t;
}

export function newPlayer() {
    return { tokens: emptyTokens(), cards: [], reserved:[], chefs: [] }
}

// Permanent discounts from purchased recipes: { sugar: 2, soy: 0, ... }
export function bonuses(player) {
  const b = {};
  for (const c of COLORS) b[c] = 0;
  for (const card of player.cards) b[card.bonus] += 1;
  return b;
}

// Score is calculated from cards + chefs, never stored.
export function score(player) {
  const fromCards = player.cards.reduce((sum, c) => sum + c.points, 0);
  const fromChefs = player.chefs.reduce((sum, c) => sum + c.points, 0);
  return fromCards + fromChefs;
}

// Total tokens held, for the fridge limit
export function tokenCount(player) {
  return Object.values(player.tokens).reduce((a, b) => a + b, 0);
}

// ---------- 天使：持续生效的被动技能 ----------

export function hasChef(player, chefId) {
  return player.chefs.some(c => c.id === chefId);
}

// 甜点天使：冰箱容量 +2
export function fridgeLimit(G, player) {
  return G.rules.fridge + (hasChef(player, 'angel-dessert') ? 2 : 0);
}

// 备菜天使：预订上限 3 → 4
export function maxReserved(player) {
  return MAX_RESERVED + (hasChef(player, 'angel-prep') ? 1 : 0);
}

// 慢炖天使：拿 2 个同色时，该色剩 ≥ 3 即可
export function takeTwoMin(player) {
  return hasChef(player, 'angel-stew') ? TAKE_TWO_MIN - 1 : TAKE_TWO_MIN;
}

// 涨价恶魔：到它的主人下回合开始前，其他人买食谱多付 1 个
export function surcharge(G, playerID) {
  return G.priceHike && G.priceHike.by !== playerID ? 1 : 0;
}

export function refill(G, tier, slot) {
  const next = G.decks[tier].shift();
  G.market[tier][slot] = next ?? null;
}

// 算出买 card 要付什么。付得起返回 { sugar: 1, ..., stock: 0 }，付不起返回 null。
// 规则：
// 1. 每种调味：需要 = 价格 − 折扣（最少 0）
// 2. 先用手里同色调味付，不够的部分用高汤补
// 3. extraCost：涨价恶魔要求多付的个数（任意调味或高汤，先用手里多余最多的调味）
export function payment(player, card, extraCost = 0) {
  const discount = bonuses(player);
  const pay = emptyTokens();
  let short = 0;

  for (const c of COLORS) {
    const need = Math.max(0, (card.cost[c] ?? 0) - discount[c]);
    pay[c] = Math.min(need, player.tokens[c]);
    short += need - pay[c];
  }
  if (short > player.tokens.stock) return null;
  pay.stock = short;

  return addSurcharge(player, pay, extraCost);
}

// 手里还剩得最多的调味（付完 pay 之后），没有就 null
function mostSpare(player, pay) {
  const spare = COLORS.filter(c => player.tokens[c] - pay[c] > 0)
    .sort((a, b) => (player.tokens[b] - pay[b]) - (player.tokens[a] - pay[a]));
  return spare[0] ?? null;
}

function addSurcharge(player, pay, n) {
  const result = { ...pay };
  for (let i = 0; i < n; i++) {
    const c = mostSpare(player, result);
    if (c) result[c] += 1;
    else if (player.tokens.stock - result.stock > 0) result.stock += 1;
    else return null;
  }
  return result;
}

export function eligibleChefs(G, player) {
  const b = bonuses(player);
  return G.chefs.filter(chef =>
    Object.entries(chef.requires).every(([c, n]) => b[c] >= n)
  );
}

// 终局排名：口碑高的在前；平局比食谱少的；再平局比恶魔少的
export function ranking(G) {
  return Object.entries(G.players)
    .map(([id, p]) => ({
      id,
      score: score(p),
      cards: p.cards.length,
      devils: p.chefs.filter(c => c.side === 'devil').length,
    }))
    .sort((a, b) =>
      b.score - a.score ||
      a.cards - b.cards ||
      a.devils - b.devils
    );
}

// 赢家：排第一的玩家；三项都相同就共同获胜
export function winners(G) {
  const [top, ...rest] = ranking(G);
  const same = p => p.score === top.score && p.cards === top.cards && p.devils === top.devils;
  return [top, ...rest.filter(same)].map(p => p.id);
}
