import { describe, expect, it } from 'vitest';
import {
  applyAction,
  applyMoveToPosition,
  applyOpeningRoll,
  createGame,
  createMatch,
  dropDouble,
  forcedSingleDie,
  legalMoves,
  maxPlayable,
  mustPass,
  offerDouble,
  pipCount,
  playMove,
  resign,
  rollForTurn,
  takeDouble,
  type GameState,
  type Player,
  type Rng,
} from '../src/index';

/** Deterministic RNG: each call yields the next die value in `seq` (looping). */
function dieRng(seq: number[]): Rng {
  let i = 0;
  return () => {
    const d = seq[i % seq.length];
    i++;
    return (d - 0.5) / 6;
  };
}

function zeros(): number[] {
  return new Array<number>(24).fill(0);
}

function gameAt(opts: {
  turn?: Player;
  points?: number[];
  bar?: { white: number; black: number };
  off?: { white: number; black: number };
  mode?: 'classic' | 'backgammon';
}): GameState {
  const g = createGame(opts.mode ?? 'classic');
  g.phase = 'toRoll';
  g.turn = opts.turn ?? 'white';
  if (opts.points) g.points = opts.points;
  if (opts.bar) g.bar = opts.bar;
  if (opts.off) g.off = opts.off;
  return g;
}

describe('starting position', () => {
  it('has 167 pips for each side', () => {
    const g = createGame('classic');
    expect(pipCount(g, 'white')).toBe(167);
    expect(pipCount(g, 'black')).toBe(167);
  });

  it('counts 15 checkers per side', () => {
    const g = createGame('classic');
    const white = g.points.filter((p) => p > 0).reduce((a, b) => a + b, 0);
    const black = -g.points.filter((p) => p < 0).reduce((a, b) => a + b, 0);
    expect(white).toBe(15);
    expect(black).toBe(15);
  });
});

describe('opening roll', () => {
  it('higher die decides who starts and both dice are played', () => {
    const g = createGame('classic');
    // applyOpeningRoll is reached via the match reducer's "roll" action too,
    // but here we test the game function directly through createGame state.
    g.phase = 'opening';
    applyOpeningRoll(g, 'white', dieRng([6]));
    applyOpeningRoll(g, 'black', dieRng([3]));
    expect(g.phase).toBe('moving');
    expect(g.turn).toBe('white');
    expect(g.dice).toEqual([6, 3]);
  });
});

describe('move generation', () => {
  it('from the start, blocked destinations are excluded', () => {
    const g = gameAt({ turn: 'white' });
    rollForTurn(g, 'white', dieRng([3, 5]));
    expect(g.maxThisTurn).toBe(2);
    const moves = legalMoves(g);
    const has = (from: number, to: number, die: number) =>
      moves.some((m) => m.from === from && m.to === to && m.die === die);
    expect(has(12, 9, 3)).toBe(true); // open
    expect(has(23, 18, 5)).toBe(false); // 18 has 5 black -> blocked
    expect(has(5, 0, 5)).toBe(false); // 0 has 2 black -> blocked
  });

  it('forces re-entry from the bar before any other move', () => {
    const pts = zeros();
    pts[10] = 3; // white checkers that would otherwise have moves
    const g = gameAt({ turn: 'white', points: pts, bar: { white: 1, black: 0 } });
    rollForTurn(g, 'white', dieRng([2, 4]));
    const moves = legalMoves(g);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.from === 'bar')).toBe(true);
  });

  it('reports must-pass when bar entry is blocked', () => {
    const pts = zeros();
    pts[22] = -2; // blocks die 2 entry (24-2)
    pts[20] = -2; // blocks die 4 entry (24-4)
    const g = gameAt({ turn: 'white', points: pts, bar: { white: 1, black: 0 } });
    rollForTurn(g, 'white', dieRng([2, 4]));
    expect(legalMoves(g)).toHaveLength(0);
    expect(mustPass(g)).toBe(true);
  });
});

describe('hitting', () => {
  it('sends a lone opposing blot to the bar', () => {
    const pts = zeros();
    pts[7] = 1; // white
    pts[4] = -1; // black blot
    const g = gameAt({ turn: 'white', points: pts });
    rollForTurn(g, 'white', dieRng([3, 1]));
    playMove(g, 'white', { from: 7, to: 4, die: 3 });
    expect(g.points[4]).toBe(1);
    expect(g.bar.black).toBe(1);
  });
});

describe('bearing off', () => {
  it('bears off with the exact die', () => {
    const pts = zeros();
    pts[0] = 1;
    pts[5] = 1;
    const g = gameAt({ turn: 'white', points: pts, off: { white: 13, black: 0 } });
    rollForTurn(g, 'white', dieRng([6, 1]));
    const moves = legalMoves(g);
    expect(moves.some((m) => m.from === 5 && m.to === 'off' && m.die === 6)).toBe(true);
    expect(moves.some((m) => m.from === 0 && m.to === 'off' && m.die === 1)).toBe(true);
  });

  it('allows overshoot from the farthest point when nothing is higher', () => {
    const pts = zeros();
    pts[3] = 1; // point 4
    const g = gameAt({ turn: 'white', points: pts, off: { white: 14, black: 0 } });
    rollForTurn(g, 'white', dieRng([6, 6]));
    const moves = legalMoves(g);
    expect(moves.some((m) => m.from === 3 && m.to === 'off' && m.die === 6)).toBe(true);
  });

  it('forbids overshoot when a higher checker still exists', () => {
    const pts = zeros();
    pts[3] = 1;
    pts[5] = 1; // higher point still occupied
    const g = gameAt({ turn: 'white', points: pts, off: { white: 13, black: 0 } });
    rollForTurn(g, 'white', dieRng([6, 1]));
    const moves = legalMoves(g);
    expect(moves.some((m) => m.from === 5 && m.to === 'off' && m.die === 6)).toBe(true);
    expect(moves.some((m) => m.from === 3 && m.to === 'off' && m.die === 6)).toBe(false);
  });
});

