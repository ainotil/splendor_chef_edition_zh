import { COLORS } from '../game/constants.js';
import { bonuses, tokenCount, payment, eligibleChefs, fridgeLimit, maxReserved, takeTwoMin, surcharge } from '../game/state.js';
import { TOKEN_INFO, SEAT_NAMES } from './labels.js';

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
export function StatusBar({ G, ctx, me, player, stage, sel, myTurn, online, connected, moves, undo, act, cancel }) {
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
