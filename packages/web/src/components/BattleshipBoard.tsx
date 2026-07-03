// Amiral Battı board. Two modes: the placement editor (drop your fleet on your
// own grid) and the battle view (target grid you fire at + your fleet beside it).

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import type { BattleshipAction, BattleshipView, ShipPlacement } from '@tavla/engine';
import { BATTLESHIP_SIZE, FLEET, randomFleet, shipCells } from '@tavla/engine';

const N = BATTLESHIP_SIZE;
const SHIP_NAMES = ['Uçak gemisi', 'Zırhlı', 'Kruvazör', 'Denizaltı', 'Muhrip'];
const COLS = 'ABCDEFGHIJ';

interface Props {
  view: BattleshipView;
  onAction: (a: BattleshipAction) => void;
}

export function BattleshipBoard({ view, onAction }: Props) {
  const you = view.youAre === 'black' ? 1 : 0; // spectators watch from white's side
  const enemy = 1 - you;
  const placing = view.phase === 'placing';
  const youPlaced = view.boards[you].placed;

  if (placing && view.youAre !== null && !youPlaced) {
    return <PlacementEditor onSubmit={(ships) => onAction({ type: 'place', ships })} />;
  }

  const spectator = view.youAre === null;
  const canFire = view.yourTurn && view.phase === 'battle';
  const lastCell = view.lastShot?.cell ?? null;
  // A shot lands on the board of the player who did NOT fire it.
  const lastBoard = view.lastShot ? (view.lastShot.by === 'white' ? 1 : 0) : null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      <Grid
        title={spectator ? '⚓ Beyazın filosu' : '🎯 Hedef bölge'}
        board={view.boards[spectator ? 0 : enemy]}
        showShips
        lastCell={lastBoard === (spectator ? 0 : enemy) ? lastCell : null}
        onFire={canFire ? (cell) => onAction({ type: 'fire', cell }) : undefined}
        waiting={placing ? 'Rakip gemilerini yerleştiriyor…' : null}
      />
      <Grid
        title={spectator ? '⚓ Siyahın filosu' : '⚓ Senin filon'}
        board={view.boards[spectator ? 1 : you]}
        showShips
        lastCell={lastBoard === (spectator ? 1 : you) ? lastCell : null}
      />
    </div>
  );
}

// ---- One 10x10 grid ----

function Grid({
  title,
  board,
  showShips,
  lastCell,
  onFire,
  waiting,
}: {
  title: string;
  board: BattleshipView['boards'][number];
  showShips: boolean;
  lastCell: number | null;
  onFire?: (cell: number) => void;
  waiting?: string | null;
}) {
  const shotMap = useMemo(() => new Map(board.shots.map((s) => [s.cell, s.hit])), [board.shots]);
  const shipCellsSet = useMemo(() => new Set(showShips && board.ships ? board.ships.flat() : []), [board.ships, showShips]);
  const sunkSet = useMemo(() => new Set(board.sunk.flat()), [board.sunk]);

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-xs font-semibold text-white/60">{title}</span>
        <span className="text-[11px] text-white/40">{board.shipsLeft} gemi ayakta</span>
      </div>
      <CellFrame>
        {(cell) => {
          const hit = shotMap.get(cell);
          const isShip = shipCellsSet.has(cell);
          const sunk = sunkSet.has(cell);
          const fresh = onFire && !shotMap.has(cell);
          return (
            <button
              key={cell}
              disabled={!fresh}
              onClick={fresh ? () => onFire(cell) : undefined}
              className={`relative aspect-square border border-white/[0.08] transition ${
                sunk
                  ? 'bg-rose-950/90'
                  : hit === true
                    ? 'bg-rose-500/70'
                    : isShip
                      ? 'bg-slate-400/70'
                      : 'bg-transparent'
              } ${fresh ? 'cursor-crosshair hover:bg-sky-300/25' : ''} ${
                lastCell === cell ? 'z-10 ring-2 ring-amber-glow' : ''
              }`}
            >
              {hit === true && <Mark>✕</Mark>}
              {hit === false && <span className="absolute inset-0 grid place-items-center"><span className="h-1.5 w-1.5 rounded-full bg-white/30" /></span>}
            </button>
          );
        }}
      </CellFrame>
      {waiting && (
        <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/50 backdrop-blur-[2px]">
          <p className="animate-pulse px-4 text-center text-sm font-semibold text-white/80">⏳ {waiting}</p>
        </div>
      )}
    </div>
  );
}