describe('use-the-maximum-dice rule', () => {
  it('forces the larger die when only one of the two can be played', () => {
    // Single white checker on point index 8; black blocks index 0 so the second
    // die always strands. Both dice are individually playable -> must use 6.
    const pts = zeros();
    pts[8] = 1;
    pts[0] = -2;
    const g = gameAt({ turn: 'white', points: pts });
    rollForTurn(g, 'white', dieRng([6, 2]));
    expect(maxPlayable(g, g.dice)).toBe(1);
    expect(g.forcedValue).toBe(6);
    const moves = legalMoves(g);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: 8, to: 2, die: 6 });
  });

  it('picks the only playable die when the larger is blocked', () => {
    const pts = zeros();
    pts[18] = -2; // blocks white bar entry for die 6 (24-6)
    const g = gameAt({ turn: 'white', points: pts, bar: { white: 1, black: 0 } });
    rollForTurn(g, 'white', dieRng([6, 3]));
    // die 6 entry blocked at 18; die 3 entry at 21 open. Only one die playable.
    expect(forcedSingleDie(g, g.dice)).toBe(3);
    const moves = legalMoves(g);
    expect(moves.every((m) => m.die === 3 && m.from === 'bar')).toBe(true);
  });
});

describe('win detection', () => {
  function winWith(black: { points?: number[]; bar?: number; off?: number }): GameState {
    const pts = black.points ? black.points.slice() : zeros();
    pts[0] = 2; // white: two on the 1-point
    const g = gameAt({
      turn: 'white',
      points: pts,
      off: { white: 13, black: black.off ?? 0 },
      bar: { white: 0, black: black.bar ?? 0 },
    });
    rollForTurn(g, 'white', dieRng([1, 1]));
    while (g.phase === 'moving') {
      const m = legalMoves(g)[0];
      playMove(g, 'white', m);
    }
    return g;
  }

  it('single when the loser has borne off a checker', () => {
    const pts = zeros();
    pts[18] = -13;
    const g = winWith({ points: pts, off: 2 });
    expect(g.result).toMatchObject({ winner: 'white', kind: 'single', points: 1 });
  });

  it('gammon when the loser bore off nothing and is clear', () => {
    const pts = zeros();
    pts[18] = -15;
    const g = winWith({ points: pts, off: 0 });
    expect(g.result).toMatchObject({ winner: 'white', kind: 'gammon', points: 2 });
  });

  it('backgammon when the loser still sits in the winner home', () => {
    const pts = zeros();
    pts[3] = -1; // black checker inside white home
    pts[18] = -14;
    const g = winWith({ points: pts, off: 0 });
    expect(g.result).toMatchObject({ winner: 'white', kind: 'backgammon', points: 3 });
  });
});

describe('doubling cube', () => {
  it('drop hands the offerer the current cube value', () => {
    const g = gameAt({ turn: 'white', mode: 'backgammon' });
    offerDouble(g, 'white');
    expect(g.phase).toBe('doubleOffered');
    dropDouble(g, 'black');
    expect(g.result).toMatchObject({ winner: 'white', points: 1, reason: 'doubleDrop' });
  });

  it('take doubles the stake so later results multiply', () => {
    const g = gameAt({ turn: 'white', mode: 'backgammon' });
    offerDouble(g, 'white');
    takeDouble(g, 'black');
    expect(g.cube).toMatchObject({ value: 2, owner: 'black' });
    resign(g, 'black'); // black resigns single -> white wins 1 * cube(2)
    expect(g.result).toMatchObject({ winner: 'white', kind: 'single', points: 2 });
  });
});

describe('match scoring', () => {
  it('accumulates points and declares a match winner at the target', () => {
    let m = createMatch({ mode: 'classic', targetPoints: 3 });
    // Bypass the opening for a deterministic toRoll state.
    m.game.phase = 'toRoll';
    m.game.turn = 'white';
    m = applyAction(m, { type: 'resign' }, 'black', dieRng([1])); // white +1
    expect(m.score.white).toBe(1);
    expect(m.matchWinner).toBeNull();
    m = applyAction(m, { type: 'nextGame' }, 'white', dieRng([1]));
    m.game.phase = 'toRoll';
    m.game.turn = 'white';
    m = applyAction(m, { type: 'resign', kind: 'backgammon' }, 'black', dieRng([1])); // white +3
    expect(m.score.white).toBe(4);
    expect(m.matchWinner).toBe('white');
  });
});

describe('position application is immutable', () => {
  it('does not mutate the input position', () => {
    const g = gameAt({ turn: 'white' });
    const before = g.points.slice();
    applyMoveToPosition(g, { from: 23, to: 20, die: 3 });
    expect(g.points).toEqual(before);
  });
});
