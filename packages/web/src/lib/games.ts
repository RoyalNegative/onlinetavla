// Per-game visual identity (title, accent color) shared by the home catalog,
// the room header and the board's ambient glow. The mark itself lives in
// <GameGlyph> — each game is drawn, not represented by an emoji.

export interface GameMeta {
  title: string;
  /** Short lowercase descriptor shown next to the title. */
  sub: string;
  /** Accent hex — used at low alpha for glyph fills, tiles and board glows. */
  tint: string;
}

// A muted, coherent set: every tint sits at roughly the same lightness and
// saturation so seven of them can share a page without shouting. Bright
// off-the-shelf palette colors are a big part of what makes a UI look generic.
export const GAME_META: Record<string, GameMeta> = {
  tavla: { title: 'Tavla', sub: 'backgammon', tint: '#4e9e7a' },
  dama: { title: 'Dama', sub: 'Türk daması', tint: '#c98a3e' },
  amiral: { title: 'Amiral Battı', sub: 'deniz savaşı', tint: '#5b9dc9' },
  mangala: { title: 'Mangala', sub: 'Türk zekâ oyunu', tint: '#c97b54' },
  dortlu: { title: "4'ü Bağla", sub: 'dörtlü sıra', tint: '#d2564f' },
  satranc: { title: 'Satranç', sub: 'chess', tint: '#9a93a8' },
  secrethitler: { title: 'Secret Hitler', sub: '5–10 kişi · ekipçe', tint: '#a3465c' },
};
