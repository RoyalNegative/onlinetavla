// Türk Daması board: 8x8 SVG, click-to-move, flips for the black player.

import { useEffect, useMemo, useState } from 'react';
import type { DamaMove, DamaView } from '@tavla/engine';

const VB = 800;
const CELL = VB / 8;
const R = CELL * 0.36;

const WHITE_BG = 'url(#dwchk)';
const BLACK_BG = 'url(#dbchk)';

interface Props {
  view: DamaView;
  interactive: boolean;
  onAction: (a: { type: 'move'; move: DamaMove }) => void;
}

export function DamaBoard({ view, interactive, onAction }: Props) {
  const flip = view.youAre === 'black';
  const [selected, setSelected] = useState<number | null>(null);

  const screen = (i: number) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const drow = flip ? row : 7 - row;
    const dcol = flip ? 7 - col : col;
    return { x: dcol * CELL, y: drow * CELL };
  };

  const moves = view.legalMoves;
  const sources = useMemo(() => new Set(moves.map((m) => m.from)), [moves]);
  useEffect(() => {
    if (selected !== null && !sources.has(selected)) setSelected(null);
  }, [sources, selected]);

  const targets = useMemo(() => {
    const map = new Map<number, DamaMove>();
    if (selected !== null) {
      for (const m of moves) {
        if (m.from !== selected) continue;
        const prev = map.get(m.to);
        if (!prev || m.captures.length > prev.captures.length) map.set(m.to, m);
      }
    }
    return map;
  }, [moves, selected]);

  // Enemy pieces capturable this turn — surfaced in red.
  const capturable = useMemo(() => {
    const set = new Set<number>();
    for (const m of moves) for (const c of m.captures) set.add(c);
    return set;
  }, [moves]);

  function play(m: DamaMove) {
    onAction({ type: 'move', move: m });
    setSelected(null);
  }
  function clickCell(i: number) {
    if (!interactive) return;
    if (selected !== null && targets.has(i)) return play(targets.get(i)!);
    const fromMoves = moves.filter((m) => m.from === i);
    if (fromMoves.length === 1) play(fromMoves[0]);
    else if (fromMoves.length > 1) setSelected(i);
    else setSelected(null);
  }

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '1 / 1' }}>
      <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 h-full w-full rounded-xl">
        <defs>
          <radialGradient id="dwchk" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fffdf5" />
            <stop offset="65%" stopColor="#efe2c0" />
            <stop offset="100%" stopColor="#cdb98a" />
          </radialGradient>
          <radialGradient id="dbchk" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#4a3a2c" />
            <stop offset="60%" stopColor="#2c2017" />
            <stop offset="100%" stopColor="#160f0a" />
          </radialGradient>
        </defs>

        {/* squares */}
        {Array.from({ length: 64 }, (_, i) => {
          const { x, y } = screen(i);
          const row = Math.floor(i / 8);
          const col = i % 8;
          const light = (row + col) % 2 === 0;
          const isTarget = interactive && targets.has(i);
          const isSel = selected === i;
          return (
            <g key={i}>
              <rect x={x} y={y} width={CELL} height={CELL} fill={light ? '#e9dcc0' : '#9c5a32'} />
              {isSel && <rect x={x + 2} y={y + 2} width={CELL - 4} height={CELL - 4} fill="none" stroke="#f5b14c" strokeWidth="4" />}
              {isTarget && (
                <circle cx={x + CELL / 2} cy={y + CELL / 2} r="13" fill={targets.get(i)!.captures.length ? '#f87171' : '#f5b14c'}>
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* pieces */}
        {Array.from({ length: 64 }, (_, i) => {
          const v = view.board[i];
          if (v === 0) return null;
          const { x, y } = screen(i);
          const cx = x + CELL / 2;
          const cy = y + CELL / 2;
          const white = v > 0;
          const king = Math.abs(v) === 2;
          return (
            <g key={`p${i}`}>
              {capturable.has(i) && (
                <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke="#f87171" strokeWidth="4">
                  <animate attributeName="opacity" values="0.35;1;0.35" dur="0.9s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={cx} cy={cy} r={R} fill={white ? WHITE_BG : BLACK_BG} stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
              {king && (
                <text x={cx} y={cy + 9} textAnchor="middle" fontSize="30" fill={white ? '#7a5a1e' : '#f5d98a'}>
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* click layer */}
        {interactive &&
          Array.from({ length: 64 }, (_, i) => {
            const { x, y } = screen(i);
            return <rect key={`h${i}`} x={x} y={y} width={CELL} height={CELL} fill="transparent" className="cursor-pointer" onClick={() => clickCell(i)} />;
          })}
      </svg>
    </div>
  );
}
