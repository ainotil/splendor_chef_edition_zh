import { useContext, useEffect, useRef, useState } from 'react';
import { COLORS } from '../game/constants.js';
import {
  bonuses, score, tokenCount, payment, eligibleChefs,
  fridgeLimit, maxReserved, takeTwoMin, surcharge,
} from '../game/state.js';
import { TOKEN_INFO, SEAT_NAMES } from './labels.js';
import { Token } from './Token.jsx';
import { RecipeCard } from './RecipeCard.jsx';
import { HelpContext, LeaveContext } from './helpContext.js';
import { Flights } from './Flights.jsx';
import './board.css';

const ALL_TOKENS = [...COLORS, 'stock'];

// 布局（参考 Board Game Arena 的 Splendor）：
//   顶部状态栏：轮到谁 + 当前可以做的操作按钮
//   中间：三行市场（左边牌堆）| 调味堆 | 主厨 ；右侧：所有玩家
//   底部信息栏
// 操作方式：先点选（调味 / 食谱 / 牌堆 / 自己的预订），再在状态栏里确认
export function Board({ G, ctx, moves, undo, playerID, isMultiplayer, isConnected, matchData, matchID }) {
  // 同屏模式没有固定的 playerID，"我"就是当前行动的玩家；联网时"我"是自己的座位
  const me = playerID ?? ctx.currentPlayer;
  const seat = ctx.playOrder.indexOf(me);
  const stage = ctx.activePlayers?.[me];
  const player = G.players[me];
  const playing = ctx.phase === 'play';
  const myTurn = ctx.currentPlayer === me;
  const canAct = playing && myTurn && !stage;
  // 联网时：每个座位的玩家名字；还有人没进房间就先显示等候室
  const names = Object.fromEntries((matchData ?? []).map(m => [String(m.id), m.name]));
  const waitingFor = isMultiplayer ? (matchData ?? []).filter(m => !m.name).length : 0;

  // 当前选中的东西；换回合后自动作废
  const [picked, setPicked] = useState(null);
  const sel = canAct && picked?.turn === ctx.turn ? picked : null;
  const select = s => setPicked(s && { ...s, turn: ctx.turn });

  if (ctx.gameover) return <GameOver result={ctx.gameover} />;
  if (waitingFor > 0) return <WaitingRoom matchData={matchData} matchID={matchID} me={me} />;

  function toggleToken(c) {
    const colors = sel?.kind === 'tokens' ? sel.colors : [];
    const next = colors.includes(c) ? colors.filter(x => x !== c) : [...colors, c].slice(-3);
    select(next.length ? { kind: 'tokens', colors: next } : null);
  }
  // 执行一个行动，并清掉选择
  const act = (fn, ...args) => { fn(...args); select(null); };

  return (
    <div className="board">
      <StatusBar G={G} ctx={ctx} me={me} player={player} stage={stage} sel={sel} myTurn={myTurn}
                 online={isMultiplayer} connected={isConnected}
                 moves={moves} undo={undo} act={act} cancel={() => select(null)} />
      <div className="main">
        <div className="table">
          {playing ? (
            <>
              <Market G={G} me={me} player={player} sel={sel} active={canAct} select={select} />
              <Bank G={G} sel={sel} active={canAct} toggle={toggleToken} />
            </>
          ) : myTurn ? (
            <DraftPanel G={G} moves={moves} seat={seat} />
          ) : (
            <section className="draft"><h2>等{SEAT_NAMES[ctx.playOrder.indexOf(ctx.currentPlayer)]}挑家常菜…</h2></section>
          )}
          <Chefs G={G} player={player} moves={moves} choosing={stage === 'chooseChef'} />
        </div>
        <Sidebar G={G} ctx={ctx} me={me} stage={stage} sel={sel} active={canAct} select={select} moves={moves}
                 names={names} online={isMultiplayer} />
      </div>
      <InfoBar />
      <Flights G={G} />
    </div>
  );
}

// 买不起时差几个（折扣、高汤、涨价恶魔多付的都算上）
function shortfall(player, card, extraCost) {
  const b = bonuses(player);
  const missing = COLORS.reduce((sum, c) => sum + Math.max(0, (card.cost[c] ?? 0) - b[c] - player.tokens[c]), 0);
  return Math.max(0, missing + extraCost - player.tokens.stock);
}

function Icon({ type }) {
  return <img className="inline-icon" src={TOKEN_INFO[type].icon} alt={TOKEN_INFO[type].name} title={TOKEN_INFO[type].name} />;
}

