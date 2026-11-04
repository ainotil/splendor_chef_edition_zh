import { INVALID_MOVE } from 'boardgame.io/core';
import { COLORS, MARKET_SIZE } from './constants.js';
import { refill, eligibleChefs, score, maxReserved } from './state.js';
import { finishAction, announce, seatName } from './turn.js';

// 主厨：请主厨、恶魔和"到来时"天使的效果，以及它们需要玩家做选择的环节。
// 天使的持续技能是纯查询（冰箱上限、预订上限……），在 state.js 里。
// 加一位新主厨：data/chefs.js 加一行；持续技能改 state.js，到来时效果加在这里的 devilArrives / chooseChef 里。

function takeChef(G, playerID, chefId) {
  const index = G.chefs.findIndex(c => c.id === chefId);
  const [chef] = G.chefs.splice(index, 1);
  G.players[playerID].chefs.push(chef);
  G.chefTakenThisTurn = true;
  return chef;
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
