import { describe, expect, it } from 'vitest';
import { createInitialDortlu, dortluModule, DORTLU_COLS, DORTLU_ROWS, type DortluState } from '../src';

const rng = () => 0.5;

function play(cols: number[]): DortluState {
  let s = createInitialDortlu();
  for (const c of cols) s = dortluModule.applyAction(s, { type: 'drop', col: c }, s.turn, rng);
  return s;
}

describe('dortlu (connect four)', () => {
  it('starts empty, seat 0 to move, all columns open', () => {
    const s = createInitialDortlu();
    expect(s.cells.every((x) => x === -1)).toBe(true);
    const v = dortluModule.viewFor(s, 0);
    expect(v.yourTurn).toBe(true);
    expect(v.legalCols).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('discs stack from the bottom', () => {
    const s = play([3, 3, 3]);
    expect(s.cells[0 * DORTLU_COLS + 3]).toBe(0);
    expect(s.cells[1 * DORTLU_COLS + 3]).toBe(1);
    expect(s.cells[2 * DORTLU_COLS + 3]).toBe(0);
    expect(s.lastDrop).toEqual({ seat: 0, col: 3, row: 2 });
  });

  it('detects a vertical win', () => {
    const s = play([0, 1, 0, 1, 0, 1, 0]);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([0, 7, 14, 21]);
  });

  it('detects a horizontal win', () => {
    const s = play([0, 0, 1, 1, 2, 2, 3]);
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([0, 1, 2, 3]);
  });

  it('detects a diagonal win', () => {
    // seat0 builds the ↗ diagonal (0,0)(1,1)(2,2)(3,3)
    const s = play([0, 1, 1, 2, 2, 3, 2, 3, 3, 5, 3]);
    expect(s.winner).toBe(0);
    expect(s.winLine).toEqual([0, 8, 16, 24]);
  });

  it('rejects a full column, out-of-range column, and playing out of turn', () => {
    let s = createInitialDortlu();
    for (let i = 0; i < DORTLU_ROWS; i++) s = dortluModule.applyAction(s, { type: 'drop', col: 0 }, s.turn, rng);
    expect(() => dortluModule.applyAction(s, { type: 'drop', col: 0 }, s.turn, rng)).toThrow('illegal_move');
    expect(() => dortluModule.applyAction(s, { type: 'drop', col: 9 }, s.turn, rng)).toThrow('illegal_move');
    expect(() => dortluModule.applyAction(s, { type: 'drop', col: 1 }, 1 - s.turn, rng)).toThrow('not_your_turn');
    const v = dortluModule.viewFor(s, s.turn);
    expect(v.legalCols).not.toContain(0);
  });

  it('a full board with no line is a draw and is not recorded', () => {
    // A verified 42-move drawing sequence (found by search against this engine).
    const order = [0,0,0,0,0,0,1,1,1,1,1,1,2,2,2,2,2,2,4,3,3,3,3,3,3,4,4,4,4,4,5,5,5,5,5,5,6,6,6,6,6,6];
    let s = createInitialDortlu();
    for (const c of order) {
      expect(s.phase).toBe('playing');
      s = dortluModule.applyAction(s, { type: 'drop', col: c }, s.turn, rng);
    }
    expect(s.phase).toBe('over');
    expect(s.winner).toBeNull();
    expect(dortluModule.result!(s)).toBeNull();
  });

  it('handles resign and records the result', () => {
    const s = play([0, 1]);
    const n = dortluModule.applyAction(s, { type: 'resign' }, 1, rng);
    expect(n.phase).toBe('over');
    expect(n.winner).toBe(0);
    expect(dortluModule.result!(n)?.winnerSeat).toBe(0);
  });

  it('spectator view has no legal columns and no seat', () => {
    const v = dortluModule.viewFor(createInitialDortlu(), null);
    expect(v.youAre).toBeNull();
    expect(v.legalCols).toEqual([]);
  });
});
