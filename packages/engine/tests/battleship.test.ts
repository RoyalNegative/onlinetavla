import { describe, expect, it } from 'vitest';
import {
  battleshipModule as mod,
  createInitialBattleship,
  randomFleet,
  validateFleet,
  FLEET,
  type BattleshipState,
  type ShipPlacement,
} from '../src/index';

const rng = () => 0.25; // deterministic: seat 0 always starts the battle

// Seeded LCG — randomFleet retries on collisions, so it needs a *varying* rng.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
}

// A simple legal fleet: each ship on its own row, flush left.
const rowFleet = (): ShipPlacement[] => FLEET.map((len, i) => ({ r: i, c: 0, len, dir: 'h' as const }));

function battleState(): BattleshipState {
  let s = createInitialBattleship();
  s = mod.applyAction(s, { type: 'place', ships: rowFleet() }, 0, rng);
  s = mod.applyAction(s, { type: 'place', ships: rowFleet() }, 1, rng);
  return s;
}

describe('placement', () => {
  it('accepts a legal fleet and rejects overlap / out-of-bounds / wrong sizes', () => {
    expect(validateFleet(rowFleet())).toHaveLength(FLEET.length);
    for (let seed = 1; seed <= 20; seed++) {
      expect(validateFleet(randomFleet(lcg(seed)))).toHaveLength(FLEET.length);
    }

    const overlap = rowFleet();
    overlap[1] = { r: 0, c: 2, len: 4, dir: 'h' }; // crosses the carrier
    expect(validateFleet(overlap)).toBeNull();

    const outside = rowFleet();
    outside[0] = { r: 0, c: 7, len: 5, dir: 'h' }; // runs off the right edge
    expect(validateFleet(outside)).toBeNull();

    expect(validateFleet(rowFleet().slice(1))).toBeNull(); // missing a ship
  });

  it('moves to battle once both fleets are in, with an rng-chosen starter', () => {
    let s = createInitialBattleship();
    s = mod.applyAction(s, { type: 'place', ships: rowFleet() }, 0, rng);
    expect(s.phase).toBe('placing');
    expect(() => mod.applyAction(s, { type: 'place', ships: rowFleet() }, 0, rng)).toThrow('already_placed');
    s = mod.applyAction(s, { type: 'place', ships: rowFleet() }, 1, rng);
    expect(s.phase).toBe('battle');
    expect(s.turn).toBe(0);
  });
});

describe('firing', () => {
  it('a miss passes the turn, a hit keeps it', () => {
    let s = battleState();
    s = mod.applyAction(s, { type: 'fire', cell: 99 }, 0, rng); // open water
    expect(s.lastShot).toMatchObject({ by: 0, cell: 99, result: 'miss' });
    expect(s.turn).toBe(1);
    s = mod.applyAction(s, { type: 'fire', cell: 0 }, 1, rng); // carrier bow
    expect(s.lastShot?.result).toBe('hit');
    expect(s.turn).toBe(1);
  });

  it('rejects firing out of turn, off-board, or at the same cell twice', () => {
    let s = battleState();
    expect(() => mod.applyAction(s, { type: 'fire', cell: 0 }, 1, rng)).toThrow('not_your_turn');
    expect(() => mod.applyAction(s, { type: 'fire', cell: 100 }, 0, rng)).toThrow('illegal_move');
    s = mod.applyAction(s, { type: 'fire', cell: 0 }, 0, rng);
    expect(() => mod.applyAction(s, { type: 'fire', cell: 0 }, 0, rng)).toThrow('illegal_move');
  });

  it('reports sunk when a ship\'s last cell is hit and ends the game on the last ship', () => {
    let s = battleState();
    // Sink everything but the destroyer's last cell (rows 0-4, flush left).
    for (const cell of [0, 1, 2, 3, 4, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40]) {
      s = mod.applyAction(s, { type: 'fire', cell }, 0, rng);
      expect(s.turn).toBe(0); // hits keep the turn
    }
    expect(s.lastShot?.result).toBe('hit');
    expect(s.phase).toBe('battle');
    s = mod.applyAction(s, { type: 'fire', cell: 41 }, 0, rng);
    expect(s.lastShot?.result).toBe('sunk');
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(mod.result!(s)).toMatchObject({ winnerSeat: 0, scores: [5, 0] });
  });

  it('resign hands the win to the opponent', () => {
    const s = mod.applyAction(battleState(), { type: 'resign' }, 0, rng);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(1);
  });
});

