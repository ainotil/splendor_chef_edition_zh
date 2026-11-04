import { useContext, useEffect, useState } from 'react';
import { SEAT_NAMES } from './labels.js';
import { LeaveContext } from './helpContext.js';
import { getRoom, leaveRoom, dissolveRoom, explain, loadSession } from '../online.js';

// 不在牌桌上的整页画面：联网等人入座、终局结算

// ---------- 联网：等所有人进房间 ----------
// 房主（1 号位）可以解散房间，其他人可以离开（让出座位）。
// 每隔几秒向服务器查一次房间：有人离开时座位及时变空；房间被解散了就回首页
const POLL_MS = 4000;

export function WaitingRoom({ matchData, matchID, me }) {
  const leave = useContext(LeaveContext);
  const [players, setPlayers] = useState(null);   // 服务器上最新的座位；没查到前用 matchData
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const host = me === '0';
  const seats = players ?? matchData;
  const link = `${window.location.origin}${window.location.pathname}?room=${matchID}`;
  const joined = seats.filter(m => m.name).length;

  useEffect(() => {
    const { password } = loadSession() ?? {};
    const timer = setInterval(async () => {
      try {
        setPlayers((await getRoom(password, matchID)).players);
      } catch (e) {
        if (String(e?.message).includes('404')) {
          clearInterval(timer);
          window.alert('房主解散了这个房间');
          leave();
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [matchID, leave]);

  async function quit() {
    if (!window.confirm(host ? '解散这个房间？已经进来的人都会被请回首页。' : '离开这个房间？你的座位会空出来。')) return;
    const { password, credentials } = loadSession() ?? {};
    setBusy(true);
    setError('');
    try {
      await (host ? dissolveRoom : leaveRoom)(password, matchID, me, credentials);
      leave();
    } catch (e) {
      const text = String(e?.message);
      if (text.includes('404')) leave();                   // 房间已经没了，直接回首页
      else setError(text.includes('409') ? '人已到齐，游戏已经开始，不能解散' : explain(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="board">
      <section className="panel lobby">
        <h1>等人入座（{joined} / {seats.length}）</h1>
        <p>把房间号或链接发给朋友，他们用同一个密码加入：</p>
        <p className="room-code">{matchID}</p>
        <div className="row">
          <button onClick={() => navigator.clipboard?.writeText(link)}>复制邀请链接</button>
        </div>
        <ul className="seat-list">
          {seats.map(m => (
            <li key={m.id}>
              {SEAT_NAMES[m.id]}：{m.name ? <b>{m.name}{String(m.id) === me && '（你）'}</b> : <span className="muted">空位</span>}
            </li>
          ))}
        </ul>
        <p className="muted small">人齐了自动开始。</p>
        <div className="row">
          <button disabled={busy} onClick={quit}>{host ? '解散房间' : '离开房间'}</button>
        </div>
        {error && <p className="warn">{error}</p>}
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
