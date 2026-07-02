// The tavla board: SVG points/checkers/bar/bear-off, an HTML dice overlay, a
// sliding move animation, and click-to-move. The board flips for the black
// player so each side sees their own home at the bottom-right.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Action, DieMove, Player, TavlaView } from '@tavla/engine';
import { Die } from './Die';

const VB_W = 1000;
const VB_H = 600;
const MARGIN = 18;
const COL_W = 70;
const BAR_W = 56;
const TRAY_W = 76;
const POINT_H = 248;
const CHK_R = 25;
const STACK = 43;
const TOP_Y0 = 16;
const BOT_Y0 = VB_H - 16;

const WHITE_BG = 'radial-gradient(circle at 35% 30%, #fffdf5 0%, #efe2c0 65%, #cdb98a 100%)';
const BLACK_BG = 'radial-gradient(circle at 35% 30%, #4a3a2c 0%, #2c2017 60%, #160f0a 100%)';

type Row = 'top' | 'bottom';
type Slot = { slot: number; row: Row };

const BASE_SLOT: Record<number, Slot> = {};
[11, 10, 9, 8, 7, 6].forEach((idx, i) => (BASE_SLOT[idx] = { slot: i, row: 'bottom' }));
[5, 4, 3, 2, 1, 0].forEach((idx, i) => (BASE_SLOT[idx] = { slot: 6 + i, row: 'bottom' }));
[12, 13, 14, 15, 16, 17].forEach((idx, i) => (BASE_SLOT[idx] = { slot: i, row: 'top' }));
[18, 19, 20, 21, 22, 23].forEach((idx, i) => (BASE_SLOT[idx] = { slot: 6 + i, row: 'top' }));

function slotX(slot: number): number {
  return slot < 6
    ? MARGIN + slot * COL_W + COL_W / 2
    : MARGIN + 6 * COL_W + BAR_W + (slot - 6) * COL_W + COL_W / 2;
}
const BAR_X = MARGIN + 6 * COL_W + BAR_W / 2;
const TRAY_X = MARGIN + 6 * COL_W + BAR_W + 6 * COL_W + TRAY_W / 2;

function checkerY(row: Row, i: number): number {
  return row === 'top' ? TOP_Y0 + CHK_R + 6 + i * STACK : BOT_Y0 - CHK_R - 6 - i * STACK;
}

function colorAt(points: number[], i: number): Player | null {
  if (points[i] > 0) return 'white';
  if (points[i] < 0) return 'black';
  return null;
}

interface Props {
  view: TavlaView;
  interactive: boolean;
  onAction: (a: Action) => void;
}

