// Side-effects driven by the live view: sound effects and a tab-title flash
// when it becomes your turn while the tab is in the background.

import { useEffect, useRef } from 'react';
import { sfx } from './lib/sound';
import type { RoomUpdate } from './protocol';

export function useGameEffects(update: RoomUpdate | null): void {
  const prev = useRef({
    moveSeq: 0,
    dice: '',
    barTotal: 0,
    phase: '',
    matchWinner: null as string | null,
    yourTurn: false,
  });
  const flash = useRef<ReturnType<typeof setInterval> | null>(null);
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title : 'Tavla');

  function stopFlash() {
    if (flash.current) {
      clearInterval(flash.current);
      flash.current = null;
      document.title = baseTitle.current;
    }
  }
  function startFlash() {
    if (flash.current) return;
    let on = false;
    flash.current = setInterval(() => {
      document.title = on ? baseTitle.current : '⚡ Sıra sende! · ' + baseTitle.current;
      on = !on;
    }, 900);
  }

  useEffect(() => {
    if (!update) return;
    const g = update.view.game;
    const p = prev.current;
    const barTotal = g.bar.white + g.bar.black;

    if (g.moveSeq !== p.moveSeq) {
      if (barTotal > p.barTotal) sfx.hit();
      else sfx.move();
    }

    const diceSig = g.dice.join(',');
    if (diceSig && diceSig !== p.dice) sfx.dice();

    if (update.view.matchWinner && update.view.matchWinner !== p.matchWinner) {
      if (update.view.matchWinner === update.view.youAre) sfx.win();
      else sfx.lose();
    } else if (g.phase === 'gameOver' && p.phase !== 'gameOver' && !update.view.matchWinner) {
      if (g.result?.winner === update.view.youAre) sfx.win();
      else sfx.lose();
    }

    if (update.view.yourTurn && !p.yourTurn) {
      sfx.turn();
      if (document.hidden) startFlash();
    }
    if (!document.hidden) stopFlash();

    prev.current = {
      moveSeq: g.moveSeq,
      dice: diceSig,
      barTotal,
      phase: g.phase,
      matchWinner: update.view.matchWinner,
      yourTurn: update.view.yourTurn,
    };
  }, [update]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) stopFlash();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stopFlash();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
