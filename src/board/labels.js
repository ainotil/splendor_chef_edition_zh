import sugar from '../assets/seasonings/sugar.webp';
import soy from '../assets/seasonings/soy.webp';
import chili from '../assets/seasonings/chili.webp';
import peppercorn from '../assets/seasonings/peppercorn.webp';
import vinegar from '../assets/seasonings/vinegar.webp';
import stock from '../assets/seasonings/stock.webp';

// 界面显示用：代币的中文名、颜色和图（由 scripts/import-seasoning-art.py 从素材包导入）
// tint：食谱卡背景渐变用的颜色（不写就用 color）。酱油本色太黑、糖本色太白，渐变出来看不出颜色
export const TOKEN_INFO = {
  sugar:      { name: '糖',   color: '#f4f1ea', text: '#333', icon: sugar, tint: '#8e959e' },
  soy:        { name: '酱油', color: '#3b2a20', text: '#fff', icon: soy, tint: '#9a5b2a' },
  chili:      { name: '辣椒', color: '#c8372d', text: '#fff', icon: chili },
  peppercorn: { name: '花椒', color: '#4e8a3e', text: '#fff', icon: peppercorn },
  vinegar:    { name: '醋',   color: '#2f5d9e', text: '#fff', icon: vinegar },
  stock:      { name: '高汤', color: '#d9a62b', text: '#333', icon: stock },
};

export const SEAT_NAMES = ['1 号位', '2 号位', '3 号位', '4 号位', '5 号位'];