describe('easy mode (noTouch)', () => {
  // Ships on every other row — nothing touches.
  const spacedFleet = (): ShipPlacement[] => FLEET.map((len, i) => ({ r: i * 2, c: 0, len, dir: 'h' as const }));

  it('rejects touching ships and generates legal no-touch random fleets', () => {
    expect(validateFleet(rowFleet(), true)).toBeNull(); // adjacent rows touch
    expect(validateFleet(spacedFleet(), true)).toHaveLength(FLEET.length);
    for (let seed = 1; seed <= 10; seed++) {
      expect(validateFleet(randomFleet(lcg(seed), true), true)).toHaveLength(FLEET.length);
    }
    const s = createInitialBattleship({ noTouch: true });
    expect(() => mod.applyAction(s, { type: 'place', ships: rowFleet() }, 0, rng)).toThrow('illegal_placement');
  });

  it('auto-marks the halo of a sunk ship as misses', () => {
    let s = createInitialBattleship({ noTouch: true });
    s = mod.applyAction(s, { type: 'place', ships: spacedFleet() }, 0, rng);
    s = mod.applyAction(s, { type: 'place', ships: spacedFleet() }, 1, rng);
    s = mod.applyAction(s, { type: 'fire', cell: 80 }, 0, rng); // destroyer at 80,81
    s = mod.applyAction(s, { type: 'fire', cell: 81 }, 0, rng);
    expect(s.lastShot?.result).toBe('sunk');
    const v = mod.viewFor(s, 0);
    const misses = v.boards[1].shots
      .filter((x: { hit: boolean }) => !x.hit)
      .map((x: { cell: number }) => x.cell)
      .sort((a: number, b: number) => a - b);
    expect(misses).toEqual([70, 71, 72, 82, 90, 91, 92]);
  });
});

describe('views (hidden information)', () => {
  it('hides the enemy fleet from players and both fleets from spectators', () => {
    let s = battleState();
    s = mod.applyAction(s, { type: 'fire', cell: 0 }, 0, rng); // hit on black's carrier

    const v0 = mod.viewFor(s, 0);
    expect(v0.boards[0].ships).toHaveLength(FLEET.length); // your own fleet
    expect(v0.boards[1].ships).toBeNull(); // enemy fleet hidden
    expect(v0.boards[1].shots).toEqual([{ cell: 0, hit: true }]);
    expect(v0.yourTurn).toBe(true);

    const spec = mod.viewFor(s, null);
    expect(spec.boards[0].ships).toBeNull();
    expect(spec.boards[1].ships).toBeNull();
    expect(spec.youAre).toBeNull();
  });

  it('reveals a ship once sunk, and everything when the game ends', () => {
    let s = battleState();
    s = mod.applyAction(s, { type: 'fire', cell: 40 }, 0, rng);
    s = mod.applyAction(s, { type: 'fire', cell: 41 }, 0, rng); // destroyer sunk
    const v = mod.viewFor(s, 0);
    expect(v.boards[1].sunk).toEqual([[40, 41]]);
    expect(v.boards[1].shipsLeft).toBe(4);

    s = mod.applyAction(s, { type: 'resign' }, 1, rng);
    const end = mod.viewFor(s, 0);
    expect(end.boards[1].ships).toHaveLength(FLEET.length); // full reveal at game end
    expect(end.winner).toBe('white');
  });

  it('during placement, yourTurn means "you still need to place"', () => {
    let s = createInitialBattleship();
    expect(mod.viewFor(s, 0).yourTurn).toBe(true);
    s = mod.applyAction(s, { type: 'place', ships: rowFleet() }, 0, rng);
    expect(mod.viewFor(s, 0).yourTurn).toBe(false);
    expect(mod.viewFor(s, 1).yourTurn).toBe(true);
    expect(mod.viewFor(s, 1).boards[0].placed).toBe(true);
    expect(mod.viewFor(s, 1).boards[0].ships).toBeNull(); // placement stays secret
  });
});
