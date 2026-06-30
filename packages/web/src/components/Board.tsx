// The tavla board: SVG points/checkers/bar/bear-off, an HTML dice overlay, and
// click-to-move. Orientation is fixed (white home bottom-right); the player's
// own colour and legal moves are highlighted so either side reads it easily.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

type Slot = { slot: number; row: 'top' | 'bottom' };

const SLOT_OF: Record<number, Slot> = {};
[11, 10, 9, 8, 7, 6].forEach((idx, i) => (SLOT_OF[idx] = { slot: i, row: 'bottom' }));
[5, 4, 3, 2, 1, 0].forEach((idx, i) => (SLOT_OF[idx] = { slot: 6 + i, row: 'bottom' }));
[12, 13, 14, 15, 16, 17].forEach((idx, i) => (SLOT_OF[idx] = { slot: i, row: 'top' }));
[18, 19, 20, 21, 22, 23].forEach((idx, i) => (SLOT_OF[idx] = { slot: 6 + i, row: 'top' }));

function slotX(slot: number): number {
  return slot < 6
    ? MARGIN + slot * COL_W + COL_W / 2
    : MARGIN + 6 * COL_W + BAR_W + (slot - 6) * COL_W + COL_W / 2;
}
const BAR_X = MARGIN + 6 * COL_W + BAR_W / 2;
const TRAY_X = MARGIN + 6 * COL_W + BAR_W + 6 * COL_W + TRAY_W / 2;