// ---------- 顶部状态栏：提示 + 操作按钮 ----------
function StatusBar({ G, ctx, me, player, stage, sel, myTurn, online, connected, moves, undo, act, cancel }) {
  const name = <b className="who">{SEAT_NAMES[ctx.playOrder.indexOf(me)]}</b>;
  const turnName = <b className="who">{SEAT_NAMES[ctx.playOrder.indexOf(ctx.currentPlayer)]}</b>;
  const seatOf = id => SEAT_NAMES[ctx.playOrder.indexOf(id)];
  const have = tokenCount(player);
  const limit = fridgeLimit(G, player);
  const extraCost = surcharge(G, me);
  let content;

  if (online && !connected) {
    content = <span className="status-alert">和服务器断开了，正在重连…</span>;
  } else if (stage === 'thiefGive' && G.thief?.by !== me) {
    content = <span className="status-alert">偷味恶魔：请在你的玩家栏里点 1 个调味交给 {turnName}</span>;
  } else if (!myTurn) {
    content = G.thief
      ? <>等 {G.thief.pending.map(seatOf).join('、')} 把调味交给 {turnName}…</>
      : <>等 {turnName} {ctx.phase === 'draft' ? '挑家常菜' : '行动'}…</>;
  } else if (ctx.phase === 'draft') {
    content = <>{name} 挑选家常菜，并领取开局调味</>;
  } else if (stage === 'discard') {
    content = (
      <span className="status-alert">
        冰箱最多放 {limit} 个，{name} 现在有 {have} 个：在右边自己的栏里点调味扔掉 <b>{have - limit}</b> 个，或者
        <button onClick={undo}>撤销上一步</button>
      </span>
    );
  } else if (stage === 'thiefGive') {
    content = (
      <span className="status-alert">
        偷味恶魔：{G.thief.pending.map(seatOf).join('、')} 各在自己的玩家栏里点 1 个调味交给 {name}
      </span>
    );
  } else if (stage === 'clearRow') {
    content = (
      <>
        撤菜恶魔：{name} 选一个等级，把那一行 4 张食谱全部换掉
        {[3, 2, 1].map(t => <button key={t} className="primary" onClick={() => moves.clearRow(t)}>换掉 {t} 级</button>)}
      </>
    );
  } else if (stage === 'chooseChef') {
    const count = eligibleChefs(G, player).length;
    content = (
      <>
        {count > 1 ? `有 ${count} 位名厨` : '有名厨'}愿意来找 {name}（右边发光的）：点名厨请他来，每回合最多 1 位
        <button onClick={() => moves.skipChef()}>不请，结束回合</button>
        <button onClick={undo}>撤销上一步</button>
      </>
    );
  } else if (sel?.kind === 'tokens') {
    const { colors } = sel;
    const twoMin = takeTwoMin(player);
    const canTwo = colors.length === 1 && G.bank[colors[0]] >= twoMin;
    const available = COLORS.filter(c => G.bank[c] > 0).length;
    const canThree = colors.length >= Math.min(3, available);
    const after = have + (canTwo && !canThree ? 2 : colors.length);
    content = (
      <>
        拿 {colors.map(c => <Icon key={c} type={c} />)}？
        <button className="primary" disabled={!canThree} onClick={() => act(moves.takeThree, colors)}>
          拿这 {colors.length} 个
        </button>
        {colors.length === 1 && (
          <button className="primary" disabled={!canTwo} title={canTwo ? '' : `这种调料桌上至少剩 ${twoMin} 个才能拿 2 个`}
                  onClick={() => act(moves.takeTwo, colors[0])}>
            拿 2 个{TOKEN_INFO[colors[0]].name}
          </button>
        )}
        <button onClick={cancel}>取消</button>
        {!canThree && !canTwo && <span className="status-hint">不同颜色要选满 3 种</span>}
        {after > limit && (
          <span className="status-hint warn">冰箱已有 {have}/{limit}，拿完要扔掉 {after - limit} 个</span>
        )}
      </>
    );
  } else if (sel?.kind === 'card' || sel?.kind === 'reserved') {
    const card = sel.kind === 'card' ? G.market[sel.tier][sel.slot] : player.reserved[sel.index];
    const affordable = payment(player, card, extraCost);
    const short = shortfall(player, card, extraCost);
    const canReserve = player.reserved.length < maxReserved(player);
    content = (
      <>
        <b>{card.name}</b>
        <button className="primary" disabled={!affordable}
                onClick={() => sel.kind === 'card' ? act(moves.buy, sel.tier, sel.slot) : act(moves.buyReserved, sel.index)}>
          买
        </button>
        {sel.kind === 'card' && (
          <button disabled={!canReserve} onClick={() => act(moves.reserve, sel.tier, sel.slot)}>
            预订（拿 1 个高汤）
          </button>
        )}
        <button onClick={cancel}>取消</button>
        {!affordable && (
          <span className="status-hint">
            还差 {short} 个调料
          </span>
        )}
        {sel.kind === 'card' && !canReserve && <span className="status-hint">预订已满 {maxReserved(player)} 张</span>}
      </>
    );
  } else if (sel?.kind === 'deck') {
    content = (
      <>
        从 {sel.tier} 级牌堆顶摸一张预订？摸之前看不到是什么，同时拿 1 个高汤
        <button className="primary" onClick={() => act(moves.reserveFromDeck, sel.tier)}>摸牌预订</button>
        <button onClick={cancel}>取消</button>
      </>
    );
  } else {
    content = <>{name} 必须行动：点调料拿调料，或点一张食谱买 / 预订</>;
  }

  // 恶魔留下的提示：刚发生的效果（上一回合或这一回合），以及仍在生效的涨价
  const notes = [];
  if (G.lastEvent && G.lastEvent.turn >= ctx.turn - 1) notes.push(G.lastEvent.text);
  if (G.priceHike && extraCost) {
    notes.push(`涨价中：买食谱多付 1 个（还剩 ${G.priceHike.roundsLeft} 轮，${seatOf(G.priceHike.by)}的回合开始时减 1）`);
  }

  return (
    <header className="status">
      <span className="status-title">主厨餐桌</span>
      <div className="status-main">
        {content}
        {notes.map(n => <span key={n} className="status-note">{n}</span>)}
      </div>
      {G.endTriggered && <span className="final-round">最后一轮！</span>}
    </header>
  );
}

