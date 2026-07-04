// 4'ü Bağla board. Classic blue frame with punched holes; click (or hover)
// a column to drop. The newest disc falls in with a CSS animation and the
// winning four light up when the game ends.

import { useState } from 'react';
import type { DortluAction, DortluView } from '@tavla/engine';
import { DORTLU_COLS, DORTLU_ROWS } from '@tavla/engine';

const C = DORTLU_COLS;
const R = DORTLU_ROWS;

function discColor(seat: number): string {
  // seat 0 (white) = warm amber, seat 1 (black) = deep charcoal with a ring
  return seat === 0
    ? 'radial-gradient(circle at 35% 30%, #ffd98a, #f5b14c 55%, #b97a1e)'
    : 'radial-gradient(circle at 35% 30%, #5a5a66, #2c2c34 55%, #17171c)';
}

export function DortluBoard({ view, onAction }: { view: DortluView; onAction: (a: DortluAction) => void }) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const canPlay = view.yourTurn && view.phase === 'playing';
  const youSeat = view.youAre === 'black' ? 1 : 0;
  const winSet = new Set(view.winLine ?? []);
  const last = view.lastDrop;

  return (
    <div className="mx-auto w-full max-w-[560px]">
      {/* hover preview row */}
      <div className="grid gap-1 px-2 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${C}, 1fr)` }}>
        {Array.from({ length: C }, (_, c) => (
          <div key={c} className="grid aspect-square place-items-center">
            {canPlay && hoverCol === c && view.legalCols.includes(c) && (
              <span className="block h-[78%] w-[78%] animate-bounce rounded-full opacity-80" style={{ background: discColor(youSeat) }} />
            )}
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-2 ring-1 ring-white/10 sm:p-3"
        style={{ background: 'linear-gradient(160deg, #1d4ed8 0%, #1e40af 60%, #172f8a 100%)' }}
        onPointerLeave={() => setHoverCol(null)}
      >
        <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${C}, 1fr)` }}>
          {/* render top row first: display row = R-1 … 0 */}
          {Array.from({ length: R }, (_, i) => R - 1 - i).map((r) =>
            Array.from({ length: C }, (_, c) => {
              const idx = r * C + c;
              const cell = view.cells[idx];
              const isLast = last !== null && last.row === r && last.col === c;
              const inWin = winSet.has(idx);
              const clickable = canPlay && view.legalCols.includes(c);
              return (
                <button
                  key={idx}
                  disabled={!clickable}
                  onClick={clickable ? () => onAction({ type: 'drop', col: c }) : undefined}
                  onPointerEnter={() => setHoverCol(c)}
                  className={`relative grid aspect-square place-items-center rounded-full ${clickable ? 'cursor-pointer' : ''}`}
                  style={{
                    background: 'radial-gradient(circle at 50% 45%, #0b1636 0%, #0e1b45 70%, #12235c 100%)',
                    boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.55)',
                  }}
                >
                  {cell !== -1 && (
                    <span
                      className={`block h-[82%] w-[82%] rounded-full ${inWin ? 'ring-4 ring-amber-glow' : ''}`}
                      style={{
                        background: discColor(cell),
                        boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                        animation: isLast ? `dortlu-drop 380ms cubic-bezier(0.4,0,0.7,0.4)` : undefined,
                      }}
                    />
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {view.phase === 'over' && view.winner === null && (
        <p className="mt-2 text-center text-sm font-semibold text-white/70">🤝 Berabere — tahta doldu!</p>
      )}
    </div>
  );
}
