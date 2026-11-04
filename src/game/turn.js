import { tokenCount, eligibleChefs, fridgeLimit } from './state.js';

// 回合流程：每个行动（包括主厨技能结算完）都从这里收尾
//   行动 → 冰箱超了先弃牌 → 有满足条件的主厨就选主厨 → 结束回合

// 每个行动成功后都调用：冰箱超了就先弃牌，否则直接进入回合收尾
// 恶魔效果结算完也走这里（偷来的调味可能让冰箱超）
export function finishAction({ G, playerID, events }) {
  if (tokenCount(G.players[playerID]) > fridgeLimit(G, G.players[playerID])) {
    events.setActivePlayers({ currentPlayer: 'discard' });
  } else {
    endOfTurn({ G, playerID, events });
  }
}

// 回合收尾：检查主厨，然后结束回合
// 有满足条件的主厨：让玩家决定请哪位，或者不请；每回合最多 1 位
export function endOfTurn({ G, playerID, events }) {
  if (!G.chefTakenThisTurn && eligibleChefs(G, G.players[playerID]).length > 0) {
    events.setActivePlayers({ currentPlayer: 'chooseChef' });
    return;   // 等玩家决定完再结束回合
  }
  events.endTurn();
}

// 记一条"刚刚发生了什么"，界面在状态栏里提示所有人
export function announce(G, ctx, text) {
  G.lastEvent = { turn: ctx.turn, text };
}

export const seatName = (ctx, id) => `${ctx.playOrder.indexOf(id) + 1} 号位`;
