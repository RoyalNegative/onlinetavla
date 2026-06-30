import { describe, expect, it } from 'vitest';
import { createInitialDama, damaModule, generateMoves, type DamaState } from '../src/index';

const rng = () => 0;

function emptyState(turn: 'white' | 'black' = 'white'): DamaState {
  return { board: new Array<number>(64).fill(0), turn, winner: null, lastMove: null, moveSeq: 0 };
}
function apply(state: DamaState, from: number, to: number): DamaState {
  return damaModule.applyAction(state, { type: 'move', move: { from, to, captures: [] } }, 0, rng);
}

describe('setup', () => {
  it('places 16 men per side on the 2nd and 3rd ranks', () => {
    const s = createInitialDama();
    const white = s.board.filter((c) => c > 0).length;
    const black = s.board.filter((c) => c < 0).length;
    expect(white).toBe(16);
    expect(black).toBe(16);
    expect(s.turn).toBe('white');
  });

  it('opens with 8 forward moves (sideways are blocked by own men)', () => {
    const moves = generateMoves(createInitialDama());
    expect(moves).toHaveLength(8);
    expect(moves.every((m) => m.captures.length === 0 && m.to - m.from === 8)).toBe(true);
  });
});

describe('captures', () => {
  it('makes a single forward capture mandatory', () => {
    const s = emptyState('white');
    s.board[27] = 1; // white man
    s.board[35] = -1; // black man directly ahead
    const moves = generateMoves(s);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: 27, to: 43, captures: [35] });
  });

  it('forces the maximum (double) capture', () => {
    const s = emptyState('white');
    s.board[18] = 1;
    s.board[26] = -1;
    s.board[42] = -1;
    const moves = generateMoves(s);
    expect(moves).toHaveLength(1);
    expect(moves[0].captures).toHaveLength(2);
    expect(moves[0].to).toBe(50);
  });

  it('a flying king slides multiple squares', () => {
    const s = emptyState('white');
    s.board[0] = 2; // white king
    s.board[9] = -1; // off the king's lines
    const moves = generateMoves(s);
    expect(moves.some((m) => m.from === 0 && m.to === 56)).toBe(true);
    expect(moves.some((m) => m.from === 0 && m.to === 7)).toBe(true);
  });
});

describe('promotion and winning', () => {
  it('promotes a man that reaches the far rank', () => {
    const s = emptyState('white');
    s.board[48] = 1; // white man on row 6
    s.board[1] = -1; // a black man so the game is not already over
    const next = apply(s, 48, 56); // forward into row 7
    expect(next.board[56]).toBe(2); // white king
  });

  it('declares a winner when the opponent has no pieces', () => {
    const s = emptyState('white');
    s.board[27] = 1;
    s.board[35] = -1; // black's only piece
    const next = apply(s, 27, 43); // capture it
    expect(next.winner).toBe('white');
    expect(damaModule.result?.(next)).toMatchObject({ winnerSeat: 0, kind: 'win' });
  });
});
