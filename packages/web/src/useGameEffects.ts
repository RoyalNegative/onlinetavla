// Side-effects driven by the live view: sound effects and a tab-title flash
// when it becomes your turn while the tab is in the background. Works for all
// games (tavla's dice/moves, dama's moves/captures, amiral's shots).

import { useEffect, useRef } from 'react';
import type { BattleshipView, ChessView, DamaView, DortluView, MangalaView, SHView, TavlaView } from '@tavla/engine';
import { sfx } from './lib/sound';
import type { RoomUpdate } from './protocol';

export function useGameEffects(update: RoomUpdate | null): void {
  const prev = useRef({ moveSeq: 0, dice: '', barTotal: 0, over: false, yourTurn: false });
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
    const p = prev.current;
    // Secret Hitler's view has no youAre/color — every other game does.
    const you = 'youAre' in update.view ? update.view.youAre : null;
    const yourTurn = update.view.yourTurn;
    let moveSeq = p.moveSeq;
    let dice = p.dice;
    let barTotal = p.barTotal;
    let over = p.over;

    if (update.room.gameId === 'secrethitler') {
      const v = update.view as SHView;
      moveSeq = v.moveSeq;
      if (moveSeq !== p.moveSeq && v.phase !== 'lobby') sfx.move();
      over = v.phase === 'over';
      if (over && !p.over && v.yourRole && v.winner) {
        const myTeam = v.yourRole === 'liberal' ? 'liberal' : 'fascist';
        if (v.winner === myTeam) sfx.win();
        else sfx.lose();
      }
    } else if (update.room.gameId === 'amiral') {
      const v = update.view as BattleshipView;
      moveSeq = v.moveSeq;
      if (moveSeq !== p.moveSeq && v.lastShot) {
        if (v.lastShot.result === 'miss') sfx.move();
        else sfx.hit();
      }
      over = v.winner !== null;
      if (over && !p.over && you) {
        if (v.winner === you) sfx.win();
        else sfx.lose();
      }
    } else if (update.room.gameId === 'mangala') {
      const v = update.view as MangalaView;
      moveSeq = v.moveSeq;
      if (moveSeq !== p.moveSeq) {
        if (v.lastMove && v.lastMove.captured.length > 0) sfx.hit();
        else sfx.move();
      }
      over = v.phase === 'over';
      if (over && !p.over && you && v.winner) {
        if (v.winner === you) sfx.win();
        else sfx.lose();
      }
    } else if (update.room.gameId === 'dortlu') {
      const v = update.view as DortluView;
      moveSeq = v.moveSeq;
      if (moveSeq !== p.moveSeq) sfx.move();
      over = v.phase === 'over';
      if (over && !p.over && you && v.winner) {
        if (v.winner === you) sfx.win();
        else sfx.lose();
      }
    } else if (update.room.gameId === 'satranc') {
      const v = update.view as ChessView;
      moveSeq = v.moveSeq;
      // A check rings sharper than a plain move.
      if (moveSeq !== p.moveSeq) v.check ? sfx.hit() : sfx.move();
      over = v.over;
      if (over && !p.over && you && v.winner) {
        if (v.winner === you) sfx.win();
        else sfx.lose();
      }
    } else if (update.room.gameId === 'dama') {
      const v = update.view as DamaView;
      moveSeq = v.moveSeq;
      if (moveSeq !== p.moveSeq) {
        if (v.lastMove && v.lastMove.captures.length > 0) sfx.hit();
        else sfx.move();
      }
      over = v.winner !== null;
      if (over && !p.over && you) {
        if (v.winner === you) sfx.win();
        else sfx.lose();
      }
    } else {
      const g = (update.view as TavlaView).game;
      moveSeq = g.moveSeq;
      barTotal = g.bar.white + g.bar.black;
      dice = g.dice.join(',');
      if (moveSeq !== p.moveSeq) {
        if (barTotal > p.barTotal) sfx.hit();
        else sfx.move();
      }
      if (dice && dice !== p.dice) sfx.dice();
      const matchWinner = (update.view as TavlaView).matchWinner;
      over = matchWinner !== null || g.phase === 'gameOver';
      if (over && !p.over && you) {
        const winner = matchWinner ?? g.result?.winner;
        if (winner === you) sfx.win();
        else sfx.lose();
      }
    }

    if (yourTurn && !p.yourTurn) {
      sfx.turn();
      navigator.vibrate?.(60); // Android haptic nudge; iOS ignores it
      if (document.hidden) startFlash();
    }
    if (!document.hidden) stopFlash();

    prev.current = { moveSeq, dice, barTotal, over, yourTurn };
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
