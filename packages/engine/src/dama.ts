// Türk Daması (Turkish draughts) engine — the platform's second GameModule.
//
// 8x8, all squares used. 16 men each on the 2nd/3rd ranks. Men move & capture
// orthogonally forward and sideways (never backward). Reaching the far rank
// promotes to a flying king (moves/captures any distance orthogonally). Captures
// are mandatory and must take the maximum number of pieces.

import { otherPlayer } from './board';
import type { GameModule } from './module';
import type { Player } from './types';

export interface DamaMove {
  from: number;
  to: number;
  captures: number[]; // captured cell indices, in order
}

export type DamaAction = { type: 'move'; move: DamaMove } | { type: 'resign' };

export interface DamaState {
  board: number[]; // 64 cells: 0 empty, ±1 man, ±2 king (white +, black -)
  turn: Player;
  winner: Player | null;
  lastMove: DamaMove | null;
  moveSeq: number;
}

export interface DamaView {
  board: number[];
  turn: Player;
  youAre: Player | null;
  yourTurn: boolean;
  legalMoves: DamaMove[];
  winner: Player | null;
  counts: { white: number; black: number };
  lastMove: DamaMove | null;
  moveSeq: number;
}

const KING_STEPS = [8, -8, 1, -1];
const sgn = (p: Player) => (p === 'white' ? 1 : -1);
const ownerOf = (cell: number): Player | null => (cell > 0 ? 'white' : cell < 0 ? 'black' : null);
const isKingCell = (cell: number) => Math.abs(cell) === 2;
const forwardStep = (p: Player) => (p === 'white' ? 8 : -8);
const manSteps = (p: Player) => [forwardStep(p), 1, -1];
const promoRow = (p: Player) => (p === 'white' ? 7 : 0);
const isPromo = (i: number, p: Player) => Math.floor(i / 8) === promoRow(p);

/** Next cell along a step, or -1 if it would leave the board / wrap a column. */
function stepCell(i: number, step: number): number {
  const col = i % 8;
  if (step === 1) return col < 7 ? i + 1 : -1;
  if (step === -1) return col > 0 ? i - 1 : -1;
  if (step === 8) return i + 8 < 64 ? i + 8 : -1;
  if (step === -8) return i - 8 >= 0 ? i - 8 : -1;
  return -1;
}

export function createInitialDama(): DamaState {
  const board = new Array<number>(64).fill(0);
  for (let col = 0; col < 8; col++) {
    board[1 * 8 + col] = 1;
    board[2 * 8 + col] = 1;
    board[5 * 8 + col] = -1;
    board[6 * 8 + col] = -1;
  }
  return { board, turn: 'white', winner: null, lastMove: null, moveSeq: 0 };
}

function findManCapture(board: number[], i: number, step: number, p: Player) {
  const mid = stepCell(i, step);
  if (mid < 0 || ownerOf(board[mid]) !== otherPlayer(p)) return null;
  const land = stepCell(mid, step);
  if (land < 0 || board[land] !== 0) return null;
  return { enemy: mid, landings: [land] };
}

function findKingCapture(board: number[], i: number, step: number, p: Player) {
  let c = stepCell(i, step);
  while (c >= 0 && board[c] === 0) c = stepCell(c, step);
  if (c < 0 || ownerOf(board[c]) !== otherPlayer(p)) return null;
  const landings: number[] = [];
  let l = stepCell(c, step);
  while (l >= 0 && board[l] === 0) {
    landings.push(l);
    l = stepCell(l, step);
  }
  return landings.length ? { enemy: c, landings } : null;
}

/** All capture sequences from `i`; returns [{to:i,captures:[]}] if none exist. */
function captureSeqs(board: number[], i: number, p: Player, king: boolean): { to: number; captures: number[] }[] {
  const steps = king ? KING_STEPS : manSteps(p);
  const out: { to: number; captures: number[] }[] = [];
  let any = false;
  for (const step of steps) {
    const hit = king ? findKingCapture(board, i, step, p) : findManCapture(board, i, step, p);
    if (!hit) continue;
    for (const landing of hit.landings) {
      any = true;
      const nb = board.slice();
      nb[hit.enemy] = 0;
      nb[i] = 0;
      const becameKing = king || isPromo(landing, p);
      nb[landing] = sgn(p) * (becameKing ? 2 : 1);
      // A man promoting mid-capture ends the sequence (Turkish rule).
      if (!king && becameKing) {
        out.push({ to: landing, captures: [hit.enemy] });
        continue;
      }
      const sub = captureSeqs(nb, landing, p, becameKing).filter((s) => s.captures.length > 0);
      if (!sub.length) out.push({ to: landing, captures: [hit.enemy] });
      else for (const s of sub) out.push({ to: s.to, captures: [hit.enemy, ...s.captures] });
    }
  }
  return any ? out : [{ to: i, captures: [] }];
}

