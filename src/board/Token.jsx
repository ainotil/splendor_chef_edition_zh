import { TOKEN_INFO } from './labels.js';

// 一摞最多画几层（含最上面这枚），每层多高
const MAX_LAYERS = 10;
const LAYER_PX = 3;

// 一摞的侧面：每层一条深色边 + 一条白缝。层数不变（多出的藏在代币后面），
// 这样数量变化时 box-shadow 能平滑过渡，一摞看起来是慢慢变高 / 变矮
function stackShadow(layers) {
  const parts = [];
  for (let i = 1; i < MAX_LAYERS; i++) {
    const y = i < layers ? i * LAYER_PX : 0;
    parts.push(`0 ${Math.max(y - 1, 0)}px 0 var(--edge)`, `0 ${y}px 0 #fff`);
  }
  const depth = (Math.max(layers, 1) - 1) * LAYER_PX;
  parts.push(`0 ${depth + 4}px 8px rgba(0,0,0,.35)`);
  return parts.join(', ');
}

// 一个圆形代币：水彩图 + 数量；stack 时按数量画成一摞（底部固定，越多越高）
export function Token({ type, count, onClick, selected, small, stack, anchor }) {
  const info = TOKEN_INFO[type];
  const layers = Math.min(count ?? 0, MAX_LAYERS);
  const style = { '--c': info.color };
  if (stack) {
    style['--lift'] = `${(Math.max(layers, 1) - 1) * LAYER_PX}px`;
    style.boxShadow = stackShadow(layers);
  }
  return (
    <button
      className={`token ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${stack ? 'stack' : ''} ${stack && !count ? 'empty' : ''}`}
      data-anchor={anchor}
      style={style}
      onClick={onClick}
      disabled={!onClick}
      title={info.name}
      aria-label={count === undefined ? info.name : `${info.name} ${count} 个`}
    >
      <img className="token-icon" src={info.icon} alt="" draggable="false" />
      {count !== undefined && <span className="token-count">{count}</span>}
    </button>
  );
}
