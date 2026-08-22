// Hand-drawn marks, one per game.
//
// The home screen used to identify each game with an emoji. Emoji render
// differently on every platform, carry someone else's drawing style, and are
// the single loudest "assembled quickly" signal in a UI. These are monoline
// marks on a shared 24px grid: same 1.5 stroke, same round joins, one solid
// element per mark tinted with the game's own accent.

import type { ReactElement } from 'react';
import { GAME_META } from '../lib/games';

interface Props {
  id: string;
  /** Rendered px size. The grid is designed for 20–40. */
  size?: number;
  /** Overrides the game's own accent for the solid element. */
  tint?: string;
  className?: string;
}

export function GameGlyph({ id, size = 24, tint, className }: Props) {
  const c = tint ?? GAME_META[id]?.tint ?? '#e0603a';
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {MARKS[id]?.(c) ?? MARKS.tavla(c)}
    </svg>
  );
}

const MARKS: Record<string, (c: string) => ReactElement> = {
  // Three board points and a checker — the shape you actually see on a tavla
  // board, rather than a pair of dice (which every dice game would share).
  tavla: (c) => (
    <>
      <path d="M3 3h4.6l-2.3 9z" fill="currentColor" fillOpacity={0.28} stroke="none" />
      <path d="M3 3h4.6l-2.3 9z" />
      <path d="M9.7 3h4.6l-2.3 9z" fill={c} stroke={c} />
      <path d="M16.4 3h4.6l-2.3 9z" fill="currentColor" fillOpacity={0.28} stroke="none" />
      <path d="M16.4 3h4.6l-2.3 9z" />
      <circle cx="12" cy="18.4" r="3.2" />
      <circle cx="12" cy="18.4" r="1.15" fill={c} stroke="none" />
    </>
  ),

  // A stack of discs seen from the side — reads as "checkers" instantly and
  // hints at the stacking that makes a piece a dama.
  dama: (c) => (
    <>
      <ellipse cx="12" cy="16.8" rx="7" ry="2.7" />
      <ellipse cx="12" cy="12.5" rx="7" ry="2.7" />
      <ellipse cx="12" cy="8.2" rx="7" ry="2.7" fill={c} stroke={c} />
      <path d="M5 16.8v-8.6M19 16.8v-8.6" />
    </>
  ),

  // The coordinate grid with a miss and a hit — the game is guessing on a
  // grid, not a picture of a boat.
  amiral: (c) => (
    <>
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="2.5" />
      <path d="M9.08 3.25v17.5M14.92 3.25v17.5M3.25 9.08h17.5M3.25 14.92h17.5" strokeOpacity={0.45} />
      <path d="m4.9 4.9 2.6 2.6m0-2.6-2.6 2.6" strokeWidth={1.7} />
      <circle cx="17.8" cy="17.8" r="1.7" fill={c} stroke="none" />
    </>
  ),

  // Three open pits with a stone dropping into the middle one.
  mangala: (c) => (
    <>
      <path d="M3.4 9.4v2.3a2.4 2.4 0 0 0 4.8 0V9.4" />
      <path d="M9.6 9.4v2.3a2.4 2.4 0 0 0 4.8 0V9.4" />
      <path d="M15.8 9.4v2.3a2.4 2.4 0 0 0 4.8 0V9.4" />
      <circle cx="5.8" cy="11" r="1.15" fill="currentColor" fillOpacity={0.5} stroke="none" />
      <circle cx="18.2" cy="11" r="1.15" fill="currentColor" fillOpacity={0.5} stroke="none" />
      <circle cx="12" cy="5.1" r="1.5" fill={c} stroke="none" />
      <path d="M2.6 16.6h18.8" strokeOpacity={0.4} />
    </>
  ),

  // Holes in a frame with the winning diagonal already filled.
  dortlu: (c) => (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="7.5" cy="8" r="1.9" strokeOpacity={0.5} />
      <circle cx="12" cy="8" r="1.9" strokeOpacity={0.5} />
      <circle cx="16.5" cy="8" r="1.9" fill={c} stroke="none" />
      <circle cx="7.5" cy="12" r="1.9" strokeOpacity={0.5} />
      <circle cx="12" cy="12" r="1.9" fill={c} stroke="none" />
      <circle cx="16.5" cy="12" r="1.9" strokeOpacity={0.5} />
      <circle cx="7.5" cy="16" r="1.9" fill={c} stroke="none" />
      <circle cx="12" cy="16" r="1.9" strokeOpacity={0.5} />
      <circle cx="16.5" cy="16" r="1.9" strokeOpacity={0.5} />
    </>
  ),

  // A pawn: the piece that opens every game.
  satranc: (c) => (
    <>
      <circle cx="12" cy="6.1" r="2.9" fill={c} stroke={c} />
      <path d="M10.1 9.3c.1 3-1.3 5.4-2.3 7.9h8.4c-1-2.5-2.4-4.9-2.3-7.9z" />
      <rect x="6.3" y="17.2" width="11.4" height="3.1" rx="1.35" />
    </>
  ),

  // A fedora — the game's own iconography, and unmistakably "hidden roles".
  secrethitler: (c) => (
    <>
      <path d="M6.6 15.4c-.1-4.2.4-7.2 1.5-8.6.9-1.1 5-1.1 5.9 0 1.1 1.4 1.6 4.4 1.5 8.6" />
      <path d="M6.6 13.6c-2.6.7-4.1 1.7-4.1 2.8C2.5 18.1 6.8 19.5 12 19.5s9.5-1.4 9.5-3.1c0-1.1-1.5-2.1-4.1-2.8" />
      <path d="M6.7 13.9c1.5.5 3.3.8 5.3.8s3.8-.3 5.3-.8" stroke={c} strokeWidth={2} />
    </>
  ),
};

// The app's own mark: a die tilted off-axis, with the pips reading 5 — enough
// character to work as a favicon-scale logo without being a literal emoji.
export function Wordmark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-11 12 12)">
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="4.6"
          fill="currentColor"
          fillOpacity={0.08}
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.4}
        />
        {[
          [8, 8],
          [16, 8],
          [12, 12],
          [8, 16],
          [16, 16],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.6} fill={i === 2 ? '#e0603a' : 'currentColor'} />
        ))}
      </g>
    </svg>
  );
}