function simpleMoves(board: number[], i: number, p: Player, king: boolean): DamaMove[] {
  const out: DamaMove[] = [];
  const steps = king ? KING_STEPS : manSteps(p);
  for (const step of steps) {
    if (king) {
      let c = stepCell(i, step);
      while (c >= 0 && board[c] === 0) {
        out.push({ from: i, to: c, captures: [] });
        c = stepCell(c, step);
      }
    } else {
      const c = stepCell(i, step);
      if (c >= 0 && board[c] === 0) out.push({ from: i, to: c, captures: [] });
    }
  }
  return out;
}

export function generateMoves(state: DamaState): DamaMove[] {
  const p = state.turn;
  const caps: DamaMove[] = [];
  for (let i = 0; i < 64; i++) {
    if (ownerOf(state.board[i]) !== p) continue;
    for (const s of captureSeqs(state.board, i, p, isKingCell(state.board[i]))) {
      if (s.captures.length > 0) caps.push({ from: i, to: s.to, captures: s.captures });
    }
  }
  if (caps.length) {
    const max = Math.max(...caps.map((c) => c.captures.length));
    return caps.filter((c) => c.captures.length === max);
  }
  const moves: DamaMove[] = [];
  for (let i = 0; i < 64; i++) {
    if (ownerOf(state.board[i]) === p) moves.push(...simpleMoves(state.board, i, p, isKingCell(state.board[i])));
  }
  return moves;
}

function countPieces(board: number[], p: Player): number {
  let n = 0;
  for (const c of board) if (ownerOf(c) === p) n++;
  return n;
}

export function applyDamaMove(state: DamaState, player: Player, move: DamaMove): void {
  if (state.turn !== player) throw new Error('not_your_turn');
  const legal = generateMoves(state).filter((m) => m.from === move.from && m.to === move.to);
  if (!legal.length) throw new Error('illegal_move');
  // Use the canonical (max-capture) move; don't trust client-supplied captures.
  const chosen = legal.reduce((a, b) => (b.captures.length > a.captures.length ? b : a));

  for (const c of chosen.captures) state.board[c] = 0;
  const piece = state.board[chosen.from];
  state.board[chosen.from] = 0;
  const becameKing = !isKingCell(piece) && isPromo(chosen.to, player);
  state.board[chosen.to] = becameKing ? sgn(player) * 2 : piece;

  state.lastMove = chosen;
  state.moveSeq += 1;
  state.turn = otherPlayer(player);

  const opp = state.turn;
  if (countPieces(state.board, opp) === 0 || generateMoves(state).length === 0) {
    state.winner = player;
  }
}

export function resignDama(state: DamaState, player: Player): void {
  if (state.winner) throw new Error('game_over');
  state.winner = otherPlayer(player);
}

function cloneState(s: DamaState): DamaState {
  return {
    board: s.board.slice(),
    turn: s.turn,
    winner: s.winner,
    lastMove: s.lastMove ? { ...s.lastMove, captures: [...s.lastMove.captures] } : null,
    moveSeq: s.moveSeq,
  };
}

export const damaModule: GameModule<DamaState, DamaAction, unknown, DamaView> = {
  id: 'dama',
  name: 'Dama',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState() {
    return createInitialDama();
  },

  applyAction(state, action, seat) {
    if (state.winner) throw new Error('game_over');
    const next = cloneState(state);
    const player: Player = seat === 0 ? 'white' : 'black';
    if (action.type === 'move') applyDamaMove(next, player, action.move);
    else if (action.type === 'resign') resignDama(next, player);
    else throw new Error('unknown_action');
    return next;
  },

  isOver(state) {
    return state.winner !== null;
  },

  viewFor(state, seat) {
    const youAre: Player | null = seat === null ? null : seat === 0 ? 'white' : 'black';
    const yourTurn = youAre !== null && state.turn === youAre && state.winner === null;
    return {
      board: state.board,
      turn: state.turn,
      youAre,
      yourTurn,
      legalMoves: yourTurn ? generateMoves(state) : [],
      winner: state.winner,
      counts: { white: countPieces(state.board, 'white'), black: countPieces(state.board, 'black') },
      lastMove: state.lastMove,
      moveSeq: state.moveSeq,
    };
  },

  needsAutoStep() {
    return null;
  },

  result(state) {
    if (!state.winner) return null;
    return {
      winnerSeat: state.winner === 'white' ? 0 : 1,
      kind: 'win',
      scores: [countPieces(state.board, 'white'), countPieces(state.board, 'black')],
    };
  },
};
