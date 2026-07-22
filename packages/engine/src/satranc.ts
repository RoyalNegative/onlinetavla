// Satranç (chess) engine — a GameModule for the hub.
//
// Full rules: piece movement, castling, en passant, promotion, check /
// checkmate / stalemate, plus the automatic draws (insufficient material,
// fifty-move, threefold repetition). Board is a flat 64-array of piece codes
// (white positive, black negative): P1 N2 B3 R4 Q5 K6. Index = rank*8 + file,
// with rank 0 = white's home rank ("1") and file 0 = 'a'.

import type { GameModule } from './module';
import { seatToColor } from './module';
import type { Player } from './types';

export type ChessColor = Player; // 'white' | 'black'
export type ChessEndReason = 'checkmate' | 'stalemate' | 'fifty' | 'threefold' | 'insufficient' | 'resign';

export interface ChessMove {
  from: number;
  to: number;
  promo?: 'q' | 'r' | 'b' | 'n';
  flag?: 'double' | 'ep' | 'castle';
}

export type ChessAction = { type: 'move'; from: number; to: number; promo?: 'q' | 'r' | 'b' | 'n' } | { type: 'resign' };

export interface ChessState {
  board: number[]; // 64
  turn: ChessColor;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  ep: number | null; // en passant target square, or null
  halfmove: number; // plies since last pawn move or capture (fifty-move rule)
  fullmove: number;
  reps: Record<string, number>; // position key -> occurrences (threefold)
  winner: ChessColor | null;
  over: boolean;
  reason: ChessEndReason | null;
  lastMove: { from: number; to: number } | null;
  moveSeq: number;
}

export interface ChessView {
  board: number[];
  turn: ChessColor;
  youAre: ChessColor | null;
  yourTurn: boolean;
  legalMoves: ChessMove[]; // only populated on your turn
  check: boolean; // the side to move is in check
  checkSquare: number | null; // that king's square, for a highlight
  winner: ChessColor | null;
  over: boolean;
  reason: ChessEndReason | null;
  lastMove: { from: number; to: number } | null;
  captured: { white: number[]; black: number[] }; // piece types each side has lost
  moveSeq: number;
}

const PROMO: Record<'q' | 'r' | 'b' | 'n', number> = { q: 5, r: 4, b: 3, n: 2 };
const VALUE = [0, 1, 3, 3, 5, 9, 0]; // by piece type; king 0

const fileOf = (i: number) => i % 8;
const rankOf = (i: number) => Math.floor(i / 8);
const isWhite = (c: number) => c > 0;
const sameSide = (c: number, white: boolean) => c !== 0 && isWhite(c) === white;
const sq = (file: number, rank: number) => rank * 8 + file;

const KNIGHT_D = [
  [1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2],
] as const;
const KING_D = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
] as const;
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

const START: number[] = (() => {
  const b = new Array<number>(64).fill(0);
  const back = [4, 2, 3, 5, 6, 3, 2, 4];
  for (let f = 0; f < 8; f++) {
    b[sq(f, 0)] = back[f];
    b[sq(f, 1)] = 1;
    b[sq(f, 6)] = -1;
    b[sq(f, 7)] = -back[f];
  }
  return b;
})();

export function createInitialChess(): ChessState {
  const state: ChessState = {
    board: START.slice(),
    turn: 'white',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null,
    halfmove: 0,
    fullmove: 1,
    reps: {},
    winner: null,
    over: false,
    reason: null,
    lastMove: null,
    moveSeq: 0,
  };
  state.reps[positionKey(state)] = 1;
  return state;
}

function positionKey(s: ChessState): string {
  const c = s.castling;
  return `${s.board.join(',')}|${s.turn}|${c.wK ? 'K' : ''}${c.wQ ? 'Q' : ''}${c.bK ? 'k' : ''}${c.bQ ? 'q' : ''}|${s.ep ?? '-'}`;
}

function kingSquare(board: number[], white: boolean): number {
  const k = white ? 6 : -6;
  return board.indexOf(k);
}

