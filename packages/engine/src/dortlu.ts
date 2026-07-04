// 4'ü Bağla (Connect Four) engine — a GameModule for the hub.
//
// 7 columns x 6 rows. Players drop a disc into a column; it falls to the
// lowest free cell. First to line up four (any direction) wins; a full board
// with no line is a draw. Fast rounds, zero configuration.

import type { GameModule } from './module';
import { seatToColor } from './module';
import type { Player } from './types';

export const DORTLU_COLS = 7;
export const DORTLU_ROWS = 6;

export type DortluAction = { type: 'drop'; col: number } | { type: 'resign' };

export interface DortluState {
  /** 42 cells, row-major with row 0 at the BOTTOM: -1 empty, else the seat. */
  cells: number[];
  turn: number; // seat to move
  phase: 'playing' | 'over';
  winner: number | null; // seat; null while playing or on a draw
  winLine: number[] | null; // the four winning cell indices
  lastDrop: { seat: number; col: number; row: number } | null;
  moveSeq: number;
}

export interface DortluView {
  cells: number[];
  turn: Player;
  youAre: Player | null;
  yourTurn: boolean;
  /** Columns that still have room (empty when it isn't your turn). */
  legalCols: number[];
  phase: DortluState['phase'];
  winner: Player | null; // null on a draw too — check phase
  winLine: number[] | null;
  lastDrop: DortluState['lastDrop'];
  moveSeq: number;
}

const C = DORTLU_COLS;
const R = DORTLU_ROWS;
const at = (r: number, c: number) => r * C + c;

function openCols(cells: number[]): number[] {
  const out: number[] = [];
  for (let c = 0; c < C; c++) if (cells[at(R - 1, c)] === -1) out.push(c);
  return out;
}

/** The four-cell line through (r,c), or null. Checks →, ↑, ↗, ↘ families. */
function findWin(cells: number[], r: number, c: number): number[] | null {
  const who = cells[at(r, c)];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]] as const) {
    const line = [at(r, c)];
    for (const sign of [1, -1]) {
      let nr = r + dr * sign;
      let nc = c + dc * sign;
      while (nr >= 0 && nr < R && nc >= 0 && nc < C && cells[at(nr, nc)] === who) {
        line.push(at(nr, nc));
        nr += dr * sign;
        nc += dc * sign;
      }
    }
    if (line.length >= 4) {
      line.sort((a, b) => a - b);
      return line.slice(0, 4);
    }
  }
  return null;
}

export function createInitialDortlu(): DortluState {
  return {
    cells: new Array<number>(C * R).fill(-1),
    turn: 0,
    phase: 'playing',
    winner: null,
    winLine: null,
    lastDrop: null,
    moveSeq: 0,
  };
}

function applyDrop(state: DortluState, seat: number, col: unknown): void {
  if (state.turn !== seat) throw new Error('not_your_turn');
  if (typeof col !== 'number' || !Number.isInteger(col) || col < 0 || col >= C) throw new Error('illegal_move');
  let row = -1;
  for (let r = 0; r < R; r++) {
    if (state.cells[at(r, col)] === -1) {
      row = r;
      break;
    }
  }
  if (row === -1) throw new Error('illegal_move');

  state.cells[at(row, col)] = seat;
  state.lastDrop = { seat, col, row };
  state.moveSeq += 1;

  const line = findWin(state.cells, row, col);
  if (line) {
    state.winner = seat;
    state.winLine = line;
    state.phase = 'over';
    return;
  }
  if (openCols(state.cells).length === 0) {
    state.phase = 'over'; // draw: winner stays null
    return;
  }
  state.turn = 1 - seat;
}

function cloneState(s: DortluState): DortluState {
  return {
    cells: s.cells.slice(),
    turn: s.turn,
    phase: s.phase,
    winner: s.winner,
    winLine: s.winLine ? [...s.winLine] : null,
    lastDrop: s.lastDrop ? { ...s.lastDrop } : null,
    moveSeq: s.moveSeq,
  };
}

export const dortluModule: GameModule<DortluState, DortluAction, unknown, DortluView> = {
  id: 'dortlu',
  name: "4'ü Bağla",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState() {
    return createInitialDortlu();
  },

  applyAction(state, action, seat) {
    if (state.phase === 'over') throw new Error('game_over');
    const next = cloneState(state);
    if (action.type === 'drop') {
      applyDrop(next, seat, action.col);
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
      cells: state.cells.slice(),
      turn: seatToColor(state.turn),
      youAre,
      yourTurn,
      legalCols: yourTurn ? openCols(state.cells) : [],
      phase: state.phase,
      winner: state.winner === null ? null : seatToColor(state.winner),
      winLine: state.winLine,
      lastDrop: state.lastDrop,
      moveSeq: state.moveSeq,
    };
  },

  needsAutoStep() {
    return null;
  },

  result(state) {
    if (state.phase !== 'over' || state.winner === null) return null; // draws aren't recorded
    const count = (seat: number) => state.cells.filter((x) => x === seat).length;
    return {
      winnerSeat: state.winner,
      kind: 'win',
      scores: [count(0), count(1)],
    };
  },
};
