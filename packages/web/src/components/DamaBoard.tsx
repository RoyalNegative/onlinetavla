// Türk Daması board: 8x8 SVG, click-to-move, flips for the black player.
//
// Move legibility (both players): the last move stays highlighted until you
// reply — its origin, destination and every captured square are marked — so
// when it becomes your turn you can always see what the opponent just played
// (a two- or three-piece capture especially). While it's your turn, every
// capture target also shows how many pieces it takes (×N) and hovering one
// lights up exactly which pieces that move removes and the path it travels.

import { useEffect, useMemo, useState } from 'react';
import type { DamaMove, DamaView } from '@tavla/engine';
import { HitMark } from './Board';

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
  const [hoverTarget, setHoverTarget] = useState<number | null>(null);

  const screen = (i: number) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const drow = flip ? row : 7 - row;
    const dcol = flip ? 7 - col : col;
    return { x: dcol * CELL, y: drow * CELL };
  };
  const center = (i: number) => {
    const { x, y } = screen(i);
    return { cx: x + CELL / 2, cy: y + CELL / 2 };
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

  useEffect(() => {
    if (hoverTarget !== null && !targets.has(hoverTarget)) setHoverTarget(null);
  }, [targets, hoverTarget]);

  // Enemy pieces capturable this turn — surfaced in red.
  const capturable = useMemo(() => {
    const set = new Set<number>();
    for (const m of moves) for (const c of m.captures) set.add(c);
    return set;
  }, [moves]);

  // The capture target under the pointer, previewed before you commit.
  const previewMove = hoverTarget !== null ? targets.get(hoverTarget) ?? null : null;
  // The last move played — kept on the board until the next move.
  const last = view.lastMove;

  const pointsOf = (m: DamaMove) =>
    [m.from, ...m.captures, m.to]
      .map((i) => {
        const c = center(i);
        return `${c.cx},${c.cy}`;
      })
      .join(' ');

  function play(m: DamaMove) {
    onAction({ type: 'move', move: m });
    setSelected(null);
    setHoverTarget(null);
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
          const takes = isTarget ? targets.get(i)!.captures.length : 0;
          return (
            <g key={i}>
              <rect x={x} y={y} width={CELL} height={CELL} fill={light ? '#e9dcc0' : '#9c5a32'} />
              {isSel && <rect x={x + 2} y={y + 2} width={CELL - 4} height={CELL - 4} fill="none" stroke="#f2894f" strokeWidth="4" />}
              {isTarget && (
                <circle cx={x + CELL / 2} cy={y + CELL / 2} r="13" fill={takes ? '#ff4d6d' : '#f2894f'}>
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              {/* how many pieces this capture takes — clearest on double+ jumps */}
              {takes >= 2 && (
                <text
                  x={x + CELL * 0.79}
                  y={y + CELL * 0.3}
                  textAnchor="middle"
                  fontSize="28"
                  fontWeight="900"
                  fill="#fde68a"
                  stroke="#0c1118"
                  strokeWidth="5"
                  style={{ paintOrder: 'stroke' }}
                >
                  ×{takes}
                </text>
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
              <circle cx={cx} cy={cy} r={R} fill={white ? WHITE_BG : BLACK_BG} stroke="rgba(0,0,0,0.4)" strokeWidth="2" />
              {king && (
                <text x={cx} y={cy + 9} textAnchor="middle" fontSize="30" fill={white ? '#7a5a1e' : '#f5d98a'}>
                  ★
                </text>
              )}
              {capturable.has(i) && <HitMark x={cx} y={cy} r={R} />}
            </g>
          );
        })}

        {/* last move: kept until you reply, so the opponent's move stays
            readable — origin (dashed), landing (solid) and captured squares.
            Flashes brighter for a moment when it first appears. */}
        {last && (
          <g key={view.moveSeq} className="dama-lastmove" pointerEvents="none">
            <MovePath points={pointsOf(last)} />
            <SquareOutline i={last.from} screen={screen} dashed />
            <SquareOutline i={last.to} screen={screen} />
            {last.captures.map((c) => {
              const { cx, cy } = center(c);
              return <CapturedMark key={c} x={cx} y={cy} r={R} />;
            })}
          </g>
        )}

        {/* hover preview: the path and the exact pieces this move would take */}
        {interactive && previewMove && previewMove.captures.length > 0 && (
          <g pointerEvents="none">
            <MovePath points={pointsOf(previewMove)} animated />
            {previewMove.captures.map((c) => {
              const { cx, cy } = center(c);
              return (
                <circle key={c} cx={cx} cy={cy} r={R + 6} fill="none" stroke="#fbbf24" strokeWidth={4}>
                  <animate attributeName="opacity" values="0.5;1;0.5" dur="0.8s" repeatCount="indefinite" />
                </circle>
              );
            })}
          </g>
        )}

        {/* click layer */}
        {interactive &&
          Array.from({ length: 64 }, (_, i) => {
            const { x, y } = screen(i);
            return (
              <rect
                key={`h${i}`}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => clickCell(i)}
                onPointerEnter={() => setHoverTarget(targets.has(i) ? i : null)}
                onPointerLeave={() => setHoverTarget((h) => (h === i ? null : h))}
              />
            );
          })}
      </svg>
    </div>
  );
}

// A capture route drawn source → each eaten piece → landing: a dark halo under
// an amber line, so the direction of a multi-jump is obvious. `animated` adds
// the marching dash (used for the live hover preview, not the resting trail).
function MovePath({ points, animated }: { points: string; animated?: boolean }) {
  return (
    <>
      <polyline points={points} fill="none" stroke="#0c1118" strokeWidth={11} strokeOpacity={0.5} strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={points} fill="none" stroke="#f2894f" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="14 10">
        {animated && <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="0.6s" repeatCount="indefinite" />}
      </polyline>
    </>
  );
}

// Where a piece was captured on the last move: an amber ✕ (distinct from the
// red "you can capture this" marks) left in place until the next move.
function CapturedMark({ x, y, r }: { x: number; y: number; r: number }) {
  const a = r * 0.52;
  return (
    <g>
      <g stroke="#0c1118" strokeWidth={9} strokeLinecap="round" opacity={0.55}>
        <line x1={x - a} y1={y - a} x2={x + a} y2={y + a} />
        <line x1={x - a} y1={y + a} x2={x + a} y2={y - a} />
      </g>
      <g stroke="#f2894f" strokeWidth={5} strokeLinecap="round">
        <line x1={x - a} y1={y - a} x2={x + a} y2={y + a} />
        <line x1={x - a} y1={y + a} x2={x + a} y2={y - a} />
      </g>
    </g>
  );
}

function SquareOutline({ i, screen, dashed }: { i: number; screen: (i: number) => { x: number; y: number }; dashed?: boolean }) {
  const { x, y } = screen(i);
  return (
    <rect
      x={x + 3}
      y={y + 3}
      width={CELL - 6}
      height={CELL - 6}
      rx={6}
      fill="none"
      stroke="#f2894f"
      strokeWidth={4}
      strokeDasharray={dashed ? '10 8' : undefined}
    />
  );
}