/** Is `target` attacked by any piece of the given side? */
export function isAttacked(board: number[], target: number, byWhite: boolean): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);

  // Pawns: a piece on `target` is attacked from the two squares diagonally in
  // front of it from the attacker's perspective.
  const pawnRank = byWhite ? tr - 1 : tr + 1;
  if (pawnRank >= 0 && pawnRank < 8) {
    const pawn = byWhite ? 1 : -1;
    for (const df of [-1, 1]) {
      const f = tf + df;
      if (f >= 0 && f < 8 && board[sq(f, pawnRank)] === pawn) return true;
    }
  }

  // Knights.
  const knight = byWhite ? 2 : -2;
  for (const [df, dr] of KNIGHT_D) {
    const f = tf + df;
    const r = tr + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8 && board[sq(f, r)] === knight) return true;
  }

  // King (adjacent).
  const king = byWhite ? 6 : -6;
  for (const [df, dr] of KING_D) {
    const f = tf + df;
    const r = tr + dr;
    if (f >= 0 && f < 8 && r >= 0 && r < 8 && board[sq(f, r)] === king) return true;
  }

  // Sliding pieces.
  const bishop = byWhite ? 3 : -3;
  const rook = byWhite ? 4 : -4;
  const queen = byWhite ? 5 : -5;
  for (const [df, dr] of DIAG) {
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const c = board[sq(f, r)];
      if (c !== 0) {
        if (c === bishop || c === queen) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  for (const [df, dr] of ORTHO) {
    let f = tf + df;
    let r = tr + dr;
    while (f >= 0 && f < 8 && r >= 0 && r < 8) {
      const c = board[sq(f, r)];
      if (c !== 0) {
        if (c === rook || c === queen) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  return false;
}

function inCheck(board: number[], white: boolean): boolean {
  const ks = kingSquare(board, white);
  return ks >= 0 && isAttacked(board, ks, !white);
}

/** Apply a move to a board copy, resolving en passant / castling / promotion. */
function applyToBoard(board: number[], m: ChessMove): number[] {
  const b = board.slice();
  const piece = b[m.from];
  const white = isWhite(piece);
  b[m.from] = 0;
  if (m.flag === 'ep') {
    b[white ? m.to - 8 : m.to + 8] = 0;
  }
  if (m.flag === 'castle') {
    if (m.to === 6) { b[7] = 0; b[5] = 4; }
    else if (m.to === 2) { b[0] = 0; b[3] = 4; }
    else if (m.to === 62) { b[63] = 0; b[61] = -4; }
    else if (m.to === 58) { b[56] = 0; b[59] = -4; }
  }
  b[m.to] = m.promo ? (white ? 1 : -1) * PROMO[m.promo] : piece;
  return b;
}

/** Pseudo-legal moves (ignoring whether the king is left in check). */
function pseudoMoves(state: ChessState): ChessMove[] {
  const { board } = state;
  const white = state.turn === 'white';
  const out: ChessMove[] = [];
  const push = (m: ChessMove) => out.push(m);
  const dir = white ? 1 : -1;
  const startRank = white ? 1 : 6;
  const promoRank = white ? 7 : 0;

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p === 0 || isWhite(p) !== white) continue;
    const type = Math.abs(p);
    const f = fileOf(i);
    const r = rankOf(i);

    if (type === 1) {
      const one = sq(f, r + dir);
      if (r + dir >= 0 && r + dir < 8 && board[one] === 0) {
        if (rankOf(one) === promoRank) for (const promo of ['q', 'r', 'b', 'n'] as const) push({ from: i, to: one, promo });
        else push({ from: i, to: one });
        if (r === startRank) {
          const two = sq(f, r + 2 * dir);
          if (board[two] === 0) push({ from: i, to: two, flag: 'double' });
        }
      }
      for (const df of [-1, 1]) {
        const cf = f + df;
        const cr = r + dir;
        if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
        const t = sq(cf, cr);
        if (board[t] !== 0 && isWhite(board[t]) !== white) {
          if (cr === promoRank) for (const promo of ['q', 'r', 'b', 'n'] as const) push({ from: i, to: t, promo });
          else push({ from: i, to: t });
        } else if (t === state.ep && board[t] === 0) {
          push({ from: i, to: t, flag: 'ep' });
        }
      }
      continue;
    }

    if (type === 2) {
      for (const [df, dr] of KNIGHT_D) {
        const cf = f + df;
        const cr = r + dr;
        if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
        const t = sq(cf, cr);
        if (!sameSide(board[t], white)) push({ from: i, to: t });
      }
      continue;
    }

    if (type === 6) {
      for (const [df, dr] of KING_D) {
        const cf = f + df;
        const cr = r + dr;
        if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue;
        const t = sq(cf, cr);
        if (!sameSide(board[t], white)) push({ from: i, to: t });
      }
      continue;
    }

    // Sliders: bishop / rook / queen.
    const dirs = type === 3 ? DIAG : type === 4 ? ORTHO : [...DIAG, ...ORTHO];
    for (const [df, dr] of dirs) {
      let cf = f + df;
      let cr = r + dr;
      while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
        const t = sq(cf, cr);
        if (board[t] === 0) push({ from: i, to: t });
        else {
          if (isWhite(board[t]) !== white) push({ from: i, to: t });
          break;
        }
        cf += df;
        cr += dr;
      }
    }
  }
  return out;
}

function castlingMoves(state: ChessState): ChessMove[] {
  const white = state.turn === 'white';
  const { board, castling } = state;
  const out: ChessMove[] = [];
  const kSq = white ? 4 : 60;
  if (board[kSq] !== (white ? 6 : -6)) return out;
  if (isAttacked(board, kSq, !white)) return out; // can't castle out of check
  const kRight = white ? castling.wK : castling.bK;
  const qRight = white ? castling.wQ : castling.bQ;
  const rook = white ? 4 : -4;

  if (kRight && board[kSq + 1] === 0 && board[kSq + 2] === 0 && board[white ? 7 : 63] === rook) {
    if (!isAttacked(board, kSq + 1, !white) && !isAttacked(board, kSq + 2, !white)) {
      out.push({ from: kSq, to: kSq + 2, flag: 'castle' });
    }
  }
  if (qRight && board[kSq - 1] === 0 && board[kSq - 2] === 0 && board[kSq - 3] === 0 && board[white ? 0 : 56] === rook) {
    if (!isAttacked(board, kSq - 1, !white) && !isAttacked(board, kSq - 2, !white)) {
      out.push({ from: kSq, to: kSq - 2, flag: 'castle' });
    }
  }
  return out;
}

/** Fully legal moves for the side to move. */
export function legalChessMoves(state: ChessState): ChessMove[] {
  if (state.over) return [];
  const white = state.turn === 'white';
  const candidates = [...pseudoMoves(state), ...castlingMoves(state)];
  return candidates.filter((m) => !inCheck(applyToBoard(state.board, m), white));
}

function updateCastling(c: ChessState['castling'], from: number, to: number): ChessState['castling'] {
  const n = { ...c };
  const touch = (s: number) => {
    if (s === 4) { n.wK = false; n.wQ = false; }
    if (s === 60) { n.bK = false; n.bQ = false; }
    if (s === 0) n.wQ = false;
    if (s === 7) n.wK = false;
    if (s === 56) n.bQ = false;
    if (s === 63) n.bK = false;
  };
  touch(from);
  touch(to); // a rook captured on its home square also loses the right
  return n;
}

function onlyKingsMaterial(board: number[]): number[] {
  const rest: number[] = [];
  for (const c of board) if (c !== 0 && Math.abs(c) !== 6) rest.push(c);
  return rest;
}

function insufficientMaterial(board: number[]): boolean {
  const rest = onlyKingsMaterial(board);
  if (rest.length === 0) return true; // K vs K
  if (rest.length === 1) {
    const t = Math.abs(rest[0]);
    return t === 2 || t === 3; // K+N or K+B vs K
  }
  if (rest.length === 2 && rest.every((c) => Math.abs(c) === 3)) {
    // K+B vs K+B, both bishops on the same colour square → dead draw
    const bsq: number[] = [];
    board.forEach((c, i) => {
      if (Math.abs(c) === 3) bsq.push(i);
    });
    const light = (i: number) => (fileOf(i) + rankOf(i)) % 2;
    const oppositeColours = isWhite(board[bsq[0]]) !== isWhite(board[bsq[1]]);
    return oppositeColours && light(bsq[0]) === light(bsq[1]);
  }
  return false;
}

/** Build the next state from a validated legal move. */
function makeMove(state: ChessState, m: ChessMove): ChessState {
  const piece = state.board[m.from];
  const white = isWhite(piece);
  const type = Math.abs(piece);
  const capture = state.board[m.to] !== 0 || m.flag === 'ep';
  const board = applyToBoard(state.board, m);

  const ep = m.flag === 'double' ? (m.from + m.to) / 2 : null;
  const castling = updateCastling(state.castling, m.from, m.to);
  const halfmove = type === 1 || capture ? 0 : state.halfmove + 1;
  const reps = halfmove === 0 ? {} : { ...state.reps }; // an irreversible move clears repetition history

  const next: ChessState = {
    board,
    turn: white ? 'black' : 'white',
    castling,
    ep,
    halfmove,
    fullmove: state.fullmove + (white ? 0 : 1),
    reps,
    winner: null,
    over: false,
    reason: null,
    lastMove: { from: m.from, to: m.to },
    moveSeq: state.moveSeq + 1,
  };

  const key = positionKey(next);
  next.reps[key] = (next.reps[key] ?? 0) + 1;

  // Terminal detection for the side now to move.
  const theyWhite = next.turn === 'white';
  const theirMoves = legalChessMoves(next);
  if (theirMoves.length === 0) {
    if (inCheck(next.board, theyWhite)) {
      next.over = true;
      next.reason = 'checkmate';
      next.winner = white ? 'white' : 'black';
    } else {
      next.over = true;
      next.reason = 'stalemate';
    }
  } else if (insufficientMaterial(next.board)) {
    next.over = true;
    next.reason = 'insufficient';
  } else if (next.reps[key] >= 3) {
    next.over = true;
    next.reason = 'threefold';
  } else if (next.halfmove >= 100) {
    next.over = true;
    next.reason = 'fifty';
  }
  return next;
}

export function applyChessMove(state: ChessState, seat: number, action: { from: number; to: number; promo?: 'q' | 'r' | 'b' | 'n' }): ChessState {
  if (state.over) throw new Error('game_over');
  const white = state.turn === 'white';
  if ((seat === 0) !== white) throw new Error('not_your_turn');
  const legal = legalChessMoves(state).filter((m) => m.from === action.from && m.to === action.to);
  if (legal.length === 0) throw new Error('illegal_move');
  // A promotion needs the chosen piece; default to a queen if the client omits it.
  const chosen = legal.length > 1 ? legal.find((m) => m.promo === (action.promo ?? 'q')) ?? legal[0] : legal[0];
  return makeMove(state, chosen);
}

function capturedTypes(board: number[]): { white: number[]; black: number[] } {
  // Which pieces each side is missing from the standard starting set.
  const full: Record<number, number> = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1 };
  const have = { white: { ...full } as Record<number, number>, black: { ...full } as Record<number, number> };
  for (const c of board) {
    if (c === 0) continue;
    const side = c > 0 ? have.white : have.black;
    const t = Math.abs(c);
    side[t] = (side[t] ?? 0) - 1;
  }
  const missing = (side: Record<number, number>) => {
    const out: number[] = [];
    for (const t of [5, 4, 3, 2, 1]) for (let k = 0; k < Math.max(0, side[t] ?? 0); k++) out.push(t);
    return out;
  };
  // A side's captured pieces are the opponent's missing pieces.
  return { white: missing(have.black), black: missing(have.white) };
}

