import { describe, expect, it } from 'vitest';
import { chessModule, createInitialChess, legalChessMoves, type ChessState } from '../src/index';

const rng = () => 0;

function build(pieces: Record<number, number>, turn: 'white' | 'black' = 'white', extra: Partial<ChessState> = {}): ChessState {
  const board = new Array<number>(64).fill(0);
  for (const [k, v] of Object.entries(pieces)) board[Number(k)] = v;
  return {
    board,
    turn,
    castling: { wK: false, wQ: false, bK: false, bQ: false },
    ep: null,
    halfmove: 0,
    fullmove: 1,
    reps: {},
    winner: null,
    over: false,
    reason: null,
    lastMove: null,
    moveSeq: 0,
    ...extra,
  };
}

function move(s: ChessState, from: number, to: number, promo?: 'q' | 'r' | 'b' | 'n'): ChessState {
  return chessModule.applyAction(s, { type: 'move', from, to, promo }, s.turn === 'white' ? 0 : 1, rng);
}

describe('setup', () => {
  it('has 20 legal opening moves', () => {
    expect(legalChessMoves(createInitialChess()).length).toBe(20);
  });
  it('starts with white to move and 32 pieces', () => {
    const s = createInitialChess();
    expect(s.turn).toBe('white');
    expect(s.board.filter((c) => c !== 0).length).toBe(32);
  });
});

describe('checkmate & stalemate', () => {
  it("fool's mate ends the game with black winning", () => {
    let s = createInitialChess();
    s = move(s, 13, 21); // f2-f3
    s = move(s, 52, 36); // e7-e5
    s = move(s, 14, 30); // g2-g4
    s = move(s, 59, 31); // Qd8-h4#
    expect(s.over).toBe(true);
    expect(s.reason).toBe('checkmate');
    expect(s.winner).toBe('black');
  });

  it('detects stalemate as a draw', () => {
    // Black Kh8, White Kf7; Qg1-g6 leaves black with no move and not in check.
    let s = build({ 63: -6, 53: 6, 6: 5 }, 'white');
    s = move(s, 6, 46); // Qg1-g6
    expect(s.over).toBe(true);
    expect(s.reason).toBe('stalemate');
    expect(s.winner).toBeNull();
  });
});

describe('legality', () => {
  it('keeps a pinned rook on the pin line', () => {
    const s = build({ 4: 6, 12: 4, 60: -4 }, 'white'); // Ke1, Re2 pinned by re8
    const rookMoves = legalChessMoves(s).filter((m) => m.from === 12);
    expect(rookMoves.length).toBeGreaterThan(0);
    expect(rookMoves.every((m) => m.to % 8 === 4)).toBe(true); // only along the e-file
    expect(rookMoves.some((m) => m.to === 60)).toBe(true); // may capture the pinner
  });

  it('forces the side in check to address it', () => {
    const s = build({ 4: 6, 60: -4 }, 'white'); // Ke1 in check from re8
    const moves = legalChessMoves(s);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.from === 4 && m.to % 8 !== 4)).toBe(true); // king off the e-file
  });
});

describe('special moves', () => {
  it('castles kingside, jumping the rook over', () => {
    const s = build({ 4: 6, 7: 4 }, 'white', { castling: { wK: true, wQ: false, bK: false, bQ: false } });
    const castle = legalChessMoves(s).find((m) => m.from === 4 && m.to === 6);
    expect(castle?.flag).toBe('castle');
    const after = move(s, 4, 6);
    expect(after.board[6]).toBe(6); // Kg1
    expect(after.board[5]).toBe(4); // Rf1
    expect(after.board[4]).toBe(0);
    expect(after.board[7]).toBe(0);
  });

  it('forbids castling through an attacked square', () => {
    const s = build({ 4: 6, 7: 4, 61: -4 }, 'white', { castling: { wK: true, wQ: false, bK: false, bQ: false } }); // rf8 hits f1
    expect(legalChessMoves(s).find((m) => m.from === 4 && m.to === 6)).toBeUndefined();
  });

  it('captures en passant', () => {
    let s = build({ 36: 1, 51: -1, 4: 6, 60: -6 }, 'black'); // white e5 pawn, black d7 pawn
    s = move(s, 51, 35); // d7-d5
    expect(s.ep).toBe(43); // d6
    const ep = legalChessMoves(s).find((m) => m.from === 36 && m.to === 43);
    expect(ep?.flag).toBe('ep');
    s = move(s, 36, 43); // exd6 e.p.
    expect(s.board[43]).toBe(1); // white pawn on d6
    expect(s.board[35]).toBe(0); // captured black pawn is gone
  });

  it('promotes a pawn (queen by default)', () => {
    let s = build({ 48: 1, 4: 6, 60: -6 }, 'white'); // a7 pawn
    s = move(s, 48, 56); // a8=Q (promo omitted)
    expect(s.board[56]).toBe(5);
    let s2 = build({ 48: 1, 4: 6, 60: -6 }, 'white');
    s2 = move(s2, 48, 56, 'n'); // a8=N
    expect(s2.board[56]).toBe(2);
  });
});

describe('draws & resignation', () => {
  it('draws on insufficient material (K vs K)', () => {
    let s = build({ 4: 6, 3: -4, 60: -6 }, 'white'); // Ke1 can grab the lone rook
    s = move(s, 4, 3);
    expect(s.over).toBe(true);
    expect(s.reason).toBe('insufficient');
    expect(s.winner).toBeNull();
  });

  it('draws by threefold repetition', () => {
    let s = createInitialChess();
    const dance = [
      [6, 21], [62, 45], [21, 6], [45, 62], // knights out and back (position #2)
      [6, 21], [62, 45], [21, 6], [45, 62], // and again (position #3)
    ];
    for (const [from, to] of dance) s = move(s, from, to);
    expect(s.over).toBe(true);
    expect(s.reason).toBe('threefold');
  });

  it('records a resignation', () => {
    let s = createInitialChess();
    s = chessModule.applyAction(s, { type: 'resign' }, 0, rng);
    expect(s.over).toBe(true);
    expect(s.reason).toBe('resign');
    expect(s.winner).toBe('black');
  });
});
