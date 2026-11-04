import { SEAT_NAMES } from './labels.js';

// 不在牌桌上的整页画面：联网等人入座、终局结算

// ---------- 联网：等所有人进房间 ----------
export function WaitingRoom({ matchData, matchID, me }) {
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

// ---------- 结算 ----------
export function GameOver({ result }) {
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
