import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COLORS } from '../game/constants.js';
import { TOKEN_INFO } from './labels.js';
import { RecipeCard } from './RecipeCard.jsx';

// 飞行动画层：比较前后两次的 G，把"谁拿走了什么"画成从旧位置飞到新位置。
//   调味：桌面 → 玩家（拿取、预订得高汤、开局补偿）；玩家 → 桌面（付款、弃牌、打翻锅）；玩家 → 玩家（偷味恶魔）
//   食谱：市场 / 牌堆 / 自己的预订 / 开局家常菜 → 玩家（买到：飞向折扣格；预订：飞向预订区）
//   补牌：牌堆 → 市场空位，边飞边翻面
// 位置靠界面上的 data-anchor：
//   b-<色> 调味堆   d<级> 牌堆   m<级>-<位> 市场   s<序> 家常菜
//   p<id> 玩家栏   p<id>-t-<色> 玩家调味   p<id>-c-<色> 玩家折扣   p<id>-r<序> 预订   p<id>-extra 预订区

const TOKENS = [...COLORS, 'stock'];
const TOKEN_MS = 520;
const CARD_MS = 650;
const REFILL_MS = 700;
const REFILL_DELAY = 300;     // 等被拿走的卡先飞一会儿，再补新牌

let nextId = 1;

