import { useState } from 'react';
import { COLORS } from '../game/constants.js';
import { payment, eligibleChefs, maxReserved, surcharge } from '../game/state.js';
import { TOKEN_INFO, ALL_TOKENS } from './labels.js';
import { Token } from './Token.jsx';
import { RecipeCard } from './RecipeCard.jsx';

// 桌面中间：开局的家常菜挑选，正式游戏的市场、调味堆和主厨

// ---------- 开局：挑家常菜 + 座位补偿 ----------
export function DraftPanel({ G, moves, seat }) {
  const [index, setIndex] = useState(null);
  const [chosen, setChosen] = useState([]);
  const need = G.rules.seatBonus[seat] ?? 0;

  function confirm() {
    moves.pickStarter(index, chosen);
    setIndex(null);
    setChosen([]);
  }

  return (
    <section className="draft">
      <h2>1. 选一张家常菜</h2>
      <div className="row">
        {G.starters.map((card, i) => (
          <RecipeCard key={i} card={card} selected={index === i} anchor={`s${i}`}
                      onClick={card ? () => setIndex(i) : undefined} />
        ))}
      </div>

      <h2>2. 领取开局调味：{need} 个（可重复）</h2>
      <div className="row">
        {COLORS.map(c => (
          <Token key={c} type={c} anchor={`b-${c}`}
                 onClick={chosen.length < need ? () => setChosen([...chosen, c]) : undefined} />
        ))}
      </div>
      <div className="row">
        已选：
        {chosen.length === 0 && <span className="muted">无</span>}
        {chosen.map((c, i) => (
          <Token key={i} type={c} small
                 onClick={() => setChosen(chosen.filter((_, j) => j !== i))} />
        ))}
      </div>

      <button className="primary" disabled={index === null || chosen.length !== need} onClick={confirm}>
        确定
      </button>
    </section>
  );
}

// ---------- 市场：三行，每行左边是牌堆 ----------
export function Market({ G, me, player, sel, active, select }) {
  const canReserve = active && player.reserved.length < maxReserved(player);
  const extraCost = surcharge(G, me);
  return (
    <section className="market">
      {[3, 2, 1].map(tier => {
        const deckSelected = sel?.kind === 'deck' && sel.tier === tier;
        return (
          <div key={tier} className="market-row">
            <button className={`deck tier-${tier} ${deckSelected ? 'selected' : ''}`} data-anchor={`d${tier}`}
                    disabled={!canReserve || G.decks[tier].length === 0}
                    title="点一下：从这一级牌堆顶摸一张预订"
                    onClick={() => select(deckSelected ? null : { kind: 'deck', tier })}>
              <span className="deck-count">{G.decks[tier].length}</span>
              <span className="deck-tier">{tier} 级</span>
            </button>
            {G.market[tier].map((card, slot) => {
              const selected = sel?.kind === 'card' && sel.tier === tier && sel.slot === slot;
              return (
                <RecipeCard key={slot} card={card} dim={card && !payment(player, card, extraCost)} selected={selected} anchor={`m${tier}-${slot}`}
                            onClick={active && card ? () => select(selected ? null : { kind: 'card', tier, slot }) : undefined} />
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

// ---------- 调味堆：点选 ----------
export function Bank({ G, sel, active, toggle }) {
  const chosen = sel?.kind === 'tokens' ? sel.colors : [];
  return (
    <section className="bank">
      {ALL_TOKENS.map(c => (
        <Token key={c} type={c} count={G.bank[c]} stack selected={chosen.includes(c)} anchor={`b-${c}`}
               onClick={active && c !== 'stock' && G.bank[c] > 0 ? () => toggle(c) : undefined} />
      ))}
    </section>
  );
}

// ---------- 主厨：鼠标停留看技能 ----------
export function Chefs({ G, player, moves, choosing }) {
  const eligible = eligibleChefs(G, player).map(c => c.id);
  return (
    <section className="chefs">
      {G.chefs.length === 0 && <span className="muted">主厨已全部被请走</span>}
      {G.chefs.map(chef => (
        <div key={chef.id} className={`chef ${chef.side} ${choosing && eligible.includes(chef.id) ? 'ready' : ''}`}
             onClick={choosing && eligible.includes(chef.id) ? () => moves.chooseChef(chef.id) : undefined}>
          <div className="chef-head">
            <span className="chef-points">{chef.points}</span>
            <span className="chef-name">{chef.name}</span>
          </div>
          <div className="chef-requires">
            {Object.entries(chef.requires).map(([c, n]) => (
              <span key={c} className="req" style={{ background: TOKEN_INFO[c].color, color: TOKEN_INFO[c].text }}>{n}</span>
            ))}
          </div>
          {choosing && eligible.includes(chef.id) && (
            <button className="primary chef-choose" onClick={e => { e.stopPropagation(); moves.chooseChef(chef.id); }}>请他来</button>
          )}
          <div className="chef-tip" role="tooltip">
            <b>{chef.side === 'angel' ? '天使' : '恶魔'} · {chef.once || chef.side === 'devil' ? '到来时生效一次' : '持续生效'}</b>
            <div>{chef.skill}</div>
            <div className="muted">条件：已做的菜里有这些折扣（只看菜，不看手里的调味）</div>
          </div>
        </div>
      ))}
    </section>
  );
}
