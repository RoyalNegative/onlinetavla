// Mangala (Turkish mancala) engine — a GameModule for the hub.
//
// TMOF (Türkiye Mangala Federasyonu) single-set rules. Each player owns six
// pits and a treasury; 48 stones, four per pit. On your turn you lift a pit's
// stones, leave one behind (a lone stone moves instead) and sow counter-
// clockwise, dropping into your own treasury but skipping the opponent's.
//  - Last stone in your treasury → you move again.
//  - Last stone makes an opponent pit even → you capture that pit.
//  - Last stone lands in your own empty pit → you capture the opposite pit
//    (plus your stone), but only if the opposite pit is non-empty.
// The set ends the moment either side's pits are all empty; each player then
// banks the stones still sitting on their own side. Most stones wins.

import type { GameModule } from './module';
import { seatToColor } from './module';
import type { Player } from './types';

export const MANGALA_PITS = 6; // pits per side
export const MANGALA_SEED = 4; // stones per pit at start

export type MangalaAction = { type: 'sow'; pit: number } | { type: 'resign' };

export interface MangalaState {
  /** 14 slots: 0-5 seat0 pits, 6 seat0 treasury, 7-12 seat1 pits, 13 seat1 treasury. */
  pits: number[];
  turn: number; // seat to move
  phase: 'playing' | 'over';
  winner: number | null; // seat; null while playing or on a draw
  lastMove: MangalaLastMove | null;
  moveSeq: number;
}

export interface MangalaLastMove {
  seat: number;
  pit: number; // global index sown from
  landed: number; // global index the final stone reached
  /** Global pit indices emptied by a capture (opponent-even or opposite-pit). */
  captured: number[];
  extraTurn: boolean;
}

export interface MangalaView {
  pits: number[];
  turn: Player;
  youAre: Player | null;
  yourTurn: boolean;
  /** Global indices of the viewer's own sowable (non-empty) pits. */
  legalPits: number[];
  phase: MangalaState['phase'];
  winner: Player | null; // null on a draw too — check phase
  lastMove: MangalaLastMove | null;
  moveSeq: number;
}

export const treasuryOf = (seat: number) => seat * 7 + 6;
export const pitsOf = (seat: number) => Array.from({ length: MANGALA_PITS }, (_, i) => seat * 7 + i);
const ownsPit = (seat: number, g: number) => g >= seat * 7 && g < seat * 7 + MANGALA_PITS;
/** The opponent pit physically facing `g` (works from either side). */
export const oppositeOf = (g: number) => 12 - g;

export function createInitialMangala(): MangalaState {
  const pits = new Array<number>(14).fill(0);
  for (const s of [0, 1]) for (const g of pitsOf(s)) pits[g] = MANGALA_SEED;
  return { pits, turn: 0, phase: 'playing', winner: null, lastMove: null, moveSeq: 0 };
}

function sideEmpty(pits: number[], seat: number): boolean {
  return pitsOf(seat).every((g) => pits[g] === 0);
}

function applySow(state: MangalaState, seat: number, pit: unknown): void {
  if (state.turn !== seat) throw new Error('not_your_turn');
  if (typeof pit !== 'number' || !Number.isInteger(pit) || !ownsPit(seat, pit)) throw new Error('illegal_move');
  const pits = state.pits;
  const n = pits[pit];
  if (n === 0) throw new Error('illegal_move');

  const skip = treasuryOf(1 - seat);
  const next = (g: number) => {
    let x = (g + 1) % 14;
    if (x === skip) x = (x + 1) % 14;
    return x;
  };

  // A lone stone moves to the next pit; otherwise one stays and the rest sow.
  let pos = pit;
  let carry: number;
  if (n === 1) {
    pits[pit] = 0;
    carry = 1;
  } else {
    pits[pit] = 1;
    carry = n - 1;
  }
  while (carry > 0) {
    pos = next(pos);
    pits[pos] += 1;
    carry -= 1;
  }

  const captured: number[] = [];
  let extraTurn = false;
  if (pos === treasuryOf(seat)) {
    extraTurn = true;
  } else if (ownsPit(1 - seat, pos) && pits[pos] % 2 === 0) {
    pits[treasuryOf(seat)] += pits[pos];
    pits[pos] = 0;
    captured.push(pos);
  } else if (ownsPit(seat, pos) && pits[pos] === 1) {
    const opp = oppositeOf(pos);
    if (pits[opp] > 0) {
      pits[treasuryOf(seat)] += pits[opp] + 1;
      pits[opp] = 0;
      pits[pos] = 0;
      captured.push(opp, pos);
    }
  }

  state.lastMove = { seat, pit, landed: pos, captured, extraTurn };
  state.moveSeq += 1;
  if (!extraTurn) state.turn = 1 - seat;

  // Set over? Whoever still has stones on their side banks them.
  if (sideEmpty(pits, 0) || sideEmpty(pits, 1)) {
    for (const s of [0, 1]) {
      for (const g of pitsOf(s)) {
        pits[treasuryOf(s)] += pits[g];
        pits[g] = 0;
      }
    }
    state.phase = 'over';
    const [a, b] = [pits[treasuryOf(0)], pits[treasuryOf(1)]];
    state.winner = a === b ? null : a > b ? 0 : 1;
  }
}

function cloneState(s: MangalaState): MangalaState {
  return {
    pits: s.pits.slice(),
    turn: s.turn,
    phase: s.phase,
    winner: s.winner,
    lastMove: s.lastMove ? { ...s.lastMove, captured: [...s.lastMove.captured] } : null,
    moveSeq: s.moveSeq,
  };
}

export const mangalaModule: GameModule<MangalaState, MangalaAction, unknown, MangalaView> = {
  id: 'mangala',
  name: 'Mangala',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState() {
    return createInitialMangala();
  },

  applyAction(state, action, seat) {
    if (state.phase === 'over') throw new Error('game_over');
    const next = cloneState(state);
    if (action.type === 'sow') {
      applySow(next, seat, action.pit);
    } else if (action.type === 'resign') {
      next.winner = 1 - seat;
      next.phase = 'over';
      next.moveSeq += 1;
    } else {
      throw new Error('unknown_action');
    }
    return next;
  },

  isOver(state) {
    return state.phase === 'over';
  },

  viewFor(state, seat) {
    const youAre = seat === null ? null : seatToColor(seat);
    const yourTurn = seat !== null && state.phase === 'playing' && state.turn === seat;
    return {
      pits: state.pits.slice(),
      turn: seatToColor(state.turn),
      youAre,
      yourTurn,
      legalPits: yourTurn ? pitsOf(seat!).filter((g) => state.pits[g] > 0) : [],
      phase: state.phase,
      winner: state.winner === null ? null : seatToColor(state.winner),
      lastMove: state.lastMove,
      moveSeq: state.moveSeq,
    };
  },

  needsAutoStep() {
    return null;
  },

  result(state) {
    if (state.phase !== 'over' || state.winner === null) return null; // draws aren't recorded
    return {
      winnerSeat: state.winner,
      kind: 'win',
      scores: [state.pits[treasuryOf(0)], state.pits[treasuryOf(1)]],
    };
  },
};