// ---------- 市场：三行，每行左边是牌堆 ----------
function Market({ G, me, player, sel, active, select }) {
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
function Bank({ G, sel, active, toggle }) {
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
function Chefs({ G, player, moves, choosing }) {
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

// ---------- 右侧：所有玩家 ----------
function Sidebar({ G, ctx, me, stage, sel, active, select, moves, names, online }) {
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

// ---------- 联网：等所有人进房间 ----------
function WaitingRoom({ matchData, matchID, me }) {
  const link = `${window.location.origin}${window.location.pathname}?room=${matchID}`;
  const joined = matchData.filter(m => m.name).length;
  return (
    <div className="board">
      <section className="panel lobby">
        <h1>等人入座（{joined} / {matchData.length}）</h1>
        <p>把房间号或链接发给朋友，他们用同一个密码加入：</p>
        <p className="room-code">{matchID}</p>
        <div className="row">
          <button onClick={() => navigator.clipboard?.writeText(link)}>复制邀请链接</button>
        </div>
        <ul className="seat-list">
          {matchData.map(m => (
            <li key={m.id}>
              {SEAT_NAMES[m.id]}：{m.name ? <b>{m.name}{String(m.id) === me && '（你）'}</b> : <span className="muted">空位</span>}
            </li>
          ))}
        </ul>
        <p className="muted small">人齐了自动开始。</p>
      </section>
    </div>
  );
}

// ---------- 底部信息栏 ----------
function InfoBar() {
  const openHelp = useContext(HelpContext);
  const leave = useContext(LeaveContext);
  return (
    <footer className="infobar">
      <span className="infobar-title">主厨餐桌 · Splendor 改版</span>
      <button className="link" onClick={openHelp}>怎么玩？</button>
      {leave && <button className="link" onClick={() => window.confirm('离开这一局，回到首页？') && leave()}>离开这一局</button>}
    </footer>
  );
}

// ---------- 开局：挑家常菜 + 座位补偿 ----------
function DraftPanel({ G, moves, seat }) {
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

// ---------- 结算 ----------
function GameOver({ result }) {
  return (
    <div className="board">
      <section className="panel gameover">
        <h1>游戏结束</h1>
        <p>获胜：{result.winners.map(id => SEAT_NAMES[Number(id)]).join('、')}</p>
        <table>
          <thead><tr><th>名次</th><th>座位</th><th>口碑</th><th>菜</th><th>恶魔</th></tr></thead>
          <tbody>
            {result.ranking.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td>{SEAT_NAMES[Number(r.id)]}</td>
                <td>{r.score}</td><td>{r.cards}</td><td>{r.devils}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
