import { useEffect, useRef, useState } from 'react';
import { bonuses, score, tokenCount, payment, fridgeLimit, surcharge } from '../game/state.js';
import { TOKEN_INFO, SEAT_NAMES, ALL_TOKENS } from './labels.js';
import { RecipeCard } from './RecipeCard.jsx';

// ---------- 右侧：所有玩家 ----------
export function Sidebar({ G, ctx, me, stage, sel, active, select, moves, names, online }) {
  return (
    <aside className="sidebar">
      {ctx.playOrder.map((id, seat) => (
        <PlayerPanel key={id} G={G} id={id} seat={seat} turn={id === ctx.currentPlayer} mine={id === me}
                     name={names[id]} online={online}
                     stage={id === me ? stage : undefined} sel={sel} active={active && id === me}
                     select={select} moves={moves} />
      ))}
    </aside>
  );
}

// turn：现在轮到这位（金框）；mine：这是我的座位（看得到自己的预订、可以弃牌 / 交调味）
function PlayerPanel({ G, id, seat, turn, mine, name, online, stage, sel, active, select, moves }) {
  const p = G.players[id];
  const b = bonuses(p);
  const discarding = stage === 'discard';
  // 偷味恶魔：轮到这位交 1 个调味。联网时只有本人能点，同屏时谁都能点
  const giving = !!G.thief?.pending.includes(id) && (G.hotseat || mine);
  const count = tokenCount(p);
  const limit = fridgeLimit(G, p);

  // 玩家栏放不下时会滚动：轮到谁就把谁滚到眼前
  const ref = useRef(null);
  useEffect(() => {
    if (turn) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turn, stage, p.reserved.length]);

  return (
    <section ref={ref} className={`player ${turn ? 'current' : ''} ${discarding || giving ? 'discarding' : ''}`} data-anchor={`p${id}`}>
      <div className="player-head">
        <span className="player-name">{SEAT_NAMES[seat]}</span>
        {online && <span className="player-nick">{name}{mine && '（你）'}</span>}
        <span className="player-score" title="口碑">★ {score(p)}</span>
        <span className={`player-fridge ${count > limit ? 'over' : ''}`} title="冰箱：调味 + 高汤">
          冰箱 {count}/{limit}
        </span>
      </div>
      {giving && <div className="player-ask">偷味恶魔：点 1 个调味交出去</div>}
      <div className="slots">
        {ALL_TOKENS.map(t => {
          const info = TOKEN_INFO[t];
          const canDrop = discarding && p.tokens[t] > 0;
          const canGive = giving && t !== 'stock' && p.tokens[t] > 0;
          return (
            <div key={t} className="slot">
              {t === 'stock'
                ? <span className="slot-card none" />
                : <DiscountCard color={t} count={b[t]} cards={p.cards} anchor={`p${id}-c-${t}`} />}
              <button className="slot-token" style={{ '--c': info.color }} disabled={!canDrop && !canGive} data-anchor={`p${id}-t-${t}`}
                      title={canGive ? `交出 1 个${info.name}` : canDrop ? `扔掉 1 个${info.name}` : `手里的${info.name}`}
                      onClick={() => (canGive ? moves.giveToThief(id, t) : moves.discard(t))}>
                <img src={info.icon} alt="" />
                <span>{p.tokens[t]}</span>
              </button>
            </div>
          );
        })}
      </div>
      {(p.reserved.length > 0 || p.chefs.length > 0) && (
        <div className="player-extra" data-anchor={`p${id}-extra`}>
          {p.reserved.map((card, i) => {
            if (!mine) return <span key={card.id} className={`card-back tier-${card.tier}`} data-anchor={`p${id}-r${i}`} title={`预订了一张 ${card.tier} 级食谱`} />;
            const selected = sel?.kind === 'reserved' && sel.index === i;
            return (
              <RecipeCard key={card.id} card={card} compact dim={!payment(p, card, surcharge(G, id))} selected={selected} anchor={`p${id}-r${i}`}
                          onClick={active ? () => select(selected ? null : { kind: 'reserved', index: i }) : undefined} />
            );
          })}
          {p.chefs.map(c => <span key={c.id} className={`tag ${c.side}`} title={c.skill}>{c.name}</span>)}
        </div>
      )}
    </section>
  );
}

// 玩家栏里的折扣计数：鼠标停留时从新到旧列出这种颜色做过的菜
// 玩家栏会滚动，普通的绝对定位提示会被裁掉，所以用 fixed 定位在玩家栏左边
function DiscountCard({ color, count, cards, anchor }) {
  const [tip, setTip] = useState(null);
  const info = TOKEN_INFO[color];
  const dishes = cards.filter(c => c.bonus === color).reverse();

  function show(e) {
    const r = e.currentTarget.getBoundingClientRect();
    // 宽屏时玩家栏整体放大（CSS zoom），fixed 定位的偏移也会被放大，所以先除回去
    const z = e.currentTarget.currentCSSZoom ?? 1;
    const below = r.top < window.innerHeight / 2;
    setTip({ right: (window.innerWidth - r.left + 10) / z,
             ...(below ? { top: r.top / z } : { bottom: (window.innerHeight - r.bottom) / z }) });
  }

  return (
    <span className="slot-card" style={{ background: info.color, color: info.text }} data-anchor={anchor}
          onMouseEnter={show} onMouseLeave={() => setTip(null)}>
      {count}
      {tip && (
        <span className="slot-tip" role="tooltip" style={tip}>
          <b>{info.name}折扣 {count}</b>
          {dishes.length === 0
            ? <span className="muted">还没做过{info.name}菜</span>
            : dishes.map(c => <span key={c.id}>【{c.points}】{c.name}</span>)}
        </span>
      )}
    </span>
  );
}
