// Amiral Battı board. Two modes: the placement editor (drop your fleet on your
// own grid) and the battle view (target grid you fire at + your fleet beside it).
//
// Suspense system: useBattleshipFx delays the *rendered* view one bomb-flight
// behind the live one — a 💣 falls onto the target cell and only on impact does
// the result (✕ / 🌊, ship counts, even the winner panel) appear. When either
// side is down to its last ship the drop switches to slow motion and the grids
// pulse red.

import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { BattleshipAction, BattleshipView, ShipPlacement } from '@tavla/engine';
import { BATTLESHIP_SIZE, FLEET, haloCells, randomFleet, shipCells } from '@tavla/engine';

const N = BATTLESHIP_SIZE;
const SHIP_NAMES = ['Uçak gemisi', 'Zırhlı', 'Kruvazör', 'Denizaltı', 'Muhrip'];
const COLS = 'ABCDEFGHIJ';

export const BOMB_FALL_MS = 480;
export const BOMB_FALL_SLOW_MS = 1000;
export const BOOM_MS = 550;

export interface ShotFx {
  cell: number;
  board: number; // board the bomb lands on
  hit: boolean;
  stage: 'fall' | 'boom';
  slow: boolean;
}

/** True once either fleet is down to its last ship — the red-pulse endgame. */
export function isTension(view: BattleshipView): boolean {
  return view.phase !== 'placing' && (view.boards[0].shipsLeft <= 1 || view.boards[1].shipsLeft <= 1);
}

/**
 * Slow motion only while hunting a *hidden* last ship: the board being fired
 * at has one ship afloat and no un-sunk hit on it yet. Once the ship is found,
 * follow-up shots drop at normal speed.
 */
export function isSlowShot(preView: BattleshipView, landedBoard: number): boolean {
  const b = preView.boards[landedBoard];
  if (b.shipsLeft !== 1) return false;
  const sunk = new Set(b.sunk.flat());
  return !b.shots.some((s) => s.hit && !sunk.has(s.cell));
}

/**
 * Buffers the live view while a bomb is in the air. Returns the view to render
 * (`shown`, one shot behind during the animation) and the active effect. Call
 * with null when the current game isn't amiral — it passes through untouched.
 */
export function useBattleshipFx(live: BattleshipView | null): { shown: BattleshipView | null; fx: ShotFx | null } {
  const [shown, setShown] = useState(live);
  const [fx, setFx] = useState<ShotFx | null>(null);
  const shownRef = useRef(live);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animSeq = useRef<number | null>(null); // moveSeq currently animating

  // Timers are cleared explicitly when superseded; this only covers unmount.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    const settle = (v: BattleshipView | null) => {
      shownRef.current = v;
      setShown(v);
    };

    const cur = shownRef.current;
    if (!live || !cur || !live.lastShot || live.moveSeq - cur.moveSeq !== 1) {
      // Nothing to animate: no game, first view, rematch reset, a placement
      // step, a same-seq refresh, or a gap we can't replay — show it as is.
      // (A same-seq refresh mid-flight is ignored via animSeq.)
      if (!live || !cur || live.moveSeq !== animSeq.current) {
        clear();
        animSeq.current = null;
        setFx(null);
        settle(live);
      }
      return;
    }
    // A re-render with the shot we're already animating (e.g. a chat broadcast
    // carrying the same view) — keep the bomb in the air.
    if (animSeq.current === live.moveSeq) return;

    const ls = live.lastShot;
    const board = ls.by === 'white' ? 1 : 0;
    const slow = isSlowShot(cur, board);
    const fall = slow ? BOMB_FALL_SLOW_MS : BOMB_FALL_MS;
    clear();
    animSeq.current = live.moveSeq;
    setFx({ cell: ls.cell, board, hit: ls.result !== 'miss', stage: 'fall', slow });
    timers.current.push(
      setTimeout(() => {
        settle(live); // impact: reveal the result under the explosion
        setFx((f) => (f ? { ...f, stage: 'boom' } : f));
      }, fall),
      setTimeout(() => {
        animSeq.current = null;
        setFx(null);
      }, fall + BOOM_MS),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  return { shown, fx };
}

