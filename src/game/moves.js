import { INVALID_MOVE } from 'boardgame.io/core';
import { COLORS, MARKET_SIZE } from './constants.js';
import {
  refill, payment, tokenCount, eligibleChefs, score,
  fridgeLimit, maxReserved, takeTwoMin, surcharge, hasChef,
} from './state.js';

// ---------- 回合结束 ----------

// 每个行动成功后都调用：冰箱超了就先弃牌，否则直接进入回合收尾
// 恶魔效果结算完也走这里（偷来的调味可能让冰箱超）
function finishAction({ G, playerID, events }) {
  if (tokenCount(G.players[playerID]) > fridgeLimit(G, G.players[playerID])) {
    events.setActivePlayers({ currentPlayer: 'discard' });
  } else {
    endOfTurn({ G, playerID, events });
  }
}

// 回合收尾：检查主厨，然后结束回合
// 有满足条件的主厨：让玩家决定请哪位，或者不请；每回合最多 1 位
function endOfTurn({ G, playerID, events }) {
  if (!G.chefTakenThisTurn && eligibleChefs(G, G.players[playerID]).length > 0) {
    events.setActivePlayers({ currentPlayer: 'chooseChef' });
    return;   // 等玩家决定完再结束回合
  }
  events.endTurn();
}

function takeChef(G, playerID, chefId) {
  const index = G.chefs.findIndex(c => c.id === chefId);
  const [chef] = G.chefs.splice(index, 1);
  G.players[playerID].chefs.push(chef);
  G.chefTakenThisTurn = true;
  return chef;
}

// 记一条"刚刚发生了什么"，界面在状态栏里提示所有人
function announce(G, ctx, text) {
  G.lastEvent = { turn: ctx.turn, text };
}

const seatName = (ctx, id) => `${ctx.playOrder.indexOf(id) + 1} 号位`;

// ---------- 恶魔：到来时一次性生效 ----------
// 立即结算的直接改 G；要人做选择的进入一个环节，选完再收尾。返回 true = 进入了环节
function devilArrives({ G, ctx, playerID, events, random }, chef) {
  const others = ctx.playOrder.filter(id => id !== playerID);
  const me = G.players[playerID];

  switch (chef.id) {
    case 'devil-thief': {   // 其他每位玩家各交给你 1 个调味（由对方选）
      const pending = others.filter(id => COLORS.some(c => G.players[id].tokens[c] > 0));
      if (pending.length === 0) { announce(G, ctx, '偷味恶魔：其他人手里都没有调味，什么也没偷到'); return false; }
      G.thief = { by: playerID, pending };
      // 被偷的人在自己的设备上选；同屏时也可以都在当前这台上点
      const value = { [playerID]: 'thiefGive' };
      for (const id of pending) value[id] = 'thiefGive';
      events.setActivePlayers({ value });
      return true;
    }
    case 'devil-spill': {   // 其他所有玩家各弃 1 个高汤（没有则免）
      const hit = others.filter(id => G.players[id].tokens.stock > 0);
      for (const id of hit) { G.players[id].tokens.stock -= 1; G.bank.stock += 1; }
      announce(G, ctx, hit.length
        ? `打翻锅恶魔：${hit.map(id => seatName(ctx, id)).join('、')}各扔掉 1 个高汤`
        : '打翻锅恶魔：其他人都没有高汤，没有人受影响');
      return false;
    }
    case 'devil-snatch': {  // 从口碑最高的其他玩家预订区随机拿 1 张（自己的满了则无效）
      if (me.reserved.length >= maxReserved(me)) { announce(G, ctx, '抢单恶魔：你的预订已满，没有效果'); return false; }
      const top = Math.max(...others.map(id => score(G.players[id])));
      const leaders = random.Shuffle(others.filter(id => score(G.players[id]) === top));
      const victim = leaders[0];
      const theirs = G.players[victim].reserved;
      if (theirs.length === 0) { announce(G, ctx, `抢单恶魔：${seatName(ctx, victim)}没有预订，没抢到`); return false; }
      const [card] = theirs.splice(random.Die(theirs.length) - 1, 1);
      me.reserved.push(card);
      announce(G, ctx, `抢单恶魔：从${seatName(ctx, victim)}的预订里抢走了一张 ${card.tier} 级食谱`);
      return false;
    }
    case 'devil-price': {   // 持续两轮：到你之后第 2 个回合开始前，其他人买食谱多付 1 个
      G.priceHike = { by: playerID, roundsLeft: 2 };
      announce(G, ctx, `涨价恶魔：接下来两轮，除${seatName(ctx, playerID)}外，买食谱都要多付 1 个调料`);
      return false;
    }
    case 'devil-clear': {   // 选一个等级，把那一行 4 张食谱换掉
      events.setActivePlayers({ currentPlayer: 'clearRow' });
      return true;
    }
    default:
      return false;
  }
}

