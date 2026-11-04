import { INVALID_MOVE } from 'boardgame.io/core';
import { COLORS, MARKET_SIZE } from './constants.js';
import {
  refill, payment, tokenCount, fridgeLimit, maxReserved, takeTwoMin, surcharge, hasChef,
} from './state.js';
import { finishAction, endOfTurn } from './turn.js';

// 正式游戏的四种行动（拿 3 个 / 拿 2 个 / 预订 / 购买）和冰箱弃牌。
// 每个行动成功后都调用 finishAction 进入回合收尾（turn.js）

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

// 弃牌环节专用：一次扔掉 1 个调味或高汤，降到上限就进入回合收尾
export function discard({ G, playerID, events }, token) {
  const me = G.players[playerID];
  if (!(token in me.tokens) || me.tokens[token] < 1) return INVALID_MOVE;

  me.tokens[token] -= 1;
  G.bank[token] += 1;

  if (tokenCount(me) <= fridgeLimit(G, me)) endOfTurn({ G, playerID, events });
}
