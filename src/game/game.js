import { RECIPES } from './data/recipes.js';
import { CHEFS } from './data/chefs.js';
import { COLORS, MARKET_SIZE, rulesFor } from './constants.js';
import { newPlayer, score, ranking, winners } from './state.js';
import {
  takeThree, takeTwo, reserve, reserveFromDeck, buy, buyReserved,
  discard, chooseChef, skipChef, giveToThief, clearRow,
} from './moves.js';
import { draftPhase } from './draft.js';

// setupData（可选）：
//   rules    覆盖按人数取的数值，模拟测试不同数值时用
//   hotseat  同屏模式（一台电脑轮流玩）：不隐藏信息，偷味恶魔可以替别人点
export function setup({ ctx, random }, setupData) {
  // 0. 这一局的数值：按人数取，存进 G，招式和界面都从 G.rules 读
  const rules = { ...rulesFor(ctx.numPlayers), ...setupData?.rules };

  // 1. Bank
  const bank = { stock: rules.stock };
  for (const c of COLORS) bank[c] = rules.seasoning;

  // 2. Decks: split by tier, then shuffle each
  const decks = {};
  for (const tier of [1, 2, 3]) {
    decks[tier] = random.Shuffle(RECIPES.filter(r => r.tier === tier));
  }

  // 3. Market: deal the top 4 of each deck face up
  const market = {};
  for (const tier of [1, 2, 3]) {
    market[tier] = decks[tier].splice(0, MARKET_SIZE);
  }

  // 4. Chefs: 按人数翻开若干天使 + 若干恶魔
  const angels = random.Shuffle(CHEFS.filter(c => c.side === 'angel'));
  const devils = random.Shuffle(CHEFS.filter(c => c.side === 'devil'));
  const chefs = [
    ...angels.slice(0, rules.chefs.angel),
    ...devils.slice(0, rules.chefs.devil),
  ];

  // 5. 家常菜：再从一级牌堆翻开"人数"张，开局挑选用
  const starters = decks[1].splice(0, ctx.numPlayers);

  // 6. Players, keyed by playerID ('0'..'4')
  const players = {};
  for (const id of ctx.playOrder) players[id] = newPlayer();

  return {
    rules, bank, decks, market, starters, chefs, players,
    hotseat: !!setupData?.hotseat,
    chefTakenThisTurn: false,   // 每回合最多请 1 位主厨
    thief: null,                // 偷味恶魔结算中：{ by, pending: [还没交调味的玩家] }
    priceHike: null,            // 涨价恶魔生效中：{ by, roundsLeft }，每到 by 的回合开始减 1，到 0 取消
    lastEvent: null,            // 最近一次恶魔效果的说明：{ turn, text }
    endTriggered: false, finalRoundDone: false, log: [],
  };
}

// 正式游戏阶段
const playPhase = {
  moves: { takeThree, takeTwo, reserve, reserveFromDeck, buy, buyReserved },
  turn: {
    // 开局结束后，从 1 号位开始顺时针
    order: {
      first: () => 0,
      next: ({ ctx }) => (ctx.playOrderPos + 1) % ctx.playOrder.length,
    },
    // 每个回合开始时：重置"本回合请过主厨"；涨价恶魔每到主人的回合少一轮，两轮后失效
    onBegin: ({ G, ctx }) => {
      G.chefTakenThisTurn = false;
      if (G.priceHike?.by === ctx.currentPlayer) {
        G.priceHike.roundsLeft -= 1;
        if (G.priceHike.roundsLeft <= 0) G.priceHike = null;
      }
    },
    // 每个回合结束时：检查有没有人达到终局分数，以及这一轮是否打完
    onEnd: ({ G, ctx }) => {
      if (score(G.players[ctx.currentPlayer]) >= G.rules.winScore) G.endTriggered = true;
      const lastInRound = ctx.playOrderPos === ctx.playOrder.length - 1;
      if (G.endTriggered && lastInRound) G.finalRoundDone = true;
    },
    stages: {
      // 冰箱超过上限时进入：只能弃牌
      discard: { moves: { discard } },
      // 有满足条件的主厨时进入：请 1 位或不请
      chooseChef: { moves: { chooseChef, skipChef } },
      // 偷味恶魔：被偷的人各自选 1 个调味交出
      thiefGive: { moves: { giveToThief } },
      // 撤菜恶魔：选一个等级换掉整行
      clearRow: { moves: { clearRow } },
    },
  },
};

// 联网时每位玩家只收到自己该看到的：牌堆只给张数，别人摸的暗牌只给等级
// 同屏模式所有人看同一块屏幕，不用藏
export function playerView({ G, playerID }) {
  if (G.hotseat) return G;
  const decks = {};
  for (const tier of [1, 2, 3]) decks[tier] = G.decks[tier].map(() => null);
  const players = {};
  for (const [id, p] of Object.entries(G.players)) {
    players[id] = id === playerID ? p : {
      ...p,
      reserved: p.reserved.map(c => (c.blind ? { id: c.id, tier: c.tier, blind: true } : c)),
    };
  }
  return { ...G, decks, players };
}

export const ChefsTable = {
  name: 'chefs-table',
  playerView,
  minPlayers: 2,
  maxPlayers: 5,
  setup,
  phases: {
    draft: draftPhase,   // 开局：家常菜 + 座位补偿
    play: playPhase,     // 正式游戏
  },

  // 这一轮打完就结束游戏，返回赢家和排名
  endIf: ({ G }) => {
    if (G.finalRoundDone) return { winners: winners(G), ranking: ranking(G) };
  },
};

// 测试用：跳过开局，直接从正式游戏开始
export const ChefsTableNoDraft = {
  ...ChefsTable,
  phases: {
    draft: { ...draftPhase, start: false },
    play: { ...playPhase, start: true },
  },
};