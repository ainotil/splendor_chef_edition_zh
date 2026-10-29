// constants.js
export const COLORS = ['sugar', 'soy', 'chili', 'peppercorn', 'vinegar'];
export const MAX_RESERVED = 3;
export const MARKET_SIZE = 4;
export const TAKE_TWO_MIN = 4;     // 拿 2 个同色：该色桌上至少剩几个

// 按人数变化的数值。推导和模拟验证见策划案"不同人数的数值"一节，
// 模拟脚本：npm run simulate
//   seasoning  每种调味几个        stock   高汤几个
//   fridge     冰箱容量（持有上限）  chefs   天使 / 恶魔各翻几位
//   winScore   终局分数            seatBonus  每个座位的开局调味（2–4 人：1 号位 0，其余每人 1；5 人沿用 0/1/1/2/2）
export const RULES = {
  2: { seasoning: 4,  stock: 4, fridge: 8, chefs: { angel: 2, devil: 1 }, winScore: 15, seatBonus: [0, 1] },
  3: { seasoning: 6,  stock: 5, fridge: 8, chefs: { angel: 2, devil: 2 }, winScore: 15, seatBonus: [0, 1, 1] },
  4: { seasoning: 8,  stock: 6, fridge: 8, chefs: { angel: 3, devil: 2 }, winScore: 16, seatBonus: [0, 1, 1, 1] },
  5: { seasoning: 10, stock: 7, fridge: 8, chefs: { angel: 3, devil: 3 }, winScore: 16, seatBonus: [0, 1, 1, 2, 2] },
};

export function rulesFor(numPlayers) {
  const rules = RULES[numPlayers];
  if (!rules) throw new Error(`不支持 ${numPlayers} 人局`);
  return rules;
}