// 弃牌环节专用：一次扔掉 1 个调味或高汤，降到上限就进入回合收尾
export function discard({ G, playerID, events }, token) {
  const me = G.players[playerID];
  if (!(token in me.tokens) || me.tokens[token] < 1) return INVALID_MOVE;

  me.tokens[token] -= 1;
  G.bank[token] += 1;

  if (tokenCount(me) <= fridgeLimit(G, me)) endOfTurn({ G, playerID, events });
}

// 选主厨环节专用：从满足条件的主厨里选 1 位；恶魔到来时立即结算效果
export function chooseChef(context, chefId) {
  const { G, playerID } = context;
  const options = eligibleChefs(G, G.players[playerID]);
  if (!options.some(c => c.id === chefId)) return INVALID_MOVE;

  const chef = takeChef(G, playerID, chefId);
  if (chef.id === 'angel-umami') umamiArrives(context);
  if (chef.side === 'devil' && devilArrives(context, chef)) return;   // 等玩家在环节里选完
  finishAction(context);     // 拿到的高汤 / 偷来的调味可能让冰箱超
}

// 万味天使：到来时从桌上拿 2 个高汤（不够就有多少拿多少）
function umamiArrives({ G, ctx, playerID }) {
  const n = Math.min(2, G.bank.stock);
  G.bank.stock -= n;
  G.players[playerID].tokens.stock += n;
  announce(G, ctx, `万味天使：${seatName(ctx, playerID)}拿了 ${n} 个高汤`);
}

// 偷味恶魔环节：被偷的玩家 fromId 自己选 1 个调味交出去
// 联网时只能本人交（防止小偷替别人选）；同屏时大家用同一台电脑，谁点都行
export function giveToThief({ G, ctx, playerID, events }, fromId, color) {
  if (!G.thief?.pending.includes(fromId)) return INVALID_MOVE;
  if (!G.hotseat && playerID !== fromId) return INVALID_MOVE;
  if (!COLORS.includes(color)) return INVALID_MOVE;                // 高汤不算调味
  const from = G.players[fromId];
  if (from.tokens[color] < 1) return INVALID_MOVE;

  const thief = G.thief.by;
  from.tokens[color] -= 1;
  G.players[thief].tokens[color] += 1;
  G.thief.pending = G.thief.pending.filter(id => id !== fromId);
  if (G.thief.pending.length > 0) return;

  G.thief = null;
  announce(G, ctx, `偷味恶魔：${seatName(ctx, thief)}从其他人手里各拿了 1 个调味`);
  finishAction({ G, playerID: thief, events });
}

// 撤菜恶魔环节：选一个等级，把那一行 4 张弃掉，从牌堆重新翻开
export function clearRow({ G, ctx, playerID, events }, tier) {
  if (![1, 2, 3].includes(tier)) return INVALID_MOVE;
  for (let slot = 0; slot < MARKET_SIZE; slot++) refill(G, tier, slot);
  announce(G, ctx, `撤菜恶魔：${tier} 级食谱整行换了一遍`);
  finishAction({ G, playerID, events });
}

// 选主厨环节专用：这回合不请任何主厨（他们留在桌上，以后满足条件还可以请）
export function skipChef({ events }) {
  events.endTurn();
}