interface Props {
  view: BattleshipView;
  fx?: ShotFx | null;
  onAction: (a: BattleshipAction) => void;
}

export function BattleshipBoard({ view, fx = null, onAction }: Props) {
  const you = view.youAre === 'black' ? 1 : 0; // spectators watch from white's side
  const enemy = 1 - you;
  const placing = view.phase === 'placing';
  const youPlaced = view.boards[you].placed;
  const tension = isTension(view);

  const [banner, setBanner] = useState<string | null>(null);
  const prevLeft = useRef<[number, number] | null>(null);

  // Full-screen tension banner the moment a fleet drops to its last ship.
  useEffect(() => {
    const left: [number, number] = [view.boards[0].shipsLeft, view.boards[1].shipsLeft];
    const prev = prevLeft.current;
    prevLeft.current = left;
    if (!prev || view.phase !== 'battle' || view.youAre === null) return;
    const yoursNow = left[you] === 1 && prev[you] > 1;
    const theirsNow = left[enemy] === 1 && prev[enemy] > 1;
    if (!yoursNow && !theirsNow) return;
    setBanner(theirsNow ? '🎯 Rakibin son gemisi!' : '🚨 Son gemin — dikkat!');
    const t = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.boards[0].shipsLeft, view.boards[1].shipsLeft]);

  if (placing && view.youAre !== null && !youPlaced) {
    return <PlacementEditor noTouch={view.noTouch} onSubmit={(ships) => onAction({ type: 'place', ships })} />;
  }

  const spectator = view.youAre === null;
  const canFire = view.yourTurn && view.phase === 'battle' && !fx; // wait out the bomb
  const lastCell = fx ? null : (view.lastShot?.cell ?? null);
  // A shot lands on the board of the player who did NOT fire it.
  const lastBoard = view.lastShot ? (view.lastShot.by === 'white' ? 1 : 0) : null;
  const leftIdx = spectator ? 0 : enemy;
  const rightIdx = spectator ? 1 : you;

  return (
    <div className="relative">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <Grid
          title={spectator ? '⚓ Beyazın filosu' : '🎯 Hedef bölge'}
          board={view.boards[leftIdx]}
          lastCell={lastBoard === leftIdx ? lastCell : null}
          onFire={canFire ? (cell) => onAction({ type: 'fire', cell }) : undefined}
          waiting={placing ? 'Rakip gemilerini yerleştiriyor…' : null}
          fx={fx?.board === leftIdx ? fx : null}
          tension={tension}
        />
        <Grid
          title={spectator ? '⚓ Siyahın filosu' : '⚓ Senin filon'}
          board={view.boards[rightIdx]}
          lastCell={lastBoard === rightIdx ? lastCell : null}
          fx={fx?.board === rightIdx ? fx : null}
          tension={tension}
        />
      </div>
      {banner && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <div
            className="rounded-2xl bg-black/70 px-6 py-4 text-center text-xl font-extrabold text-rose-300 shadow-2xl ring-1 ring-rose-400/40 backdrop-blur-sm sm:text-2xl"
            style={{ animation: 'bs-banner 2.2s ease-in-out forwards' }}
          >
            {banner}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- One 10x10 grid ----

function Grid({
  title,
  board,
  lastCell,
  onFire,
  waiting,
  fx,
  tension,
}: {
  title: string;
  board: BattleshipView['boards'][number];
  lastCell: number | null;
  onFire?: (cell: number) => void;
  waiting?: string | null;
  fx?: ShotFx | null;
  tension?: boolean;
}) {
  const shotMap = useMemo(() => new Map(board.shots.map((s) => [s.cell, s.hit])), [board.shots]);
  const shipCellsSet = useMemo(() => new Set(board.ships ? board.ships.flat() : []), [board.ships]);
  const sunkSet = useMemo(() => new Set(board.sunk.flat()), [board.sunk]);

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center justify-between px-0.5">
        <span className="text-xs font-semibold text-white/60">{title}</span>
        <span className={`text-[11px] ${tension ? 'font-bold text-rose-400' : 'text-white/40'}`}>
          {board.shipsLeft} gemi ayakta
        </span>
      </div>
      <div className={tension ? 'bs-tension' : undefined}>
        <CellFrame>
          {(cell) => {
            // The shown view is pre-impact while the bomb falls, so the target
            // cell is still unmarked — the overlays are pure decoration.
            const falling = fx?.cell === cell && fx.stage === 'fall';
            const booming = fx?.cell === cell && fx.stage === 'boom';
            const hit = shotMap.get(cell);
            const isShip = shipCellsSet.has(cell);
            const sunk = sunkSet.has(cell);
            const fresh = onFire && !shotMap.has(cell) && !falling;
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
                  lastCell === cell ? 'z-10 ring-2 ring-accent' : ''
                }`}
              >
                {hit === true && <Mark>✕</Mark>}
                {hit === false && !booming && (
                  <span className="absolute inset-0 grid place-items-center"><span className="h-1.5 w-1.5 rounded-full bg-white/30" /></span>
                )}
                {falling && (
                  <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-visible">
                    <span
                      className="text-[min(4vw,20px)]"
                      style={{
                        animation: `bs-fall ${fx!.slow ? BOMB_FALL_SLOW_MS : BOMB_FALL_MS}ms cubic-bezier(0.5,0,0.85,0.5) forwards`,
                      }}
                    >
                      💣
                    </span>
                  </span>
                )}
                {booming && (
                  <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center overflow-visible">
                    <span
                      className="text-[min(5vw,26px)]"
                      style={{ animation: `${fx!.hit ? 'bs-boom' : 'bs-splash'} 550ms ease-out forwards` }}
                    >
                      {fx!.hit ? '💥' : '🌊'}
                    </span>
                  </span>
                )}
              </button>
            );
          }}
        </CellFrame>
      </div>
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
// Every ship starts on the board (a random legal layout). Drag a ship to move
// it as a whole; double-tap (or tap its name in the list) to rotate it.

function PlacementEditor({ noTouch, onSubmit }: { noTouch: boolean; onSubmit: (ships: ShipPlacement[]) => void }) {
  const [slots, setSlots] = useState<ShipPlacement[]>(() => randomFleet(Math.random, noTouch));
  const [drag, setDrag] = useState<null | { idx: number; grab: number; hover: number; moved: boolean }>(null);
  const [sent, setSent] = useState(false);
  const lastTap = useRef<{ idx: number; t: number } | null>(null);

  const cellOwner = useMemo(() => {
    const map = new Map<number, number>();
    slots.forEach((s, i) => {
      for (const c of shipCells(s) ?? []) map.set(c, i);
    });
    return map;
  }, [slots]);

  function canPlace(idx: number, p: ShipPlacement): boolean {
    const cells = shipCells(p);
    if (!cells) return false;
    const taken = new Set(slots.filter((_, j) => j !== idx).flatMap((s) => shipCells(s) ?? []));
    if (cells.some((c) => taken.has(c))) return false;
    if (noTouch && haloCells(cells).some((c) => taken.has(c))) return false;
    return true;
  }

  function rotate(idx: number) {
    const s = slots[idx];
    const dir: 'h' | 'v' = s.dir === 'h' ? 'v' : 'h';
    const p: ShipPlacement = {
      r: dir === 'v' ? Math.min(s.r, N - s.len) : s.r,
      c: dir === 'h' ? Math.min(s.c, N - s.len) : s.c,
      len: s.len,
      dir,
    };
    if (canPlace(idx, p)) setSlots((sl) => sl.map((v, j) => (j === idx ? p : v)));
  }

  /** The placement a drop on `hover` would produce, keeping the grabbed cell under the finger. */
  function dropTarget(idx: number, grab: number, hover: number): ShipPlacement {
    const s = slots[idx];
    return {
      r: s.dir === 'v' ? Math.floor(hover / N) - grab : Math.floor(hover / N),
      c: s.dir === 'h' ? (hover % N) - grab : hover % N,
      len: s.len,
      dir: s.dir,
    };
  }

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest('[data-cell]');
    const v = el?.getAttribute('data-cell');
    return v == null ? null : Number(v);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell === null) return;
    const owner = cellOwner.get(cell);
    if (owner === undefined) return;
    const now = Date.now();
    const prev = lastTap.current;
    lastTap.current = { idx: owner, t: now };
    if (prev && prev.idx === owner && now - prev.t < 350) {
      lastTap.current = null;
      rotate(owner); // double-tap
      return;
    }
    const s = slots[owner];
    const grab = s.dir === 'h' ? (cell % N) - s.c : Math.floor(cell / N) - s.r;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ idx: owner, grab, hover: cell, moved: false });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell !== null && cell !== drag.hover) setDrag({ ...drag, hover: cell, moved: true });
  }

  function onPointerEnd() {
    if (!drag) return;
    if (drag.moved) {
      const p = dropTarget(drag.idx, drag.grab, drag.hover);
      if (canPlace(drag.idx, p)) setSlots((sl) => sl.map((v, j) => (j === drag.idx ? p : v)));
    }
    setDrag(null);
  }

  const ghost = useMemo(() => {
    if (!drag || !drag.moved) return null;
    const p = dropTarget(drag.idx, drag.grab, drag.hover);
    return { cells: shipCells(p) ?? [drag.hover], ok: canPlace(drag.idx, p) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, slots]);

  function submit() {
    if (sent) return;
    setSent(true);
    onSubmit(slots);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <div>
        <div className="mb-1.5 px-0.5 text-xs font-semibold text-white/60">
          ⚓ Filonu yerleştir — sürükleyerek taşı, çift dokunuşla döndür
          {noTouch && <span className="text-white/40"> · kolay mod: gemiler bitişik olamaz</span>}
        </div>
        <div className="touch-none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
          <CellFrame>
            {(cell) => {
              const owner = cellOwner.get(cell);
              const inGhost = ghost?.cells.includes(cell);
              const dragging = drag !== null && owner === drag.idx;
              return (
                <div
                  key={cell}
                  data-cell={cell}
                  className={`relative aspect-square border border-white/[0.08] transition ${
                    inGhost
                      ? ghost!.ok
                        ? 'bg-sky-400/60'
                        : 'bg-rose-500/60'
                      : owner !== undefined
                        ? dragging
                          ? 'bg-slate-400/30'
                          : 'cursor-grab bg-slate-400/70 hover:bg-slate-300/70'
                        : ''
                  }`}
                />
              );
            }}
          </CellFrame>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:w-52">
        <div className="card space-y-1.5 p-3">
          {FLEET.map((len, i) => (
            <button
              key={i}
              onClick={() => rotate(i)}
              title="Döndür"
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                drag?.idx === i ? 'bg-accent/20 ring-1 ring-accent/60' : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <span className="font-semibold">{SHIP_NAMES[i]}</span>
              <span className="flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  {Array.from({ length: len }, (_, k) => (
                    <span key={k} className="h-2.5 w-2.5 rounded-[2px] bg-slate-300/60" />
                  ))}
                </span>
                <span className="text-white/30">{slots[i].dir === 'h' ? '↔' : '↕'}</span>
              </span>
            </button>
          ))}
          <p className="pt-1 text-[11px] leading-relaxed text-white/35">Gemi adına dokunmak da döndürür.</p>
        </div>

        <button className="btn-ghost py-2 text-sm" onClick={() => setSlots(randomFleet(Math.random, noTouch))}>
          🎲 Karıştır
        </button>
        <button className="btn-primary py-3" disabled={sent} onClick={submit}>
          {sent ? 'Gönderildi…' : '⚔️ Hazırım, savaşa!'}
        </button>
      </div>
    </div>
  );
}
