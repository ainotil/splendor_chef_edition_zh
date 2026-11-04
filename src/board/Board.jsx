import { useContext, useState } from 'react';
import { SEAT_NAMES } from './labels.js';
import { HelpContext, LeaveContext } from './helpContext.js';
import { Flights } from './Flights.jsx';
import { StatusBar } from './StatusBar.jsx';
import { DraftPanel, Market, Bank, Chefs } from './Table.jsx';
import { Sidebar } from './Sidebar.jsx';
import { WaitingRoom, GameOver } from './Screens.jsx';
import './board.css';

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
