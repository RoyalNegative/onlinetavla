// Local single-player practice: runs the shared engine in the browser (no
// server). The user is white (seat 0); a simple random-move bot plays black.
// Auto-steps (tavla's forced pass) and bot turns advance one step at a time so
// the board animates and beginners can follow along.

import { useEffect, useRef, useState } from 'react';
import { games, mathRng } from '@tavla/engine';
import type { DamaView, TavlaView } from '@tavla/engine';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function usePractice(gameId: 'tavla' | 'dama') {
  const mod = games[gameId];
  const config = gameId === 'tavla' ? { mode: 'classic', targetPoints: 1 } : {};
  const [state, setState] = useState<any>(() => mod.createInitialState(config));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function botAction(s: any): any {
    if (mod.isOver(s)) return null;
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
      timer.current = setTimeout(() => pump(ns), 650);
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
    timer.current = setTimeout(() => pump(ns), 320);
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

  const view = mod.viewFor(state, 0) as TavlaView | DamaView;
  return { view, act, restart };
}
