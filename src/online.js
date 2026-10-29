import { LobbyClient } from 'boardgame.io/client';
import { ChefsTable } from './game/game.js';

// 联网服务器地址：打包时由环境变量 VITE_SERVER_URL 给出（见 README 的部署一节）。
// 没配置时整个联网功能隐藏，只能同屏玩
export const SERVER = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, '') ?? '';
export const GAME = ChefsTable.name;

const lobby = SERVER ? new LobbyClient({ server: SERVER }) : null;

// 每个请求都带上房间密码（服务器的 API_SECRET）
const withPassword = password => ({ headers: { 'api-secret': password } });

// 把服务器的错误翻译成人话
export function explain(error) {
  const text = String(error?.message ?? error);
  if (text.includes('403')) return '密码不对';
  if (text.includes('404')) return '没有这个房间（房间号写错了，或者服务器重启后房间没了）';
  if (text.includes('409')) return '这个座位已经有人了，换一个';
  if (text.includes('Failed to fetch') || text.includes('NetworkError')) return '连不上服务器。免费服务器睡着时要等半分钟左右才醒，稍后再试';
  return text;
}

export async function createRoom(password, numPlayers) {
  const { matchID } = await lobby.createMatch(GAME, { numPlayers, unlisted: true }, withPassword(password));
  return matchID;
}

export async function getRoom(password, matchID) {
  return lobby.getMatch(GAME, matchID, withPassword(password));
}

export async function joinRoom(password, matchID, playerID, playerName) {
  const { playerCredentials } = await lobby.joinMatch(GAME, matchID, { playerID, playerName }, withPassword(password));
  return playerCredentials;
}

// 叫醒睡着的免费服务器（不需要密码）
export function wakeServer() {
  if (SERVER) fetch(`${SERVER}/health`, { mode: 'no-cors' }).catch(() => {});
}

// 记住上一局：刷新页面或断线后能直接回到座位
const KEY = 'chefs-table:session';
export function saveSession(session) {
  try { localStorage.setItem(KEY, JSON.stringify(session)); } catch { /* 隐私模式等：不记也能玩 */ }
}
export function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
}