function checkerY(row: 'top' | 'bottom', i: number): number {
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
  const [selected, setSelected] = useState<number | 'bar' | null>(null);

  const sources = useMemo(() => new Set(legalMoves.map((m) => m.from)), [legalMoves]);

  useEffect(() => {
    if (selected !== null && !sources.has(selected)) setSelected(null);
  }, [sources, selected]);

  const targets = useMemo(() => {
    if (selected === null) return new Map<number | 'off', DieMove>();
    const map = new Map<number | 'off', DieMove>();
    for (const m of legalMoves) if (m.from === selected) map.set(m.to, m);
    return map;
  }, [legalMoves, selected]);

  function play(move: DieMove) {
    onAction({ type: 'move', move });
    setSelected(null);
  }

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
    if (!interactive) return;
    if (game.bar[youColor] > 0) clickSource('bar');
  }

  function clickOff() {
    if (!interactive) return;
    if (selected !== null && targets.has('off')) play(targets.get('off')!);
  }

  const barTargets = useMemo(() => {
    // when re-entering, "to" is a point index; collect them for highlight
    const set = new Set<number>();
    if (selected === 'bar') for (const m of legalMoves) if (m.from === 'bar') set.add(m.to as number);
    return set;
  }, [legalMoves, selected]);

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

        {/* frame + felt */}
        <rect x="0" y="0" width={VB_W} height={VB_H} rx="18" fill="#3a2614" />
        <rect x={MARGIN - 6} y={MARGIN - 6} width={6 * COL_W + 12} height={VB_H - 2 * MARGIN + 12} rx="8" fill="#1f6f54" />
        <rect
          x={MARGIN + 6 * COL_W + BAR_W - 6}
          y={MARGIN - 6}
          width={6 * COL_W + 12}
          height={VB_H - 2 * MARGIN + 12}
          rx="8"
          fill="#1f6f54"
        />
        {/* center bar */}
        <rect x={BAR_X - BAR_W / 2} y={MARGIN - 6} width={BAR_W} height={VB_H - 2 * MARGIN + 12} rx="6" fill="#2c1b0f" />
        {/* bear-off tray */}
        <rect x={TRAY_X - TRAY_W / 2} y={MARGIN - 6} width={TRAY_W} height={VB_H - 2 * MARGIN + 12} rx="8" fill="#241710" />

        {/* points */}
        {Array.from({ length: 24 }, (_, idx) => {
          const { slot, row } = SLOT_OF[idx];
          const x = slotX(slot);
          const base = row === 'top' ? TOP_Y0 : BOT_Y0;
          const apexY = row === 'top' ? TOP_Y0 + POINT_H : BOT_Y0 - POINT_H;
          const light = (slot + (row === 'top' ? 0 : 1)) % 2 === 0;
          const fill = light ? '#e9dcc0' : '#9c5a32';
          const isSource = interactive && sources.has(idx);
          const isTarget = interactive && (targets.has(idx) || barTargets.has(idx));
          return (
            <g key={idx}>
              <polygon
                points={`${x - COL_W / 2 + 4},${base} ${x + COL_W / 2 - 4},${base} ${x},${apexY}`}
                fill={fill}
                opacity={0.92}
              />
              {isTarget && (
                <circle cx={x} cy={row === 'top' ? base + 26 : base - 26} r="9" fill="#f5b14c">
                  <animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite" />
                </circle>
              )}
              {isSource && (
                <polygon
                  points={`${x - COL_W / 2 + 4},${base} ${x + COL_W / 2 - 4},${base} ${x},${apexY}`}
                  fill="none"
                  stroke="#f5b14c"
                  strokeWidth="2.5"
                  opacity="0.7"
                />
              )}
            </g>
          );
        })}

        {/* checkers on points */}
        {Array.from({ length: 24 }, (_, idx) => {
          const color = colorAt(game.points, idx);
          if (!color) return null;
          const count = Math.abs(game.points[idx]);
          const { slot, row } = SLOT_OF[idx];
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
                <text
                  x={x}
                  y={checkerY(row, shown - 1) + 5}
                  textAnchor="middle"
                  fontSize="20"
                  fontWeight="800"
                  fill={color === 'white' ? '#3a2c12' : '#f3e9d2'}
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}

        {/* bar checkers */}
        {game.bar.black > 0 &&
          Array.from({ length: Math.min(game.bar.black, 4) }, (_, i) => (
            <circle key={`bb${i}`} cx={BAR_X} cy={TOP_Y0 + CHK_R + 40 + i * STACK} r={CHK_R} fill="url(#bchk)" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
          ))}
        {game.bar.black > 4 && (
          <text x={BAR_X} y={TOP_Y0 + CHK_R + 40 + 3 * STACK + 5} textAnchor="middle" fontSize="18" fontWeight="800" fill="#f3e9d2">
            {game.bar.black}
          </text>
        )}
        {game.bar.white > 0 &&
          Array.from({ length: Math.min(game.bar.white, 4) }, (_, i) => (
            <circle key={`bw${i}`} cx={BAR_X} cy={BOT_Y0 - CHK_R - 40 - i * STACK} r={CHK_R} fill="url(#wchk)" stroke={selected === 'bar' ? '#f5b14c' : 'rgba(0,0,0,0.35)'} strokeWidth={selected === 'bar' ? 3.5 : 1.5} />
          ))}
        {game.bar.white > 4 && (
          <text x={BAR_X} y={BOT_Y0 - CHK_R - 40 - 3 * STACK + 5} textAnchor="middle" fontSize="18" fontWeight="800" fill="#3a2c12">
            {game.bar.white}
          </text>
        )}

        {/* borne-off slabs: white bottom, black top */}
        {Array.from({ length: game.off.white }, (_, i) => (
          <rect key={`ow${i}`} x={TRAY_X - 30} y={BOT_Y0 - 14 - i * 15} width="60" height="11" rx="3" fill="url(#wchk)" />
        ))}
        {Array.from({ length: game.off.black }, (_, i) => (
          <rect key={`ob${i}`} x={TRAY_X - 30} y={TOP_Y0 + 4 + i * 15} width="60" height="11" rx="3" fill="url(#bchk)" />
        ))}
        {offAvailable && (
          <rect
            x={TRAY_X - TRAY_W / 2 + 4}
            y={youColor === 'white' ? VB_H / 2 : MARGIN}
            width={TRAY_W - 8}
            height={VB_H / 2 - MARGIN}
            rx="8"
            fill="none"
            stroke="#f5b14c"
            strokeWidth="3"
          >
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.1s" repeatCount="indefinite" />
          </rect>
        )}

        {/* click targets (transparent, on top) */}
        {interactive &&
          Array.from({ length: 24 }, (_, idx) => {
            const { slot, row } = SLOT_OF[idx];
            const x = slotX(slot);
            const y = row === 'top' ? MARGIN - 6 : VB_H / 2;
            return (
              <rect
                key={`hit${idx}`}
                x={x - COL_W / 2}
                y={y}
                width={COL_W}
                height={VB_H / 2 - MARGIN}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => clickPoint(idx)}
              />
            );
          })}
        {interactive && (
          <>
            <rect x={BAR_X - BAR_W / 2} y={MARGIN} width={BAR_W} height={VB_H - 2 * MARGIN} fill="transparent" className="cursor-pointer" onClick={clickBar} />
            <rect x={TRAY_X - TRAY_W / 2} y={MARGIN} width={TRAY_W} height={VB_H - 2 * MARGIN} fill="transparent" className="cursor-pointer" onClick={clickOff} />
          </>
        )}
      </svg>

      <DiceOverlay view={view} />
    </div>
  );
}

function DiceOverlay({ view }: { view: TavlaView }) {
  const { game } = view;
  const xPct = (704 / VB_W) * 100;
  const yPct = (VB_H / 2 / VB_H) * 100;
  const wrap = (children: ReactNode, key: string) => (
    <div
      key={key}
      className="absolute flex animate-fade-up gap-2"
      style={{ left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%,-50%)' }}
    >
      {children}
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
