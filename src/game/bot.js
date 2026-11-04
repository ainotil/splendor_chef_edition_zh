// 电脑玩家：贪心机器人。单人模式和数值模拟（scripts/simulate.js）用的是同一个。
//
// botMove(G, ctx, id) 只看局面、不改局面，返回这位玩家现在要走的一步：
//   { move: 'takeThree', args: [['sugar', 'soy', 'chili']] }
//   { event: 'endTurn' }        什么都做不了（极少见）
//   null                        现在不需要这位玩家行动
//
// 策略（每个座位都一样）：
//   1. 买得起就买"价值"最高的一张（口碑 ×2 + 折扣本身 1 + 朝未到主厨条件推进 0.6）
//   2. 否则挑"价值 / (1 + 还差几个)"最高的一张做目标，拿它缺的颜色；缺的那色只差这一种且能拿 2 个就拿 2 个
//   3. 桌上一个需要的颜色都没有时预订目标（顺便拿高汤）
//   4. 冰箱超了先扔目标用不上的；同时满足多位主厨请第一位；偷味恶魔交手里最多的；撤菜换 3 级
// 它不会算计别人、不会故意卡牌。
import { COLORS } from './constants.js';
import { bonuses, payment, maxReserved, takeTwoMin, surcharge, eligibleChefs } from './state.js';

function missing(player, card) {
  const b = bonuses(player);
  const per = {};
  let total = 0;
  for (const c of COLORS) {
    per[c] = Math.max(0, (card.cost[c] ?? 0) - b[c] - player.tokens[c]);
    total += per[c];
  }
  return { per, total: Math.max(0, total - player.tokens.stock) };
}

function value(G, player, card) {
  const b = bonuses(player);
  const chefPush = G.chefs.some(ch => (ch.requires[card.bonus] ?? 0) > b[card.bonus]) ? 0.6 : 0;
  return card.points * 2 + 1 + chefPush;
}

function candidates(G, player) {
  const list = [];
  for (const tier of [1, 2, 3]) {
    G.market[tier].forEach((card, slot) => card && list.push({ card, where: 'market', tier, slot }));
  }
  player.reserved.forEach((card, index) => list.push({ card, where: 'reserved', index }));
  return list;
}

function pickTarget(G, player) {
  let best = null;
  for (const c of candidates(G, player)) {
    const m = missing(player, c.card);
    const s = value(G, player, c.card) / (1 + m.total);
    if (!best || s > best.s) best = { ...c, m, s };
  }
  return best;
}

const sum = cost => Object.values(cost).reduce((a, b) => a + b, 0);

// 开局：挑第一张还在的家常菜；补偿调味拿市场上最便宜的一级卡需要的颜色
function draftMove(G, ctx, id) {
  const seat = ctx.playOrder.indexOf(id);
  const index = G.starters.findIndex(Boolean);
  const need = G.rules.seatBonus[seat] ?? 0;
  const cheapest = [...G.market[1]].filter(Boolean).sort((a, b) => sum(a.cost) - sum(b.cost))[0];
  const colors = cheapest ? COLORS.filter(c => cheapest.cost[c]) : COLORS;
  const picks = Array.from({ length: need }, (_, i) => colors[i % colors.length]);
  return { move: 'pickStarter', args: [index, picks] };
}

// 正式回合：买 → 拿调味 → 预订
function turnMove(G, id) {
  const me = G.players[id];

  let buy = null;
  for (const c of candidates(G, me)) {
    if (!payment(me, c.card, surcharge(G, id))) continue;
    const v = value(G, me, c.card);
    if (!buy || v > buy.v) buy = { ...c, v };
  }
  if (buy) {
    return buy.where === 'market'
      ? { move: 'buy', args: [buy.tier, buy.slot] }
      : { move: 'buyReserved', args: [buy.index] };
  }

  const target = pickTarget(G, me);
  const available = COLORS.filter(c => G.bank[c] > 0);
  const wanted = COLORS.filter(c => target.m.per[c] > 0 && G.bank[c] > 0).sort((a, b) => target.m.per[b] - target.m.per[a]);

  if (wanted.length === 1 && target.m.per[wanted[0]] >= 2 && G.bank[wanted[0]] >= takeTwoMin(me)) {
    return { move: 'takeTwo', args: [wanted[0]] };
  }
  if (wanted.length > 0 || me.reserved.length >= maxReserved(me)) {
    const rest = available.filter(c => !wanted.includes(c)).sort((a, b) => G.bank[b] - G.bank[a]);
    const picks = [...wanted, ...rest].slice(0, Math.min(3, available.length));
    if (picks.length > 0) return { move: 'takeThree', args: [picks] };
  }

  if (me.reserved.length < maxReserved(me)) {
    return target.where === 'market'
      ? { move: 'reserve', args: [target.tier, target.slot] }
      : { move: 'reserveFromDeck', args: [3] };
  }
  return { event: 'endTurn' };
}

// 回合里的环节：弃牌 / 选主厨 / 撤菜
function stageMove(G, id, stage) {
  const me = G.players[id];
  if (stage === 'discard') {
    const target = pickTarget(G, me);
    const order = [...COLORS].filter(c => me.tokens[c] > 0)
      .sort((a, b) => (target.m.per[a] > 0) - (target.m.per[b] > 0) || me.tokens[b] - me.tokens[a]);
    return { move: 'discard', args: [order[0] ?? 'stock'] };
  }
  if (stage === 'chooseChef') return { move: 'chooseChef', args: [eligibleChefs(G, me)[0].id] };
  if (stage === 'clearRow') return { move: 'clearRow', args: [3] };   // 换掉最值钱的一行
  return null;
}

// 偷味恶魔：被偷时交出自己手里最多的调味
function giveMove(G, id) {
  const mine = G.players[id].tokens;
  const give = [...COLORS].filter(c => mine[c] > 0).sort((a, b) => mine[b] - mine[a])[0];
  return { move: 'giveToThief', args: [id, give] };
}

export function botMove(G, ctx, id) {
  if (ctx.gameover) return null;
  if (G.thief?.pending.includes(id)) return giveMove(G, id);
  if (ctx.currentPlayer !== id) return null;
  if (ctx.phase === 'draft') return draftMove(G, ctx, id);
  const stage = ctx.activePlayers?.[id];
  if (stage) return stageMove(G, id, stage);   // 偷味恶魔的主人在 thiefGive 环节里只是等
  return turnMove(G, id);
}

// 照着 botMove 的结果走一步。moves / events 是 boardgame.io 客户端上的
export function playBotMove(step, moves, events) {
  if (step.event) events[step.event]();
  else moves[step.move](...step.args);
}
