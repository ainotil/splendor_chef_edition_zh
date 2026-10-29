import { useEffect, useState } from 'react';
import { ChefsTable } from '../game/game.js';
import { createRoom, getRoom, joinRoom, explain, wakeServer, loadSession } from '../online.js';
import { SEAT_NAMES } from './labels.js';

const PLAYER_COUNTS = [];
for (let n = ChefsTable.minPlayers; n <= ChefsTable.maxPlayers; n++) PLAYER_COUNTS.push(n);

// 联网大厅：输入密码和名字 → 建房（自动坐 1 号位）或用房间号加入并选座位
// 进房成功后调用 onEnter({ matchID, playerID, credentials, name })
export function OnlineLobby({ onEnter, onBack }) {
  const roomFromLink = new URLSearchParams(window.location.search).get('room') ?? '';
  const last = loadSession();
  const [password, setPassword] = useState(last?.password ?? '');
  const [name, setName] = useState(last?.name ?? '');
  const [numPlayers, setNumPlayers] = useState(ChefsTable.maxPlayers);
  const [roomID, setRoomID] = useState(roomFromLink);
  const [room, setRoom] = useState(null);       // 查到的房间：选座位用
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(wakeServer, []);   // 一打开大厅就叫醒服务器，等输完密码它也差不多醒了

  async function run(task) {
    setBusy(true);
    setError('');
    try { await task(); } catch (e) { setError(explain(e)); } finally { setBusy(false); }
  }

  const ready = password && name.trim();

  const create = () => run(async () => {
    const matchID = await createRoom(password, numPlayers);
    const credentials = await joinRoom(password, matchID, '0', name.trim());
    onEnter({ matchID, playerID: '0', credentials, name: name.trim(), password });
  });

  const lookUp = () => run(async () => setRoom(await getRoom(password, roomID.trim())));

  const take = seat => run(async () => {
    const matchID = roomID.trim();
    const credentials = await joinRoom(password, matchID, String(seat), name.trim());
    onEnter({ matchID, playerID: String(seat), credentials, name: name.trim(), password });
  });

  return (
    <div className="board">
      <section className="panel lobby online-lobby">
        <h1>联网对战</h1>

        <label className="field">房间密码
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="field">你的名字
          <input value={name} maxLength={12} onChange={e => setName(e.target.value)} />
        </label>

        <h2>开新房间</h2>
        <div className="row">
          {PLAYER_COUNTS.map(n => (
            <button key={n} className={n === numPlayers ? 'primary' : ''} onClick={() => setNumPlayers(n)}>{n} 人</button>
          ))}
          <button className="primary" disabled={!ready || busy} onClick={create}>建房间</button>
        </div>

        <h2>加入朋友的房间</h2>
        <div className="row">
          <input placeholder="房间号" value={roomID} onChange={e => { setRoomID(e.target.value); setRoom(null); }} />
          <button disabled={!ready || !roomID.trim() || busy} onClick={lookUp}>找房间</button>
        </div>
        {room && (
          <div className="row">
            {room.players.map(p => (
              <button key={p.id} disabled={!!p.name || busy} onClick={() => take(p.id)}>
                {SEAT_NAMES[p.id]}{p.name ? `：${p.name}` : '（空）'}
              </button>
            ))}
          </div>
        )}

        {busy && <p className="muted">连接服务器中…（免费服务器睡着时第一次要等半分钟左右）</p>}
        {error && <p className="warn">{error}</p>}
        <button className="link" onClick={onBack}>← 返回</button>
      </section>
    </div>
  );
}
