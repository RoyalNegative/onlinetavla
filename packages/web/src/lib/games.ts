// Per-game visual identity (title, icon, accent color) shared by the home
// catalog, the room header and the board's ambient glow.

export interface GameMeta {
  title: string;
  icon: string;
  tint: string; // accent hex — used at low alpha for tiles/glows
}

export const GAME_META: Record<string, GameMeta> = {
  tavla: { title: 'Tavla', icon: '🎲', tint: '#2a8466' },
  dama: { title: 'Dama', icon: '⛀', tint: '#d97706' },
  amiral: { title: 'Amiral Battı', icon: '🚢', tint: '#38bdf8' },
  mangala: { title: 'Mangala', icon: '🪨', tint: '#e0785a' },
  dortlu: { title: "4'ü Bağla", icon: '🔴', tint: '#f43f5e' },
  satranc: { title: 'Satranç', icon: '♟️', tint: '#94a3b8' },
  secrethitler: { title: 'Secret Hitler', icon: '🕵️', tint: '#be123c' },
};
