// 4'ü Bağla board. Classic blue frame with punched holes; click (or hover)
// a column to drop. The newest disc falls in with a CSS animation and the
// winning four light up when the game ends.

import { useState } from 'react';
import type { DortluAction, DortluView } from '@tavla/engine';
import { DORTLU_COLS, DORTLU_ROWS } from '@tavla/engine';

const C = DORTLU_COLS;
const R = DORTLU_ROWS;

function discColor(seat: number): string {
  // seat 0 (white) = warm amber; seat 1 (black) = graphite, lightened so it
  // reads on the dark-blue board instead of sinking into it.
  return seat === 0
    ? 'radial-gradient(circle at 35% 30%, #ffd98a, #f5b14c 55%, #b97a1e)'
    : 'radial-gradient(circle at 35% 30%, #9aa1ad, #565e6b 52%, #333a45)';
}

// A rim that lifts each disc off the dark navy holes — a cool light edge for
// the graphite disc keeps it legible; the amber one just needs a soft shadow.
function discRim(seat: number): string {
  return seat === 0
    ? '0 2px 4px rgba(0,0,0,0.4)'
    : '0 2px 4px rgba(0,0,0,0.45), inset 0 0 0 2px rgba(255,255,255,0.20)';
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
                      className="block h-[82%] w-[82%] rounded-full"
                      style={{
                        background: discColor(cell),
                        // The winning four keep a steady amber glow so the line
                        // that ended the round is unmistakable.
                        boxShadow: inWin
                          ? '0 0 0 3px rgba(245,177,76,0.95), 0 0 14px 4px rgba(245,177,76,0.6)'
                          : discRim(cell),
                        animation: inWin
                          ? 'dortlu-win 1s ease-in-out infinite'
                          : isLast
                            ? `dortlu-drop 380ms cubic-bezier(0.4,0,0.7,0.4)`
                            : undefined,
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