export function Board({ view, interactive, onAction }: Props) {
  const { game, legalMoves } = view;
  const youColor: Player = view.youAre ?? 'white';
  const flip = view.youAre === 'black';
  const [selected, setSelected] = useState<number | 'bar' | null>(null);

  // ---- flip-aware geometry ----
  const pos = (index: number): Slot => {
    const b = BASE_SLOT[index];
    return flip ? { slot: 11 - b.slot, row: b.row === 'top' ? 'bottom' : 'top' } : b;
  };
  const sideOf = (color: Player): Row =>
    color === 'white' ? (flip ? 'top' : 'bottom') : flip ? 'bottom' : 'top';
  const barCheckerY = (side: Row, i: number) =>
    side === 'top' ? TOP_Y0 + CHK_R + 40 + i * STACK : BOT_Y0 - CHK_R - 40 - i * STACK;
  const coordOf = (loc: number | 'bar' | 'off', color: Player): { x: number; y: number } => {
    if (loc === 'bar') return { x: BAR_X, y: barCheckerY(sideOf(color), 0) };
    if (loc === 'off') return { x: TRAY_X, y: sideOf(color) === 'bottom' ? BOT_Y0 - 40 : TOP_Y0 + 40 };
    const s = pos(loc);
    return { x: slotX(s.slot), y: checkerY(s.row, 0) };
  };

  // ---- click-to-move ----
  const sources = useMemo(() => new Set(legalMoves.map((m) => m.from)), [legalMoves]);
  useEffect(() => {
    if (selected !== null && !sources.has(selected)) setSelected(null);
  }, [sources, selected]);

  const targets = useMemo(() => {
    const map = new Map<number | 'off', DieMove>();
    if (selected !== null) for (const m of legalMoves) if (m.from === selected) map.set(m.to, m);
    return map;
  }, [legalMoves, selected]);

  const barTargets = useMemo(() => {
    const set = new Set<number>();
    if (selected === 'bar') for (const m of legalMoves) if (m.from === 'bar') set.add(m.to as number);
    return set;
  }, [legalMoves, selected]);

  // Opponent blots you can hit this turn — surfaced so captures are obvious.
  const hittable = useMemo(() => {
    const set = new Set<number>();
    for (const m of legalMoves) {
      if (typeof m.to === 'number') {
        const o = colorAt(game.points, m.to);
        if (o && o !== game.turn && Math.abs(game.points[m.to]) === 1) set.add(m.to);
      }
    }
    return set;
  }, [legalMoves, game.points, game.turn]);

  function play(move: DieMove) {
    onAction({ type: 'move', move });
    setSelected(null);
  }

  // Forced moves play themselves: a single legal move, or the last checker
  // bearing off where every option ends the game identically. Saves the
  // pointless taps at the end of a race.
  const autoMove = useMemo(() => {
    if (!interactive || legalMoves.length === 0) return null;
    if (legalMoves.length === 1) return legalMoves[0];
    const first = legalMoves[0];
    const allSame = legalMoves.every((m) => m.from === first.from && m.to === first.to);
    const onBoard = 15 - game.off[youColor];
    if (allSame && first.to === 'off' && onBoard === 1) return first;
    return null;
  }, [interactive, legalMoves, game.off, youColor]);

  useEffect(() => {
    if (!autoMove) return;
    const t = setTimeout(() => {
      onAction({ type: 'move', move: autoMove });
      setSelected(null);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMove]);
  function clickSource(from: number | 'bar') {
    const srcMoves = legalMoves.filter((m) => m.from === from);
    if (srcMoves.length === 1) play(srcMoves[0]);
    else if (srcMoves.length > 1) setSelected(from);
    else setSelected(null);
  }
  function clickPoint(index: number) {
    if (!interactive) return;
    if (selected !== null && targets.has(index)) return play(targets.get(index)!);
    clickSource(index);
  }
  function clickBar() {
    if (interactive && game.bar[youColor] > 0) clickSource('bar');
  }
  function clickOff() {
    if (interactive && selected !== null && targets.has('off')) play(targets.get('off')!);
  }

  const offAvailable = targets.has('off');

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="wchk" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fffdf5" />
            <stop offset="65%" stopColor="#efe2c0" />
            <stop offset="100%" stopColor="#cdb98a" />
          </radialGradient>
          <radialGradient id="bchk" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#4a3a2c" />
            <stop offset="60%" stopColor="#2c2017" />
            <stop offset="100%" stopColor="#160f0a" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={VB_W} height={VB_H} rx="18" fill="#3a2614" />
        <rect x={MARGIN - 6} y={MARGIN - 6} width={6 * COL_W + 12} height={VB_H - 2 * MARGIN + 12} rx="8" fill="#1f6f54" />
        <rect x={MARGIN + 6 * COL_W + BAR_W - 6} y={MARGIN - 6} width={6 * COL_W + 12} height={VB_H - 2 * MARGIN + 12} rx="8" fill="#1f6f54" />
        <rect x={BAR_X - BAR_W / 2} y={MARGIN - 6} width={BAR_W} height={VB_H - 2 * MARGIN + 12} rx="6" fill="#2c1b0f" />
        <rect x={TRAY_X - TRAY_W / 2} y={MARGIN - 6} width={TRAY_W} height={VB_H - 2 * MARGIN + 12} rx="8" fill="#241710" />

        {/* points */}
        {Array.from({ length: 24 }, (_, idx) => {
          const { slot, row } = pos(idx);
          const x = slotX(slot);
          const base = row === 'top' ? TOP_Y0 : BOT_Y0;
          const apexY = row === 'top' ? TOP_Y0 + POINT_H : BOT_Y0 - POINT_H;
          const light = (slot + (row === 'top' ? 0 : 1)) % 2 === 0;
          const fill = light ? '#e9dcc0' : '#9c5a32';
          const isSource = interactive && sources.has(idx);
          const isTarget = interactive && (targets.has(idx) || barTargets.has(idx));
          return (
            <g key={idx}>
              <polygon points={`${x - COL_W / 2 + 4},${base} ${x + COL_W / 2 - 4},${base} ${x},${apexY}`} fill={fill} opacity={0.92} />
              {isTarget && (
                <circle cx={x} cy={row === 'top' ? base + 26 : base - 26} r="9" fill={hittable.has(idx) ? '#f87171' : '#f5b14c'}>
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              {isSource && (
                <polygon points={`${x - COL_W / 2 + 4},${base} ${x + COL_W / 2 - 4},${base} ${x},${apexY}`} fill="none" stroke="#f5b14c" strokeWidth="2.5" opacity="0.7" />
              )}
            </g>
          );
        })}

        {/* checkers on points */}
        {Array.from({ length: 24 }, (_, idx) => {
          const color = colorAt(game.points, idx);
          if (!color) return null;
          const count = Math.abs(game.points[idx]);
          const { slot, row } = pos(idx);
          const x = slotX(slot);
          const shown = Math.min(count, 5);
          const isSel = selected === idx;
          return (
            <g key={`c${idx}`}>
              {Array.from({ length: shown }, (_, i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={checkerY(row, i)}
                  r={CHK_R}
                  fill={color === 'white' ? 'url(#wchk)' : 'url(#bchk)'}
                  stroke={isSel && i === shown - 1 ? '#f5b14c' : 'rgba(0,0,0,0.35)'}
                  strokeWidth={isSel && i === shown - 1 ? 3.5 : 1.5}
                />
              ))}
              {count > 5 && (
                <text x={x} y={checkerY(row, shown - 1) + 5} textAnchor="middle" fontSize="20" fontWeight="800" fill={color === 'white' ? '#3a2c12' : '#f3e9d2'}>
                  {count}
                </text>
              )}
              {hittable.has(idx) && <HitMark x={x} y={checkerY(row, 0)} />}
            </g>
          );
        })}

        {/* bar checkers */}
        {(['white', 'black'] as Player[]).map((color) => {
          const n = game.bar[color];
          if (n <= 0) return null;
          const side = sideOf(color);
          const fill = color === 'white' ? 'url(#wchk)' : 'url(#bchk)';
          const sel = color === youColor && selected === 'bar';
          return (
            <g key={`bar-${color}`}>
              {Array.from({ length: Math.min(n, 4) }, (_, i) => (
                <circle key={i} cx={BAR_X} cy={barCheckerY(side, i)} r={CHK_R} fill={fill} stroke={sel ? '#f5b14c' : 'rgba(0,0,0,0.35)'} strokeWidth={sel ? 3.5 : 1.5} />
              ))}
              {n > 4 && (
                <text x={BAR_X} y={barCheckerY(side, 3) + 5} textAnchor="middle" fontSize="18" fontWeight="800" fill={color === 'white' ? '#3a2c12' : '#f3e9d2'}>
                  {n}
                </text>
              )}
            </g>
          );
        })}

        {/* borne-off slabs */}
        {(['white', 'black'] as Player[]).map((color) =>
          Array.from({ length: game.off[color] }, (_, i) => {
            const bottom = sideOf(color) === 'bottom';
            const y = bottom ? BOT_Y0 - 14 - i * 15 : TOP_Y0 + 4 + i * 15;
            return <rect key={`off-${color}-${i}`} x={TRAY_X - 30} y={y} width="60" height="11" rx="3" fill={color === 'white' ? 'url(#wchk)' : 'url(#bchk)'} />;
          }),
        )}
        {offAvailable && (
          <rect x={TRAY_X - TRAY_W / 2 + 4} y={VB_H / 2} width={TRAY_W - 8} height={VB_H / 2 - MARGIN} rx="8" fill="none" stroke="#f5b14c" strokeWidth="3">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.1s" repeatCount="indefinite" />
          </rect>
        )}

        {/* transparent click targets on top */}
        {interactive &&
          Array.from({ length: 24 }, (_, idx) => {
            const { slot, row } = pos(idx);
            const x = slotX(slot);
            const y = row === 'top' ? MARGIN - 6 : VB_H / 2;
            return <rect key={`hit${idx}`} x={x - COL_W / 2} y={y} width={COL_W} height={VB_H / 2 - MARGIN} fill="transparent" className="cursor-pointer" onClick={() => clickPoint(idx)} />;
          })}
        {interactive && (
          <>
            <rect x={BAR_X - BAR_W / 2} y={MARGIN} width={BAR_W} height={VB_H - 2 * MARGIN} fill="transparent" className="cursor-pointer" onClick={clickBar} />
            <rect x={TRAY_X - TRAY_W / 2} y={MARGIN} width={TRAY_W} height={VB_H - 2 * MARGIN} fill="transparent" className="cursor-pointer" onClick={clickOff} />
          </>
        )}
      </svg>

      <MoveAnimation game={game} coordOf={coordOf} />
      <DiceOverlay view={view} />
      <RollOverlay view={view} onAction={onAction} />
    </div>
  );
}

// "You can hit this blot": a pulsing ✕ drawn over the checker itself with a
// dark halo, so it stays visible on both light points and dark checkers.
export function HitMark({ x, y, r = 25 }: { x: number; y: number; r?: number }) {
  const a = r * 0.44;
  return (
    <g pointerEvents="none">
      <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#0c1118" strokeWidth="6" opacity="0.55" />
      <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#ef4444" strokeWidth="3" />
      <g stroke="#0c1118" strokeWidth="8" strokeLinecap="round" opacity="0.55">
        <line x1={x - a} y1={y - a} x2={x + a} y2={y + a} />
        <line x1={x - a} y1={y + a} x2={x + a} y2={y - a} />
      </g>
      <g stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round">
        <line x1={x - a} y1={y - a} x2={x + a} y2={y + a} />
        <line x1={x - a} y1={y + a} x2={x + a} y2={y - a} />
      </g>
      <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite" />
    </g>
  );
}

// The primary action, on the board itself: no scrolling down to a side panel to
// roll — especially important on phones where the panel is below the fold.
function RollOverlay({ view, onAction }: { view: TavlaView; onAction: (a: Action) => void }) {
  const { game, youAre } = view;
  if (!youAre) return null;
  const canRoll =
    (game.phase === 'toRoll' && view.yourTurn) ||
    (game.phase === 'opening' && game.openingRolls[youAre] === null);
  if (!canRoll) return null;
  return (
    <div className="absolute inset-0 z-10 grid place-items-center">
      <button
        className="btn-primary animate-fade-up px-6 py-3 text-lg shadow-2xl"
        onClick={() => onAction({ type: 'roll' })}
      >
        🎲 Zar at
      </button>
    </div>
  );
}

function MoveAnimation({
  game,
  coordOf,
}: {
  game: TavlaView['game'];
  coordOf: (loc: number | 'bar' | 'off', color: Player) => { x: number; y: number };
}) {
  const prevSeq = useRef(game.moveSeq);
  const [anim, setAnim] = useState<{ seq: number; from: { x: number; y: number }; to: { x: number; y: number }; color: Player } | null>(null);

  useEffect(() => {
    if (game.moveSeq !== prevSeq.current && game.lastMove && game.lastMoveBy) {
      setAnim({
        seq: game.moveSeq,
        from: coordOf(game.lastMove.from, game.lastMoveBy),
        to: coordOf(game.lastMove.to, game.lastMoveBy),
        color: game.lastMoveBy,
      });
    }
    prevSeq.current = game.moveSeq;
    // coordOf intentionally excluded (recreated each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.moveSeq]);

  if (!anim) return null;
  return <MovingChecker key={anim.seq} from={anim.from} to={anim.to} color={anim.color} onDone={() => setAnim(null)} />;
}

function MovingChecker({
  from,
  to,
  color,
  onDone,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: Player;
  onDone: () => void;
}) {
  const [p, setP] = useState(from);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setP(to)));
    const t = setTimeout(onDone, 320);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      style={{
        position: 'absolute',
        left: `${(p.x / VB_W) * 100}%`,
        top: `${(p.y / VB_H) * 100}%`,
        width: `${((2 * CHK_R) / VB_W) * 100}%`,
        aspectRatio: '1',
        transform: 'translate(-50%,-50%)',
        borderRadius: '9999px',
        background: color === 'white' ? WHITE_BG : BLACK_BG,
        boxShadow: '0 3px 7px rgba(0,0,0,0.45)',
        transition: 'left 300ms cubic-bezier(0.4,0,0.2,1), top 300ms cubic-bezier(0.4,0,0.2,1)',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />
  );
}

function DiceOverlay({ view }: { view: TavlaView }) {
  const { game } = view;
  const xPct = (704 / VB_W) * 100;
  const yPct = 50;
  const wrap = (children: ReactNode, key: string) => (
    <div key={key} className="pointer-events-none absolute animate-fade-up" style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%,-50%)' }}>
      {/* scale down with the board so dice don't dwarf a phone-sized board */}
      <div className="flex gap-2 scale-[0.6] min-[480px]:scale-75 sm:scale-100">{children}</div>
    </div>
  );

  if (game.phase === 'opening') {
    return wrap(
      <>
        {game.openingRolls.white !== null && (
          <div className="flex flex-col items-center gap-1">
            <Die value={game.openingRolls.white} animate />
            <span className="text-[10px] font-bold text-cream/80">beyaz</span>
          </div>
        )}
        {game.openingRolls.black !== null && (
          <div className="flex flex-col items-center gap-1">
            <Die value={game.openingRolls.black} animate />
            <span className="text-[10px] font-bold text-cream/80">siyah</span>
          </div>
        )}
      </>,
      'opening',
    );
  }

  if (game.phase === 'moving' && game.dice.length > 0) {
    const remaining = [...game.remaining];
    const dice = game.dice.map((v) => {
      const idx = remaining.indexOf(v);
      const used = idx === -1;
      if (!used) remaining.splice(idx, 1);
      return { v, used };
    });
    return wrap(
      dice.map((d, i) => <Die key={i} value={d.v} used={d.used} />),
      `dice-${game.dice.join('-')}`,
    );
  }

  return null;
}
