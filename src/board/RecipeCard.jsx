import { COLORS } from '../game/constants.js';
import { TOKEN_INFO } from './labels.js';

// 一张食谱卡：左上口碑、右上折扣调料（只有图，名字在鼠标提示里）、中间菜名、左下价格；可点选
// anchor：给飞行动画定位用的名字（见 Flights.jsx）
export function RecipeCard({ card, dim, compact, selected, onClick, anchor }) {
  if (!card) return <div className="card empty" data-anchor={anchor}>空位</div>;
  const bonus = TOKEN_INFO[card.bonus];
  return (
    <div className={`card tier-${card.tier} ${dim ? 'dim' : ''} ${compact ? 'compact' : ''} ${selected ? 'selected' : ''} ${onClick ? 'clickable' : ''}`}
         style={{ '--bonus': bonus.color, '--bonus-text': bonus.text, '--tint': bonus.tint ?? bonus.color }} data-anchor={anchor}
         onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}
         onKeyDown={onClick ? e => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}>
      <div className="card-top">
        <span className="card-points">{card.points || ''}</span>
        <span className="card-bonus" title={`做出来后永久少付 1 个${bonus.name}`}>
          <img src={bonus.icon} alt={bonus.name} />
        </span>
      </div>
      <div className="card-name">{card.name}</div>
      <div className="card-bottom">
        <div className="card-cost">
          {COLORS.filter(c => card.cost[c]).map(c => (
            <span key={c} className="cost-pip" title={`${TOKEN_INFO[c].name} ×${card.cost[c]}`}
                  style={{ background: TOKEN_INFO[c].color, color: TOKEN_INFO[c].text }}>
              {card.cost[c]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
