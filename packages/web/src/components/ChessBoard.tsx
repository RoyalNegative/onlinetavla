// Satranç board: 8x8 SVG, click-to-select then click-to-move, flips for the
// black player. Pieces are the filled Unicode glyphs, tinted by colour with a
// contrasting outline so they read on either square. Highlights: last move,
// the king in check, the selected piece and its legal targets. A pawn reaching
// the back rank opens a small promotion picker.

import { useEffect, useMemo, useState } from 'react';
import type { ChessAction, ChessView } from '@tavla/engine';

const VB = 800;
const CELL = VB / 8;

const LIGHT = '#e9d6ac';
const DARK = '#a5713f';

const GLYPH: Record<number, string> = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
const PROMO_CODE: Record<'q' | 'r' | 'b' | 'n', number> = { q: 5, r: 4, b: 3, n: 2 };

function pieceFill(white: boolean) {
  return white ? '#f6f1e6' : '#2a2a30';
}
function pieceStroke(white: boolean) {
  return white ? '#4a3a24' : '#d9dde3';
}

interface Props {
  view: ChessView;
  interactive: boolean;
  onAction: (a: ChessAction) => void;
}

export function ChessBoard({ view, interactive, onAction }: Props) {
  const flip = view.youAre === 'black';
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ from: number; to: number } | null>(null);

  const screen = (i: number) => {
    const r = Math.floor(i / 8);
    const f = i % 8;
    const drow = flip ? r : 7 - r;
    const dcol = flip ? 7 - f : f;
    return { x: dcol * CELL, y: drow * CELL };
  };

  const moves = view.legalMoves;
  const sources = useMemo(() => new Set(moves.map((m) => m.from)), [moves]);
  useEffect(() => {
    if (selected !== null && !sources.has(selected)) setSelected(null);
  }, [sources, selected]);
  useEffect(() => {
    setPending(null);
    setSelected(null);
  }, [view.moveSeq]);

  const targetMap = useMemo(() => {
    const map = new Map<number, { capture: boolean; promo: boolean }>();
    if (selected !== null) {
      for (const m of moves) {
        if (m.from !== selected) continue;
        const capture = view.board[m.to] !== 0 || m.flag === 'ep';
        const prev = map.get(m.to);
        map.set(m.to, { capture: (prev?.capture ?? false) || capture, promo: (prev?.promo ?? false) || !!m.promo });
      }
    }
    return map;
  }, [moves, selected, view.board]);

  function play(a: { from: number; to: number; promo?: 'q' | 'r' | 'b' | 'n' }) {
    onAction({ type: 'move', ...a });
    setSelected(null);
    setPending(null);
  }
  function clickSquare(i: number) {
    if (!interactive) return;
    if (selected !== null) {
      const t = targetMap.get(i);
      if (t) {
        if (t.promo) setPending({ from: selected, to: i });
        else play({ from: selected, to: i });
        return;
      }
    }
    setSelected(sources.has(i) ? i : null);
  }

  const last = view.lastMove;

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '1 / 1' }}>
      <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 h-full w-full rounded-xl">
        {/* squares + highlights */}
        {Array.from({ length: 64 }, (_, i) => {
          const { x, y } = screen(i);
          const r = Math.floor(i / 8);
          const f = i % 8;
          const light = (r + f) % 2 === 1;
          const isLast = !!last && (last.from === i || last.to === i);
          const isCheck = view.checkSquare === i;
          const isSel = selected === i;
          const tgt = interactive ? targetMap.get(i) : undefined;
          return (
            <g key={i}>
              <rect x={x} y={y} width={CELL} height={CELL} fill={light ? LIGHT : DARK} />
              {isLast && <rect x={x} y={y} width={CELL} height={CELL} fill="#f5b14c" opacity={0.34} />}
              {isCheck && <rect x={x} y={y} width={CELL} height={CELL} fill="#ef4444" opacity={0.42} />}
              {isSel && <rect x={x + 2.5} y={y + 2.5} width={CELL - 5} height={CELL - 5} fill="none" stroke="#f5b14c" strokeWidth="5" />}
              {tgt && !tgt.capture && (
                <circle cx={x + CELL / 2} cy={y + CELL / 2} r="12" fill="#f5b14c" opacity="0.85">
                  <animate attributeName="opacity" values="0.45;0.95;0.45" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              {tgt && tgt.capture && (
                <circle cx={x + CELL / 2} cy={y + CELL / 2} r={CELL / 2 - 6} fill="none" stroke="#f87171" strokeWidth="5" opacity="0.9">
                  <animate attributeName="opacity" values="0.5;1;0.5" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          );
        })}

        {/* pieces */}
        {Array.from({ length: 64 }, (_, i) => {
          const p = view.board[i];
          if (p === 0) return null;
          const { x, y } = screen(i);
          const white = p > 0;
          return (
            <text
              key={`p${i}`}
              x={x + CELL / 2}
              y={y + CELL / 2 + 4}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={CELL * 0.78}
              fill={pieceFill(white)}
              stroke={pieceStroke(white)}
              strokeWidth={6}
              style={{ paintOrder: 'stroke' }}
            >
              {GLYPH[Math.abs(p)]}
            </text>
          );
        })}

        {/* click layer */}
        {interactive &&
          Array.from({ length: 64 }, (_, i) => {
            const { x, y } = screen(i);
            return <rect key={`h${i}`} x={x} y={y} width={CELL} height={CELL} fill="transparent" className="cursor-pointer" onClick={() => clickSquare(i)} />;
          })}
      </svg>

      {pending && (
        <PromoPicker white={view.youAre === 'white'} onPick={(promo) => play({ from: pending.from, to: pending.to, promo })} onCancel={() => setPending(null)} />
      )}

      {view.over && view.reason && <div className="pointer-events-none absolute inset-x-0 top-2 grid place-items-center"><span className="rounded-full bg-black/70 px-3 py-1 text-sm font-bold text-white shadow-lg ring-1 ring-white/15">{reasonText(view.reason, view.winner)}</span></div>}
    </div>
  );
}

function reasonText(reason: NonNullable<ChessView['reason']>, winner: ChessView['winner']): string {
  switch (reason) {
    case 'checkmate':
      return `♚ Şah mat — ${winner === 'white' ? 'Beyaz' : 'Siyah'} kazandı`;
    case 'stalemate':
      return 'Pat — berabere';
    case 'insufficient':
      return 'Yetersiz materyal — berabere';
    case 'fifty':
      return '50 hamle kuralı — berabere';
    case 'threefold':
      return 'Üç tekrar — berabere';
    case 'resign':
      return 'Teslim oldu';
  }
}

function PromoPicker({ white, onPick, onCancel }: { white: boolean; onPick: (p: 'q' | 'r' | 'b' | 'n') => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/55" onClick={onCancel}>
      <div className="card flex gap-1.5 p-2" onClick={(e) => e.stopPropagation()}>
        {(['q', 'r', 'b', 'n'] as const).map((p) => (
          <button
            key={p}
            onClick={() => onPick(p)}
            className="grid h-14 w-14 place-items-center rounded-xl bg-white/5 text-4xl leading-none hover:bg-amber-glow/20"
            style={{ color: pieceFill(white), WebkitTextStroke: `1.5px ${pieceStroke(white)}` }}
          >
            {GLYPH[PROMO_CODE[p]]}
          </button>
        ))}
      </div>
    </div>
  );
}
