// Local single-player practice: runs the shared engine in the browser (no
// server). The user is white (seat 0); a simple bot plays black — random moves
// in tavla/dama, hunt-and-target in amiral. Auto-steps (tavla's forced pass)
// and bot turns advance one step at a time so the board animates and beginners
// can follow along.

import { useEffect, useMemo, useRef, useState } from 'react';
import { games, mathRng, randomFleet } from '@tavla/engine';
import type { BattleshipState, BattleshipView, DamaView, GameId, TavlaView } from '@tavla/engine';
import { isTension } from './components/BattleshipBoard';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Amiral bot: classic hunt & target ----
// Hunt: fire at a checkerboard parity cell (every ship covers one). Target:
// once a ship is hit but not sunk, try its neighbours — and when two hits line
// up, extend that line first.
function amiralBotShot(s: BattleshipState): number {
  const N = 10;
  const shots = s.shots[1]; // bot = seat 1, firing at the player's board
  const fleet = s.fleets[0]!;
  const shot = new Set(shots);
  const hits = shots.filter((c) => fleet.some((ship) => ship.includes(c)));
  const hitSet = new Set(hits);
  const sunkCells = new Set(fleet.filter((ship) => ship.every((c) => hitSet.has(c))).flat());
  const active = hits.filter((c) => !sunkCells.has(c));

  const neighbors = (c: number) => {
    const r = Math.floor(c / N);
    const col = c % N;
    const out: number[] = [];
    if (r > 0) out.push(c - N);
    if (r < N - 1) out.push(c + N);
    if (col > 0) out.push(c - 1);
    if (col < N - 1) out.push(c + 1);
    return out;
  };

  if (active.length) {
    let targets: number[] = [];
    const sorted = [...active].sort((a, b) => a - b);
    const sameRow = active.length >= 2 && new Set(active.map((c) => Math.floor(c / N))).size === 1;
    const sameCol = active.length >= 2 && new Set(active.map((c) => c % N)).size === 1;
    if (sameRow) {
      const row = Math.floor(sorted[0] / N);
      targets = [sorted[0] - 1, sorted[sorted.length - 1] + 1].filter((c) => c >= 0 && Math.floor(c / N) === row);
    } else if (sameCol) {
      targets = [sorted[0] - N, sorted[sorted.length - 1] + N].filter((c) => c >= 0 && c < N * N);
    }
    targets = targets.filter((c) => !shot.has(c));
    if (!targets.length) targets = active.flatMap(neighbors).filter((c) => !shot.has(c));
    if (targets.length) return pickRandom(targets);
  }

  const unshot: number[] = [];
  for (let c = 0; c < N * N; c++) if (!shot.has(c)) unshot.push(c);
  const parity = unshot.filter((c) => (Math.floor(c / N) + (c % N)) % 2 === 0);
  return pickRandom(parity.length ? parity : unshot);
}

export function usePractice(gameId: GameId, opts?: { noTouch?: boolean }) {
  const mod = games[gameId];
  const config =
    gameId === 'tavla'
      ? { mode: 'classic', targetPoints: 1 }
      : gameId === 'amiral'
        ? { noTouch: opts?.noTouch !== false }
        : {};
  const [state, setState] = useState<any>(() => mod.createInitialState(config));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function botAction(s: any): any {
    if (mod.isOver(s)) return null;
    if (gameId === 'amiral') {
      const bs = s as BattleshipState;
      if (bs.phase === 'placing') return bs.fleets[1] ? null : { type: 'place', ships: randomFleet(mathRng, bs.noTouch) };
      if (bs.phase !== 'battle' || bs.turn !== 1) return null;
      return { type: 'fire', cell: amiralBotShot(bs) };
    }
    if (gameId === 'dama') {
      if (s.turn !== 'black') return null;
      const bv = mod.viewFor(s, 1) as DamaView;
      return bv.legalMoves.length ? { type: 'move', move: pickRandom(bv.legalMoves) } : null;
    }
    const g = s.game;
    if (s.matchWinner || g.phase === 'gameOver') return null;
    if (g.phase === 'opening') return g.openingRolls.black === null ? { type: 'roll' } : null;
    if (g.turn !== 'black') return null;
    if (g.phase === 'toRoll') return { type: 'roll' };
    if (g.phase === 'moving') {
      const bv = mod.viewFor(s, 1) as TavlaView;
      return bv.legalMoves.length ? { type: 'move', move: pickRandom(bv.legalMoves) } : null;
    }
    return null;
  }

  // Amiral shots animate as falling bombs (slow-motion in the endgame) — the
  // bot waits for the previous bomb to land before acting.
  function stepDelay(s: any): number {
    if (gameId !== 'amiral') return 650;
    const v = mod.viewFor(s, null) as BattleshipView;
    return isTension(v) ? 2400 : 1300;
  }

  function pump(s: any) {
    if (mod.isOver(s)) return setState(s);
    const auto = mod.needsAutoStep?.(s);
    if (auto) {
      const ns = mod.applyAction(s, auto.action, auto.seat, mathRng);
      setState(ns);
      timer.current = setTimeout(() => pump(ns), 700);
      return;
    }
    const bot = botAction(s);
    if (bot) {
      const ns = mod.applyAction(s, bot, 1, mathRng);
      setState(ns);
      timer.current = setTimeout(() => pump(ns), stepDelay(ns));
      return;
    }
    setState(s);
  }

  function act(action: any) {
    let ns;
    try {
      ns = mod.applyAction(state, action, 0, mathRng);
    } catch {
      return;
    }
    setState(ns);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => pump(ns), gameId === 'amiral' ? stepDelay(ns) : 320);
  }

  function restart() {
    if (timer.current) clearTimeout(timer.current);
    const fresh = mod.createInitialState(config);
    setState(fresh);
    timer.current = setTimeout(() => pump(fresh), 450);
  }

  useEffect(() => {
    timer.current = setTimeout(() => pump(state), 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoized so consumers (e.g. useBattleshipFx) can key effects on identity.
  const view = useMemo(() => mod.viewFor(state, 0), [mod, state]) as TavlaView | DamaView | BattleshipView;
  return { view, act, restart };
}
