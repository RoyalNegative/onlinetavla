// Mangala board. Your six pits along the bottom (sowing left → right into
// your treasury on the right), the opponent's pits mirrored on top. Click a
// non-empty pit of yours to sow it; the last move's landing pit and any
// captured pits flash so both players can follow what just happened.

import { useMemo } from 'react';
import type { MangalaAction, MangalaView } from '@tavla/engine';
import { treasuryOf } from '@tavla/engine';

interface Props {
  view: MangalaView;
  onAction: (a: MangalaAction) => void;
}

/** Stones drawn as a cluster; beyond 12 we show the count only. */
function Stones({ n }: { n: number }) {
  const shown = Math.min(n, 12);
  const dots = useMemo(
    () =>
      Array.from({ length: shown }, (_, i) => {
        // Deterministic pseudo-scatter so stones look hand-dropped but stable.
        const a = (i * 137.5) % 360;
        const r = 8 + ((i * 53) % 30);
        return {
          left: 50 + Math.cos((a * Math.PI) / 180) * r * 0.42,
          top: 50 + Math.sin((a * Math.PI) / 180) * r * 0.42,
          hue: 36 + ((i * 97) % 3) * 8,
        };
      }),
    [shown],
  );
  return (
    <>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute h-[18%] w-[18%] rounded-full shadow-sm"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            transform: 'translate(-50%,-50%)',
            background: `radial-gradient(circle at 35% 30%, hsl(${d.hue} 45% 78%), hsl(${d.hue} 35% 52%))`,
          }}
        />
      ))}
    </>
  );
}

function Pit({
  count,
  onClick,
  clickable,
  flash,
  captured,
}: {
  count: number;
  onClick?: () => void;
  clickable: boolean;
  flash: boolean;
  captured: boolean;
}) {
  return (
    <button
      disabled={!clickable}
      onClick={onClick}
      className={`relative aspect-square w-full rounded-full transition ${
        clickable ? 'cursor-pointer ring-2 ring-accent/60 hover:ring-accent hover:brightness-110' : ''
      } ${flash ? 'animate-pulse ring-2 ring-sky-400/80' : ''} ${captured ? 'animate-pulse ring-2 ring-rose-400/80' : ''}`}
      style={{
        background: 'radial-gradient(circle at 50% 42%, #4a3020 0%, #33210f 55%, #241708 100%)',
        boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      <Stones n={count} />
      <span className="absolute -bottom-0.5 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-1.5 text-[11px] font-bold text-white/90">
        {count}
      </span>
    </button>
  );
}

function Treasury({ count, label, mine, flash }: { count: number; label: string; mine: boolean; flash: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <div
        className={`relative h-full min-h-[120px] w-full rounded-[2rem] ${flash ? 'animate-pulse ring-2 ring-accent/80' : ''}`}
        style={{
          background: 'radial-gradient(circle at 50% 30%, #4a3020 0%, #33210f 60%, #241708 100%)',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <Stones n={count} />
        <span className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/60 px-2 text-sm font-extrabold text-accent">
          {count}
        </span>
      </div>
      <span className={`text-[11px] font-semibold ${mine ? 'text-accent/90' : 'text-white/45'}`}>{label}</span>
    </div>
  );
}

export function MangalaBoard({ view, onAction }: Props) {
  // Spectators watch from white's (seat 0) side.
  const you = view.youAre === 'black' ? 1 : 0;
  const opp = 1 - you;
  const bottom = Array.from({ length: 6 }, (_, i) => you * 7 + i); // left → right
  const top = Array.from({ length: 6 }, (_, i) => opp * 7 + (5 - i)); // mirrored
  const last = view.lastMove;
  const flashPit = (g: number) => last !== null && last.landed === g;
  const captured = (g: number) => last !== null && last.captured.includes(g);

  return (
    <div
      className="rounded-2xl p-3 ring-1 ring-white/10 sm:p-4"
      style={{ background: 'linear-gradient(160deg, #6b4a2c 0%, #543619 55%, #462c12 100%)' }}
    >
      <div className="grid grid-cols-[1fr_6fr_1fr] gap-2 sm:gap-3">
        {/* Opponent treasury (left), pit rows, your treasury (right). */}
        <Treasury
          count={view.pits[treasuryOf(opp)]}
          label="Rakip hazne"
          mine={false}
          flash={flashPit(treasuryOf(opp)) || (last?.seat === opp && last.captured.length > 0)}
        />
        <div className="flex flex-col justify-center gap-2 sm:gap-3">
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {top.map((g) => (
              <Pit key={g} count={view.pits[g]} clickable={false} flash={flashPit(g)} captured={captured(g)} />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {bottom.map((g) => (
              <Pit
                key={g}
                count={view.pits[g]}
                clickable={view.legalPits.includes(g)}
                onClick={() => onAction({ type: 'sow', pit: g })}
                flash={flashPit(g)}
                captured={captured(g)}
              />
            ))}
          </div>
        </div>
        <Treasury
          count={view.pits[treasuryOf(you)]}
          label={view.youAre === null ? 'Beyaz hazne' : 'Senin haznen'}
          mine={view.youAre !== null}
          flash={flashPit(treasuryOf(you)) || (last?.seat === you && last.captured.length > 0)}
        />
      </div>
      {last?.extraTurn && view.phase === 'playing' && (
        <p className="mt-2 text-center text-xs font-semibold text-accent/90">
          ⭐ Son taş hazneye düştü — {last.seat === you && view.youAre !== null ? 'bir hamle daha senin!' : 'rakip bir kez daha oynuyor'}
        </p>
      )}
    </div>
  );
}
