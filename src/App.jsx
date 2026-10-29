import { useState } from 'react';
import { Client } from 'boardgame.io/react';
import { SocketIO } from 'boardgame.io/multiplayer';
import { ChefsTable, setup } from './game/game.js';
import { rulesFor } from './game/constants.js';
import { Board } from './board/Board.jsx';
import { Help } from './board/Help.jsx';
import { OnlineLobby } from './board/OnlineLobby.jsx';
import { HelpContext, LeaveContext } from './board/helpContext.js';
import { SERVER, saveSession, loadSession, clearSession } from './online.js';

// 同屏：每种人数一个客户端，在模块加载时建好；同屏模式不隐藏信息
const HOTSEAT = { ...ChefsTable, setup: (ctx) => setup(ctx, { hotseat: true }) };
const GAMES = {};
for (let n = ChefsTable.minPlayers; n <= ChefsTable.maxPlayers; n++) {
  GAMES[n] = Client({ game: HOTSEAT, board: Board, numPlayers: n, debug: false });
}
const PLAYER_COUNTS = Object.keys(GAMES).map(Number);

// 联网：一个客户端，连到服务器；房间号、座位、凭证作为 props 传进去
const OnlineGame = SERVER
  ? Client({ game: ChefsTable, board: Board, multiplayer: SocketIO({ server: SERVER }), debug: false })
  : null;

// 首页 → 同屏（选人数）或联网（大厅 → 房间）
// 打开带 ?room= 的邀请链接时直接进联网大厅；刷新页面时回到上一局的座位
export default function App() {
  const linkRoom = new URLSearchParams(window.location.search).get('room');
  const last = loadSession();
  const [mode, setMode] = useState(() =>
    !SERVER ? 'home' : last?.credentials && (!linkRoom || linkRoom === last.matchID) ? 'online' : linkRoom ? 'lobby' : 'home');
  const [numPlayers, setNumPlayers] = useState(null);
  const [session, setSession] = useState(last);
  const [helpOpen, setHelpOpen] = useState(false);

  function enter(s) {
    saveSession(s);
    setSession(s);
    setMode('online');
  }
  function leave() {
    if (mode === 'online') {
      clearSession();
      saveSession({ name: session?.name, password: session?.password });   // 下次不用再输名字和密码
      window.history.replaceState(null, '', window.location.pathname);
    }
    setNumPlayers(null);
    setMode('home');
  }

  let screen;
  if (mode === 'online') {
    screen = <OnlineGame matchID={session.matchID} playerID={session.playerID} credentials={session.credentials} />;
  } else if (mode === 'lobby') {
    screen = <OnlineLobby onEnter={enter} onBack={() => setMode('home')} />;
  } else if (numPlayers) {
    const Game = GAMES[numPlayers];
    screen = <Game />;
  } else {
    screen = <Home onHotseat={setNumPlayers} onOnline={SERVER ? () => setMode('lobby') : null} />;
  }

  return (
    <HelpContext.Provider value={() => setHelpOpen(true)}>
      <LeaveContext.Provider value={mode === 'online' || numPlayers ? leave : null}>
        {screen}
        <Help open={helpOpen} setOpen={setHelpOpen} rules={rulesFor(numPlayers ?? ChefsTable.maxPlayers)} />
      </LeaveContext.Provider>
    </HelpContext.Provider>
  );
}

function Home({ onHotseat, onOnline }) {
  const [n, setN] = useState(ChefsTable.maxPlayers);
  return (
    <div className="board">
      <section className="panel lobby">
        <h1>主厨餐桌</h1>
        <h2>同屏：一台电脑轮流玩</h2>
        <div className="row">
          {PLAYER_COUNTS.map(count => (
            <button key={count} className={count === n ? 'primary' : ''} onClick={() => setN(count)}>
              {count} 人
            </button>
          ))}
        </div>
        {n < 5 && <p className="muted small">本改版按 5 人局设计，其他人数的数值按模拟推算。</p>}
        <button className="primary" onClick={() => onHotseat(n)}>开始同屏游戏</button>

        <h2>联网：各自用自己的电脑</h2>
        {onOnline
          ? <button className="primary" onClick={onOnline}>进入联网大厅</button>
          : <p className="muted small">这个版本没有配置联网服务器（VITE_SERVER_URL），只能同屏玩。</p>}
      </section>
    </div>
  );
}