// Sea-blue frame with A–J / 1–10 coordinates around the 10x10 cell grid.
function CellFrame({ children }: { children: (cell: number) => ReactNode }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0f3550] to-[#0a2438] p-1.5 ring-1 ring-white/10">
      <div className="grid select-none" style={{ gridTemplateColumns: `1rem repeat(${N}, 1fr)` }}>
        <span />
        {Array.from({ length: N }, (_, c) => (
          <span key={c} className="pb-0.5 text-center text-[9px] font-semibold text-white/30">{COLS[c]}</span>
        ))}
        {Array.from({ length: N }, (_, r) => (
          <Fragment key={r}>
            <span className="grid place-items-center pr-0.5 text-right text-[9px] font-semibold text-white/30">{r + 1}</span>
            {Array.from({ length: N }, (_, c) => children(r * N + c))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Mark({ children }: { children: ReactNode }) {
  return <span className="absolute inset-0 grid place-items-center text-[min(3.2vw,15px)] font-black text-white/90">{children}</span>;
}

// ---- Placement editor ----

function PlacementEditor({ onSubmit }: { onSubmit: (ships: ShipPlacement[]) => void }) {
  // One slot per FLEET entry, in order; null = not yet placed.
  const [slots, setSlots] = useState<(ShipPlacement | null)[]>(() => randomFleet().map((s) => s));
  const [selected, setSelected] = useState<number | null>(null);
  const [dir, setDir] = useState<'h' | 'v'>('h');
  const [hover, setHover] = useState<number | null>(null);
  const [sent, setSent] = useState(false);

  const cellOwner = useMemo(() => {
    const map = new Map<number, number>();
    slots.forEach((s, i) => {
      if (s) for (const c of shipCells(s) ?? []) map.set(c, i);
    });
    return map;
  }, [slots]);

  const allPlaced = slots.every(Boolean);
  const nextEmpty = slots.findIndex((s) => s === null);
  const active = selected ?? (nextEmpty >= 0 ? nextEmpty : null);

  const ghost = useMemo(() => {
    if (active === null || hover === null) return null;
    const cells = shipCells({ r: Math.floor(hover / N), c: hover % N, len: FLEET[active], dir });
    if (!cells) return { cells: [hover], ok: false };
    const ok = cells.every((c) => !cellOwner.has(c) || cellOwner.get(c) === active);
    return { cells, ok };
  }, [active, hover, dir, cellOwner]);

  function clickCell(cell: number) {
    // Tapping one of your placed ships picks it up again.
    const owner = cellOwner.get(cell);
    if (owner !== undefined && owner !== active) {
      setSlots((s) => s.map((v, i) => (i === owner ? null : v)));
      setSelected(owner);
      return;
    }
    if (active === null) return;
    const p: ShipPlacement = { r: Math.floor(cell / N), c: cell % N, len: FLEET[active], dir };
    const cells = shipCells(p);
    if (!cells || cells.some((c) => cellOwner.has(c) && cellOwner.get(c) !== active)) return;
    setSlots((s) => s.map((v, i) => (i === active ? p : v)));
    setSelected(null);
    setHover(null);
  }

  function submit() {
    if (!allPlaced || sent) return;
    setSent(true);
    onSubmit(slots as ShipPlacement[]);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-1.5 px-0.5 text-xs font-semibold text-white/60">⚓ Filonu yerleştir — gemiye dokun, sonra kareye</div>
        <CellFrame>
          {(cell) => {
            const owner = cellOwner.get(cell);
            const inGhost = ghost?.cells.includes(cell);
            const isActive = owner !== undefined && owner === selected;
            return (
              <button
                key={cell}
                onClick={() => clickCell(cell)}
                onMouseEnter={() => setHover(cell)}
                onMouseLeave={() => setHover((h) => (h === cell ? null : h))}
                className={`relative aspect-square border border-white/[0.08] transition ${
                  inGhost
                    ? ghost!.ok
                      ? 'bg-sky-400/50'
                      : 'bg-rose-500/50'
                    : owner !== undefined
                      ? isActive
                        ? 'bg-amber-glow/70'
                        : 'bg-slate-400/70 hover:bg-slate-300/70'
                      : 'hover:bg-sky-300/20'
                }`}
              />
            );
          }}
        </CellFrame>
      </div>

      <div className="flex flex-col gap-2 lg:w-52">
        <div className="card space-y-1.5 p-3">
          {FLEET.map((len, i) => (
            <button
              key={i}
              onClick={() => {
                if (slots[i]) setSlots((s) => s.map((v, j) => (j === i ? null : v)));
                setSelected(i);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                active === i ? 'bg-amber-glow/20 ring-1 ring-amber-glow/60' : slots[i] ? 'bg-white/5 text-white/50' : 'bg-white/10'
              }`}
            >
              <span className="font-semibold">{SHIP_NAMES[i]}</span>
              <span className="flex gap-0.5">
                {Array.from({ length: len }, (_, k) => (
                  <span key={k} className={`h-2.5 w-2.5 rounded-[2px] ${slots[i] ? 'bg-emerald-400/70' : 'bg-slate-300/60'}`} />
                ))}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button className="btn-ghost py-2 text-sm" onClick={() => setDir((d) => (d === 'h' ? 'v' : 'h'))}>
            {dir === 'h' ? '↔ Yatay' : '↕ Dikey'}
          </button>
          <button
            className="btn-ghost py-2 text-sm"
            onClick={() => {
              setSlots(randomFleet().map((s) => s));
              setSelected(null);
            }}
          >
            🎲 Karıştır
          </button>
        </div>
        <button className="btn-primary py-3" disabled={!allPlaced || sent} onClick={submit}>
          {sent ? 'Gönderildi…' : '⚔️ Hazırım, savaşa!'}
        </button>
        {!allPlaced && <p className="text-center text-xs text-white/40">Tüm gemileri yerleştir.</p>}
      </div>
    </div>
  );
}
