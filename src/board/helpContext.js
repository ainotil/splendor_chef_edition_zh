import { createContext } from 'react';

// 打开新手教程：App 提供，棋盘底栏的"怎么玩？"调用
export const HelpContext = createContext(() => {});

// 离开这一局回到首页：App 提供（不在游戏里时为 null），棋盘底栏调用
export const LeaveContext = createContext(null);
