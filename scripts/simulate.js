// 数值模拟：用真实规则引擎，让同一个贪心机器人坐满每个座位，批量打完整局，统计节奏和公平指标。
//
// 用法：
//   npm run simulate                         默认：2–5 人局各 400 局，用 constants.js 里的数值
//   npm run simulate -- 3 1000               只跑 3 人局 1000 局
//   npm run simulate -- 2 400 '{"seasoning":5}'   覆盖部分数值做对比
//
// 机器人（每个座位都一样）：
//   1. 买得起就买"价值"最高的一张（口碑 ×2 + 折扣本身 1 + 朝未到主厨条件推进 0.6）
//   2. 否则挑"价值 / (1 + 还差几个)"最高的一张做目标，拿它缺的颜色；缺的那色只差这一种且桌上 ≥4 就拿 2 个
//   3. 桌上一个需要的颜色都没有时预订目标（顺便拿高汤）
//   4. 冰箱超了先扔目标用不上的；同时满足多位主厨选第一位
// 机器人不会算计别人、不会故意卡牌，所以结果只代表"同水平、不互相针对"的对局，用来比较不同数值的相对差别。
import { Client } from 'boardgame.io/client';
import { ChefsTable, setup } from '../src/game/game.js';
import { COLORS, rulesFor } from '../src/game/constants.js';
import { bonuses, payment, score, maxReserved, takeTwoMin, surcharge } from '../src/game/state.js';

const MAX_TURNS = 400;   // 保险：防止死局

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

// 一个回合：返回这回合有没有"没得拿"（想拿调味但桌上凑不出 3 种）
function playTurn(client, stats) {
  const { G, ctx } = client.getState();
  const id = ctx.currentPlayer;
  const me = G.players[id];

  // 1. 买
  let buy = null;
  for (const c of candidates(G, me)) {
    if (!payment(me, c.card, surcharge(G, id))) continue;
    const v = value(G, me, c.card);
    if (!buy || v > buy.v) buy = { ...c, v };
  }
  if (buy) {
    if (buy.where === 'market') client.moves.buy(buy.tier, buy.slot);
    else client.moves.buyReserved(buy.index);
    stats.bought(id, buy.card);
    return;
  }

  // 2. 拿调味
  const target = pickTarget(G, me);
  const available = COLORS.filter(c => G.bank[c] > 0);
  if (available.length < 3) stats.starved++;
  const wanted = COLORS.filter(c => target.m.per[c] > 0 && G.bank[c] > 0).sort((a, b) => target.m.per[b] - target.m.per[a]);

  if (wanted.length === 1 && target.m.per[wanted[0]] >= 2 && G.bank[wanted[0]] >= takeTwoMin(me)) {
    client.moves.takeTwo(wanted[0]);
    return;
  }
  if (wanted.length > 0 || me.reserved.length >= maxReserved(me)) {
    const rest = available.filter(c => !wanted.includes(c)).sort((a, b) => G.bank[b] - G.bank[a]);
    const picks = [...wanted, ...rest].slice(0, Math.min(3, available.length));
    if (picks.length > 0) { client.moves.takeThree(picks); return; }
  }

  // 3. 预订
  if (me.reserved.length < maxReserved(me)) {
    if (target.where === 'market') client.moves.reserve(target.tier, target.slot);
    else client.moves.reserveFromDeck(3);
    return;
  }
  stats.stuck++;
  client.events.endTurn();
}

function settleStages(client) {
  for (let guard = 0; guard < 30; guard++) {
    const { G, ctx } = client.getState();
    const id = ctx.currentPlayer;
    const stage = ctx.activePlayers?.[id];
    if (!stage) return;
    const me = G.players[id];
    if (stage === 'discard') {
      const target = pickTarget(G, me);
      const order = [...COLORS].filter(c => me.tokens[c] > 0)
        .sort((a, b) => (target.m.per[a] > 0) - (target.m.per[b] > 0) || me.tokens[b] - me.tokens[a]);
      client.moves.discard(order[0] ?? 'stock');
    } else if (stage === 'chooseChef') {
      const b = bonuses(me);
      const chef = G.chefs.find(ch => Object.entries(ch.requires).every(([c, n]) => b[c] >= n));
      client.moves.chooseChef(chef.id);
    } else if (stage === 'thiefGive') {
      // 被偷的人交出自己手里最多的调味
      const from = G.thief.pending[0];
      const give = [...COLORS].filter(c => G.players[from].tokens[c] > 0)
        .sort((a, b) => G.players[from].tokens[b] - G.players[from].tokens[a])[0];
      client.moves.giveToThief(from, give);
    } else if (stage === 'clearRow') {
      client.moves.clearRow(3);   // 换掉最值钱的一行
    }
  }
}

function draft(client) {
  for (let guard = 0; guard < 10; guard++) {
    const { G, ctx } = client.getState();
    if (ctx.phase !== 'draft') return;
    const id = ctx.currentPlayer;
    const seat = ctx.playOrder.indexOf(id);
    const index = G.starters.findIndex(Boolean);
    // 补偿调味：拿市场上最便宜的一级卡需要的颜色
    const need = G.rules.seatBonus[seat] ?? 0;
    const cheapest = [...G.market[1]].sort((a, b) => sum(a.cost) - sum(b.cost))[0];
    const colors = COLORS.filter(c => cheapest.cost[c]);
    const picks = Array.from({ length: need }, (_, i) => colors[i % colors.length]);
    client.moves.pickStarter(index, picks);
  }
}

