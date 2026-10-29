// 让 Node 直接运行 src/game 下的代码：boardgame.io 的子路径（boardgame.io/core 等）
// 没有 exports 字段，Node 原生 ESM 找不到，这里把它们指到包里的 CommonJS 构建。
// Vite / Vitest 自己能解析，不需要这个；只给 scripts/simulate.js 用：
//   node --import ./scripts/bgio-resolve.mjs scripts/simulate.js
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const sub = /^boardgame\.io\/([\w-]+)$/.exec(specifier);
    return nextResolve(sub ? `boardgame.io/dist/cjs/${sub[1]}.js` : specifier, context);
  },
});
