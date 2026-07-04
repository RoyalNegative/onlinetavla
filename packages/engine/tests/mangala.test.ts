import { describe, expect, it } from 'vitest';
import {
  createInitialMangala,
  mangalaModule,
  treasuryOf,
  pitsOf,
  oppositeOf,
  type MangalaState,
} from '../src';

const rng = () => 0.5;

function stateWith(pits: number[], turn = 0): MangalaState {
  return { pits, turn, phase: 'playing', winner: null, lastMove: null, moveSeq: 0 };
}

const total = (s: MangalaState) => s.pits.reduce((a, b) => a + b, 0);

describe('mangala', () => {
  it('starts with 4 stones in each of 12 pits and empty treasuries', () => {
    const s = createInitialMangala();
    expect(total(s)).toBe(48);
    expect(s.pits[treasuryOf(0)]).toBe(0);
    expect(s.pits[treasuryOf(1)]).toBe(0);
    for (const g of [...pitsOf(0), ...pitsOf(1)]) expect(s.pits[g]).toBe(4);
  });

  it('sows leaving one stone behind and passes the turn', () => {
    const s = createInitialMangala();
    const n = mangalaModule.applyAction(s, { type: 'sow', pit: 0 }, 0, rng);
    // pit 0 had 4: keep 1, sow 3 into pits 1,2,3
    expect(n.pits[0]).toBe(1);
    expect(n.pits[1]).toBe(5);
    expect(n.pits[2]).toBe(5);
    expect(n.pits[3]).toBe(5);
    expect(n.turn).toBe(1);
    expect(total(n)).toBe(48);
  });

  it('moves a lone stone to the next pit', () => {
    const pits = new Array(14).fill(0);
    pits[0] = 1;
    pits[7] = 3; // keep opponent side non-empty
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 0 }, 0, rng);
    expect(n.pits[0]).toBe(0);
    expect(n.pits[1]).toBe(1);
  });

  it('landing in own treasury grants an extra turn', () => {
    const pits = new Array(14).fill(0);
    pits[3] = 4; // 3 sown → pits 4,5 and treasury 6
    pits[0] = 2;
    pits[7] = 3;
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 3 }, 0, rng);
    expect(n.pits[treasuryOf(0)]).toBe(1);
    expect(n.turn).toBe(0);
    expect(n.lastMove?.extraTurn).toBe(true);
  });

  it('skips the opponent treasury while sowing', () => {
    const pits = new Array(14).fill(0);
    pits[12] = 3; // seat1 sows: keep 1, drop into 13 (own treasury) and 0 — skipping nothing yet
    pits[11] = 9; // seat1: keep 1, 8 stones → 12, 13(treasury), 0,1,2,3,4,5 — must skip 6? no, 6 is seat0 treasury
    pits[0] = 1;
    const s = stateWith(pits, 1);
    const n = mangalaModule.applyAction(s, { type: 'sow', pit: 11 }, 1, rng);
    // 8 stones from pit 11: 12, 13, then 0,1,2,3,4,5 — seat0's treasury (6) untouched
    expect(n.pits[treasuryOf(0)]).toBe(0);
    expect(n.pits[12]).toBe(4);
    expect(n.pits[treasuryOf(1)]).toBe(1);
  });

  it('captures an opponent pit made even by the last stone', () => {
    const pits = new Array(14).fill(0);
    pits[5] = 3; // keep 1, sow 2 → treasury(6), pit 7
    pits[7] = 3; // becomes 4 → even → captured
    pits[0] = 2;
    pits[8] = 1;
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 5 }, 0, rng);
    expect(n.pits[7]).toBe(0);
    expect(n.pits[treasuryOf(0)]).toBe(1 + 4); // 1 sown + 4 captured
    expect(n.lastMove?.captured).toEqual([7]);
  });

  it('does not capture an odd opponent pit', () => {
    const pits = new Array(14).fill(0);
    pits[5] = 3;
    pits[7] = 2; // becomes 3 → odd → stays
    pits[0] = 2;
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 5 }, 0, rng);
    expect(n.pits[7]).toBe(3);
    expect(n.lastMove?.captured).toEqual([]);
  });

  it('landing in own empty pit captures the opposite pit plus the stone', () => {
    const pits = new Array(14).fill(0);
    pits[0] = 2; // keep 1, sow 1 → lands pit 1 (empty)
    pits[11] = 5; // opposite of pit 1 is 11
    pits[7] = 2;
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 0 }, 0, rng);
    expect(oppositeOf(1)).toBe(11);
    expect(n.pits[11]).toBe(0);
    expect(n.pits[1]).toBe(0);
    expect(n.pits[treasuryOf(0)]).toBe(6);
  });

  it('own-empty-pit landing captures nothing when the opposite pit is empty', () => {
    const pits = new Array(14).fill(0);
    pits[0] = 2;
    pits[7] = 2; // opposite of 1 is 11, empty
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 0 }, 0, rng);
    expect(n.pits[1]).toBe(1);
    expect(n.pits[treasuryOf(0)]).toBe(0);
  });

  it('ends the set when a side empties; each side banks its remaining stones', () => {
    const pits = new Array(14).fill(0);
    pits[5] = 1; // lone stone → moves into treasury? no: next of 5 is 6 (own treasury)
    pits[9] = 3;
    pits[treasuryOf(0)] = 10;
    pits[treasuryOf(1)] = 8;
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 5 }, 0, rng);
    // seat0 side is now empty → set over; seat1 banks its 3 stones
    expect(n.phase).toBe('over');
    expect(n.pits[treasuryOf(0)]).toBe(11);
    expect(n.pits[treasuryOf(1)]).toBe(11);
    expect(n.winner).toBeNull(); // 11-11 draw
    expect(mangalaModule.result!(n)).toBeNull();
  });

  it('declares the richer treasury the winner at set end', () => {
    const pits = new Array(14).fill(0);
    pits[5] = 1;
    pits[9] = 3;
    pits[treasuryOf(0)] = 20;
    pits[treasuryOf(1)] = 8;
    const n = mangalaModule.applyAction(stateWith(pits), { type: 'sow', pit: 5 }, 0, rng);
    expect(n.phase).toBe('over');
    expect(n.winner).toBe(0);
    expect(mangalaModule.result!(n)).toEqual({ winnerSeat: 0, kind: 'win', scores: [21, 11] });
  });

  it('rejects sowing from an empty pit, the wrong side, or out of turn', () => {
    const s = createInitialMangala();
    expect(() => mangalaModule.applyAction(s, { type: 'sow', pit: 7 }, 0, rng)).toThrow('illegal_move');
    expect(() => mangalaModule.applyAction(s, { type: 'sow', pit: 6 }, 0, rng)).toThrow('illegal_move');
    expect(() => mangalaModule.applyAction(s, { type: 'sow', pit: 7 }, 1, rng)).toThrow('not_your_turn');
    const empty = new Array(14).fill(0);
    empty[0] = 0;
    empty[1] = 2;
    empty[7] = 2;
    expect(() => mangalaModule.applyAction(stateWith(empty), { type: 'sow', pit: 0 }, 0, rng)).toThrow('illegal_move');
  });

  it('redacts nothing but exposes only own pits as legal', () => {
    const s = createInitialMangala();
    const v0 = mangalaModule.viewFor(s, 0);
    const v1 = mangalaModule.viewFor(s, 1);
    const vs = mangalaModule.viewFor(s, null);
    expect(v0.legalPits).toEqual([0, 1, 2, 3, 4, 5]);
    expect(v1.legalPits).toEqual([]);
    expect(vs.youAre).toBeNull();
    expect(vs.legalPits).toEqual([]);
  });

  it('handles resign', () => {
    const s = createInitialMangala();
    const n = mangalaModule.applyAction(s, { type: 'resign' }, 0, rng);
    expect(n.phase).toBe('over');
    expect(n.winner).toBe(1);
  });

  it('a full random game conserves 48 stones and terminates', () => {
    let s = createInitialMangala();
    let guard = 0;
    while (s.phase === 'playing' && guard++ < 2000) {
      const legal = pitsOf(s.turn).filter((g) => s.pits[g] > 0);
      const pick = legal[Math.floor(Math.random() * legal.length)];
      s = mangalaModule.applyAction(s, { type: 'sow', pit: pick }, s.turn, rng);
      expect(total(s)).toBe(48);
    }
    expect(s.phase).toBe('over');
    expect(s.pits[treasuryOf(0)] + s.pits[treasuryOf(1)]).toBe(48);
  });
});