const sum = cost => Object.values(cost).reduce((a, b) => a + b, 0);

export function playGame(numPlayers, seed, overrides = {}) {
  const game = {
    ...ChefsTable,
    seed,
    setup: (ctx) => setup(ctx, { rules: overrides, hotseat: true }),
  };
  const client = Client({ game, numPlayers });
  client.start();
  draft(client);

  const firstBuyTurn = {};
  const chefTurns = [];
  let turn = 0;
  const stats = {
    starved: 0,
    stuck: 0,
    bought(id) { if (firstBuyTurn[id] === undefined) firstBuyTurn[id] = Math.floor(turn / numPlayers) + 1; },
  };

  let chefsBefore = client.getState().G.chefs.length;
  while (!client.getState().ctx.gameover && turn < MAX_TURNS) {
    playTurn(client, stats);
    settleStages(client);
    const chefsNow = client.getState().G.chefs.length;
    if (chefsNow < chefsBefore) chefTurns.push(Math.floor(turn / numPlayers) + 1);
    chefsBefore = chefsNow;
    turn++;
  }

  const { G, ctx } = client.getState();
  client.stop();
  if (!ctx.gameover) return { unfinished: true };
  const scores = Object.values(G.players).map(score).sort((a, b) => b - a);
  const firstBuys = Object.values(firstBuyTurn);
  return {
    rounds: Math.ceil(turn / numPlayers),
    winners: ctx.gameover.winners.map(id => ctx.playOrder.indexOf(id)),
    gap: scores[0] - scores[1],
    top: scores[0],
    starved: stats.starved,
    stuck: stats.stuck,
    firstBuy: firstBuys.length ? firstBuys.reduce((a, b) => a + b, 0) / firstBuys.length : null,
    firstChef: chefTurns.length ? chefTurns[0] : null,
    chefsTaken: chefTurns.length,
  };
}

// seedPrefix：换一组随机种子（定数值用一组，复核用另一组，避免"挑到运气好的种子"）
export function simulate(numPlayers, games, overrides = {}, seedPrefix = 'sim') {
  const wins = Array(numPlayers).fill(0);
  const acc = { rounds: [], gap: [], top: [], starved: [], stuck: [], firstBuy: [], firstChef: [], chefsTaken: [] };
  let unfinished = 0;
  for (let i = 0; i < games; i++) {
    const r = playGame(numPlayers, `${seedPrefix}-${numPlayers}-${i}`, overrides);
    if (r.unfinished) { unfinished++; continue; }
    for (const s of r.winners) wins[s] += 1 / r.winners.length;
    for (const k of Object.keys(acc)) if (r[k] !== null) acc[k].push(r[k]);
  }
  const n = games - unfinished;
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
  return {
    numPlayers,
    rules: { ...rulesFor(numPlayers), ...overrides },
    games: n,
    unfinished,
    rounds: mean(acc.rounds), roundsP10: pct(acc.rounds, 0.1), roundsP90: pct(acc.rounds, 0.9),
    gap: mean(acc.gap), gapWithin3: acc.gap.filter(g => g <= 3).length / n,
    top: mean(acc.top),
    starvedPerGame: mean(acc.starved),
    stuckPerGame: mean(acc.stuck),
    firstBuyRound: mean(acc.firstBuy),
    firstChefRound: mean(acc.firstChef),
    chefsTaken: mean(acc.chefsTaken),
    seatWinRate: wins.map(w => w / n),
  };
}

// 直接运行时：打印结果
if (import.meta.url === `file://${process.argv[1]}`) {
  const counts = process.argv[2] ? [Number(process.argv[2])] : [2, 3, 4, 5];
  const games = Number(process.argv[3] ?? 400);
  const overrides = process.argv[4] ? JSON.parse(process.argv[4]) : {};
  for (const n of counts) {
    const r = simulate(n, games, overrides);
    const f = x => x.toFixed(2);
    console.log(`\n${n} 人局  ${JSON.stringify(r.rules)}`);
    console.log(`  完成 ${r.games} 局（未完成 ${r.unfinished}）`);
    console.log(`  回合数 平均 ${f(r.rounds)}（10%–90%：${r.roundsP10}–${r.roundsP90}）  冠军口碑 ${f(r.top)}`);
    console.log(`  第 1 与第 2 名分差 平均 ${f(r.gap)}，≤3 分的比例 ${(r.gapWithin3 * 100).toFixed(0)}%`);
    console.log(`  没得拿（桌上不足 3 色）每局 ${f(r.starvedPerGame)} 次   卡死 ${f(r.stuckPerGame)} 次`);
    console.log(`  第一次买菜 第 ${f(r.firstBuyRound)} 轮   第一位主厨 第 ${f(r.firstChefRound)} 轮   主厨被请走 ${f(r.chefsTaken)} 位`);
    console.log(`  座位胜率 ${r.seatWinRate.map((w, i) => `${i + 1}号 ${(w * 100).toFixed(1)}%`).join('  ')}`);
  }
}