// 拿 1–3 个不同颜色的调味（不能拿高汤）
export function takeThree({ G, playerID, events }, colors) {
  if (!Array.isArray(colors)) return INVALID_MOVE;
  if (colors.length < 1 || colors.length > 3) return INVALID_MOVE;
  if (new Set(colors).size !== colors.length) return INVALID_MOVE;   // 不能重复
  if (!colors.every(c => COLORS.includes(c))) return INVALID_MOVE;   // 只能是 5 种调味
  if (colors.some(c => G.bank[c] < 1)) return INVALID_MOVE;          // 桌上要有

  // 规则：桌上有 3 种以上可拿时，必须拿满 3 个
  const available = COLORS.filter(c => G.bank[c] > 0).length;
  if (colors.length < Math.min(3, available)) return INVALID_MOVE;

  const me = G.players[playerID];
  for (const c of colors) {
    G.bank[c] -= 1;
    me.tokens[c] += 1;
  }
  finishAction({ G, playerID, events });
}

// 拿 2 个同色调味（该色桌上至少 4 个；慢炖天使 3 个）
export function takeTwo({ G, playerID, events }, color) {
  if (!COLORS.includes(color)) return INVALID_MOVE;
  if (G.bank[color] < takeTwoMin(G.players[playerID])) return INVALID_MOVE;

  G.bank[color] -= 2;
  G.players[playerID].tokens[color] += 2;
  finishAction({ G, playerID, events });
}

// 预订成功后的共同步骤：放进手里 + 拿 1 个高汤（如果桌上还有；汤品天使再多拿 1 个）
function takeIntoHand(G, me, card) {
  me.reserved.push(card);
  const stock = hasChef(me, 'angel-soup') ? 2 : 1;
  for (let i = 0; i < stock && G.bank.stock > 0; i++) {
    G.bank.stock -= 1;
    me.tokens.stock += 1;
  }
}

// 预订市场上的明牌：tier = 1/2/3，slot = 0–3
export function reserve({ G, playerID, events }, tier, slot) {
  const me = G.players[playerID];
  if (me.reserved.length >= maxReserved(me)) return INVALID_MOVE;   // 最多 3 张（备菜天使 4 张）
  if (![1, 2, 3].includes(tier)) return INVALID_MOVE;
  if (!Number.isInteger(slot) || slot < 0 || slot >= MARKET_SIZE) return INVALID_MOVE;

  const card = G.market[tier][slot];
  if (!card) return INVALID_MOVE;                                // 空位

  takeIntoHand(G, me, card);
  refill(G, tier, slot);
  finishAction({ G, playerID, events });
}

// 预订某一级牌堆顶的暗牌（别人看不到是什么）
export function reserveFromDeck({ G, playerID, events }, tier) {
  const me = G.players[playerID];
  if (me.reserved.length >= maxReserved(me)) return INVALID_MOVE;
  if (![1, 2, 3].includes(tier)) return INVALID_MOVE;
  if (G.decks[tier].length === 0) return INVALID_MOVE;          // 牌堆空了

  const card = G.decks[tier].shift();
  takeIntoHand(G, me, { ...card, blind: true });   // 暗牌：别人只看得到等级
  finishAction({ G, playerID, events });
}

// 购买成功后的共同步骤：付款（退回桌上）+ 食谱放到面前
function payAndTake(G, playerID, card) {
  const me = G.players[playerID];
  const pay = payment(me, card, surcharge(G, playerID));
  if (!pay) return false;

  for (const [token, n] of Object.entries(pay)) {
    me.tokens[token] -= n;
    G.bank[token] += n;
  }
  me.cards.push(card);
  return true;
}

// 购买市场上的食谱
export function buy({ G, playerID, events }, tier, slot) {
  if (![1, 2, 3].includes(tier)) return INVALID_MOVE;
  if (!Number.isInteger(slot) || slot < 0 || slot >= MARKET_SIZE) return INVALID_MOVE;

  const card = G.market[tier][slot];
  if (!card) return INVALID_MOVE;
  if (!payAndTake(G, playerID, card)) return INVALID_MOVE;   // 付不起

  refill(G, tier, slot);
  finishAction({ G, playerID, events });
}

// 购买自己预订的食谱：index = 在 reserved 里的位置（0–2）
export function buyReserved({ G, playerID, events }, index) {
  const me = G.players[playerID];
  if (!Number.isInteger(index) || index < 0 || index >= me.reserved.length) return INVALID_MOVE;

  const card = me.reserved[index];
  if (!payAndTake(G, playerID, card)) return INVALID_MOVE;

  me.reserved.splice(index, 1);
  finishAction({ G, playerID, events });
}