function snapshot() {
  const rects = {};
  for (const el of document.querySelectorAll('[data-anchor]')) rects[el.dataset.anchor] = el.getBoundingClientRect();
  return rects;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// 这张卡在旧状态里的位置：{ from, blind }，blind = 从牌堆摸的暗牌，飞的时候不翻面
function whereWas(card, G, rects) {
  for (const tier of [1, 2, 3]) {
    const slot = G.market[tier].findIndex(c => c?.id === card.id);
    if (slot >= 0) return { from: rects[`m${tier}-${slot}`] };
  }
  for (const [id, p] of Object.entries(G.players)) {
    const i = p.reserved.findIndex(c => c.id === card.id);
    if (i >= 0) return { from: rects[`p${id}-r${i}`] };
  }
  const s = G.starters?.findIndex(c => c?.id === card.id) ?? -1;
  if (s >= 0) return { from: rects[`s${s}`] };
  return { from: rects[`d${card.tier}`], blind: true };
}

function heldBySomeone(card, G) {
  return Object.values(G.players).some(p => p.reserved.some(c => c.id === card.id) || p.cards.some(c => c.id === card.id));
}

function diff(a, b, oldRects, newRects) {
  const out = [];
  const add = f => f.from && f.to && out.push({ id: nextId++, ...f });

  for (const [id, pb] of Object.entries(b.players)) {
    const pa = a.players[id];

    // 买到的菜：飞向这种颜色的折扣格
    for (const card of pb.cards) {
      if (pa.cards.some(c => c.id === card.id)) continue;
      add({ kind: 'card', card, ...whereWas(card, a, oldRects), to: newRects[`p${id}-c-${card.bonus}`], ms: CARD_MS, shrink: true });
    }
    // 预订的菜：飞向预订区
    pb.reserved.forEach((card, i) => {
      if (pa.reserved.some(c => c.id === card.id)) return;
      add({ kind: 'card', card, ...whereWas(card, a, oldRects), to: newRects[`p${id}-r${i}`] ?? newRects[`p${id}-extra`] ?? newRects[`p${id}`], ms: CARD_MS });
    });

  }

  // 调味：玩家之间直接转手的（偷味恶魔），从一位玩家飞到另一位；其余多了从桌面飞来，少了飞回桌面
  let n = 0;
  for (const t of TOKENS) {
    const gains = [];
    const losses = [];
    for (const [id, pb] of Object.entries(b.players)) {
      const d = pb.tokens[t] - a.players[id].tokens[t];
      for (let k = 0; k < Math.abs(d); k++) (d > 0 ? gains : losses).push(id);
    }
    const handed = b.bank[t] === a.bank[t] ? Math.min(gains.length, losses.length) : 0;
    for (let k = 0; k < handed; k++) {
      add({ kind: 'token', token: t, from: oldRects[`p${losses[k]}-t-${t}`], to: newRects[`p${gains[k]}-t-${t}`], ms: TOKEN_MS, delay: n++ * 70 });
    }
    for (const id of gains.slice(handed)) {
      add({ kind: 'token', token: t, from: oldRects[`b-${t}`], to: newRects[`p${id}-t-${t}`], ms: TOKEN_MS, delay: n++ * 70 });
    }
    for (const id of losses.slice(handed)) {
      add({ kind: 'token', token: t, from: oldRects[`p${id}-t-${t}`], to: newRects[`b-${t}`], ms: TOKEN_MS, delay: n++ * 70 });
    }
  }

  // 补牌：市场某个位置换成了一张新牌（不是从谁手里放回来的）
  for (const tier of [1, 2, 3]) {
    b.market[tier].forEach((card, slot) => {
      if (!card || card.id === a.market[tier][slot]?.id || heldBySomeone(card, a)) return;
      add({ kind: 'refill', card, tier, from: oldRects[`d${tier}`], to: newRects[`m${tier}-${slot}`],
            target: `m${tier}-${slot}`, ms: REFILL_MS, delay: REFILL_DELAY });
    });
  }
  return out;
}

export function Flights({ G }) {
  const [flights, setFlights] = useState([]);
  const prev = useRef(null);          // 上一次渲染时的 { G, rects }

  useLayoutEffect(() => {
    const rects = snapshot();
    const before = prev.current;
    prev.current = { G, rects };
    if (!before || before.G === G || reducedMotion()) return;
    const next = diff(before.G, G, before.rects, rects);
    // 状态变化后才知道要飞什么，只能在这里加；位置必须在浏览器绘制前量好
    if (next.length) setFlights(f => [...f, ...next]);
  }, [G]);

  // 窗口大小变了，记录的位置也要更新
  useEffect(() => {
    const onResize = () => { if (prev.current) prev.current.rects = snapshot(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const remove = useCallback(id => setFlights(fs => fs.filter(f => f.id !== id)), []);

  return (
    <div className="flights" aria-hidden="true">
      {flights.map(f => <Flight key={f.id} f={f} remove={remove} />)}
    </div>
  );
}

function Flight({ f, remove }) {
  const ref = useRef(null);
  const inner = useRef(null);

  useLayoutEffect(() => {
    const { from, to } = f;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const scale = Math.min(to.width / from.width, to.height / from.height);
    const timing = { duration: f.ms, delay: f.delay ?? 0, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'both' };

    // 补牌：新牌先藏起来，翻到位后再露出来
    const target = f.target ? document.querySelector(`[data-anchor="${f.target}"]`) : null;
    if (target) target.style.visibility = 'hidden';

    const lift = f.kind === 'refill' ? 1 : 1.12;     // 飞到半路稍微放大，像被拿起来
    const anims = [ref.current.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx / 2}px, ${dy / 2 - 30}px) scale(${((1 + scale) / 2) * lift})`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: f.shrink ? 0.35 : 1 },
    ], timing)];
    if (f.kind === 'refill') {
      anims.push(inner.current.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], timing));
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (target) target.style.visibility = '';
      remove(f.id);
    };
    anims[0].onfinish = finish;
    return () => { anims.forEach(a => a.cancel()); if (target) target.style.visibility = ''; };
  }, [f, remove]);

  // --card-w：卡面里的字和圆点按卡宽缩放（见 board.css），飞行层不在 .table 里，要自己给
  const box = { left: f.from.left, top: f.from.top, width: f.from.width, height: f.from.height, '--card-w': `${f.from.width}px` };

  if (f.kind === 'token') {
    const info = TOKEN_INFO[f.token];
    return (
      <div ref={ref} className="flight flight-token" style={{ ...box, '--c': info.color }}>
        <img src={info.icon} alt="" />
      </div>
    );
  }
  if (f.kind === 'refill') {
    // 牌堆和市场卡一样大，起点用目标的尺寸，免得翻面时变形
    return (
      <div ref={ref} className="flight flip" style={{ ...box, width: f.to.width, height: f.to.height, '--card-w': `${f.to.width}px` }}>
        <div ref={inner} className="flip-inner">
          <div className={`flip-face flip-back deck tier-${f.tier}`}><span className="deck-tier">{f.tier} 级</span></div>
          <div className="flip-face"><RecipeCard card={f.card} /></div>
        </div>
      </div>
    );
  }
  return (
    <div ref={ref} className="flight flight-card" style={box}>
      {f.blind || !f.card.cost
        ? <div className={`flip-face flip-back deck tier-${f.card.tier}`}><span className="deck-tier">{f.card.tier} 级</span></div>
        : <RecipeCard card={f.card} />}
    </div>
  );
}
