// Move generation and the rules look-ahead.
//
// `movesForDie` returns the legal single-die moves from a position (bar entry
// has priority, points held by 2+ opponents are blocked, bearing off follows
// the exact / overshoot rules). `maxPlayable` enumerates dice sequences to find
// how many dice can be used in a turn — this is what enforces the backgammon
// rule that you must play both dice (or the larger one) when possible.

import {
  canBearOff,
  canLand,
  farthestHomeIndex,
  isHit,
  otherPlayer,
  ownerAt,
  sign,
} from './board';
import type { DieMove, Position } from './types';

export function clonePosition(pos: Position): Position {
  return {
    points: pos.points.slice(),
    bar: { ...pos.bar },
    off: { ...pos.off },
    turn: pos.turn,
  };
}

/** All legal moves that consume a single die of value `die`. */
export function movesForDie(pos: Position, die: number): DieMove[] {
  const player = pos.turn;
  const moves: DieMove[] = [];

  // Checkers on the bar must re-enter before anything else may move.
  if (pos.bar[player] > 0) {
    const entry = player === 'white' ? 24 - die : die - 1;
    if (entry >= 0 && entry <= 23 && canLand(pos.points, entry, player)) {
      moves.push({ from: 'bar', to: entry, die });
    }
    return moves;
  }

  const bearing = canBearOff(pos, player);
  const farthest = bearing ? farthestHomeIndex(pos.points, player) : -1;

  for (let i = 0; i < 24; i++) {
    if (ownerAt(pos.points, i) !== player) continue;
    const dest = player === 'white' ? i - die : i + die;

    if (dest >= 0 && dest <= 23) {
      if (canLand(pos.points, dest, player)) moves.push({ from: i, to: dest, die });
      continue;
    }

    if (!bearing) continue; // off-board move only allowed when bearing off
    if (player === 'white') {
      if (i === die - 1) moves.push({ from: i, to: 'off', die }); // exact
      else if (i < die - 1 && i === farthest) moves.push({ from: i, to: 'off', die }); // overshoot
    } else {
      if (i === 24 - die) moves.push({ from: i, to: 'off', die });
      else if (i > 24 - die && i === farthest) moves.push({ from: i, to: 'off', die });
    }
  }
  return moves;
}

/** Apply one die-move to a position, returning a new position (handles hits). */
export function applyMoveToPosition(pos: Position, move: DieMove): Position {
  const next = clonePosition(pos);
  const player = next.turn;
  const s = sign(player);

  if (move.from === 'bar') next.bar[player] -= 1;
  else next.points[move.from] -= s;

  if (move.to === 'off') {
    next.off[player] += 1;
  } else {
    const j = move.to;
    if (isHit(next.points, j, player)) {
      next.points[j] = 0;
      next.bar[otherPlayer(player)] += 1;
    }
    next.points[j] += s;
  }
  return next;
}

/** Maximum number of dice that can be legally played from `pos` using `dice`. */
export function maxPlayable(pos: Position, dice: number[]): number {
  if (dice.length === 0) return 0;
  let best = 0;
  const tried = new Set<number>();
  for (const v of dice) {
    if (tried.has(v)) continue;
    tried.add(v);
    const moves = movesForDie(pos, v);
    for (const m of moves) {
      const rest = removeOne(dice, v);
      const depth = 1 + maxPlayable(applyMoveToPosition(pos, m), rest);
      if (depth > best) best = depth;
      if (best === dice.length) return best; // can't do better
    }
  }
  return best;
}

/** Which single die value must be used when only one die is playable. */
export function forcedSingleDie(pos: Position, dice: number[]): number | null {
  // doubles -> the only value
  if (dice[0] === dice[dice.length - 1]) return dice[0];
  const hi = Math.max(...dice);
  const lo = Math.min(...dice);
  return movesForDie(pos, hi).length > 0 ? hi : lo;
}

export function removeOne(arr: number[], v: number): number[] {
  const out = arr.slice();
  const idx = out.indexOf(v);
  if (idx >= 0) out.splice(idx, 1);
  return out;
}

export function sameMove(a: DieMove, b: DieMove): boolean {
  return a.from === b.from && a.to === b.to && a.die === b.die;
}