export const chessModule: GameModule<ChessState, ChessAction, unknown, ChessView> = {
  id: 'satranc',
  name: 'Satranç',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState() {
    return createInitialChess();
  },

  applyAction(state, action, seat) {
    if (state.over) throw new Error('game_over');
    if (action.type === 'move') return applyChessMove(state, seat, action);
    if (action.type === 'resign') {
      return {
        ...state,
        board: state.board.slice(),
        reps: { ...state.reps },
        castling: { ...state.castling },
        over: true,
        reason: 'resign',
        winner: seat === 0 ? 'black' : 'white',
        moveSeq: state.moveSeq + 1,
      };
    }
    throw new Error('unknown_action');
  },

  isOver(state) {
    return state.over;
  },

  viewFor(state, seat) {
    const youAre = seat === null ? null : seatToColor(seat);
    const yourTurn = youAre !== null && !state.over && state.turn === youAre;
    const white = state.turn === 'white';
    const check = inCheck(state.board, white);
    return {
      board: state.board.slice(),
      turn: state.turn,
      youAre,
      yourTurn,
      legalMoves: yourTurn ? legalChessMoves(state) : [],
      check,
      checkSquare: check ? kingSquare(state.board, white) : null,
      winner: state.winner,
      over: state.over,
      reason: state.reason,
      lastMove: state.lastMove,
      captured: capturedTypes(state.board),
      moveSeq: state.moveSeq,
    };
  },

  needsAutoStep() {
    return null;
  },

  result(state) {
    if (!state.over || state.winner === null) return null; // draws aren't recorded
    const material = (white: boolean) => state.board.reduce((sum, c) => (c !== 0 && isWhite(c) === white ? sum + VALUE[Math.abs(c)] : sum), 0);
    return {
      winnerSeat: state.winner === 'white' ? 0 : 1,
      kind: state.reason ?? 'win',
      scores: [material(true), material(false)],
    };
  },
};
