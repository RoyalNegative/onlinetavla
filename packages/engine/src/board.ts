// Board helpers: starting position, ownership/blocking queries, home detection,
// and pip counting. Indices are 0..23. White = positive, black = negative.

import type { Player, Position } from './types';

export const NUM_POINTS = 24;

export function otherPlayer(p: Player): Player {
  return p === 'white' ? 'black' : 'white';
}

export function sign(p: Player): number {
  return p === 'white' ? 1 : -1;
}

/** Standard backgammon / tavla starting layout (167 pips each side). */
export function startingPoints(): number[] {
  const pts = new Array<number>(NUM_POINTS).fill(0);
  // White (positive): 24-pt, 13-pt, 8-pt, 6-pt.
  pts[23] = 2;
  pts[12] = 5;
  pts[7] = 3;
  pts[5] = 5;
  // Black (negative): mirror image.
  pts[0] = -2;
  pts[11] = -5;
  pts[16] = -3;
  pts[18] = -5;
  return pts;
}

export function ownerAt(points: number[], i: number): Player | null {
  const v = points[i];
  if (v > 0) return 'white';
  if (v < 0) return 'black';
  return null;
}

export function countAt(points: number[], i: number): number {
  return Math.abs(points[i]);
}

/** Can `player` land on index `i`? Blocked only by 2+ opposing checkers. */
export function canLand(points: number[], i: number, player: Player): boolean {
  const o = ownerAt(points, i);
  return o === null || o === player || countAt(points, i) < 2;
}

/** True if landing on `i` hits a lone opposing blot. */
export function isHit(points: number[], i: number, player: Player): boolean {
  return ownerAt(points, i) === otherPlayer(player) && countAt(points, i) === 1;
}

/** Home-board indices for a player. White: 0..5, Black: 18..23. */
export function homeIndices(player: Player): number[] {
  return player === 'white' ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23];
}

/** All 15 checkers in the home board and none on the bar. */
export function canBearOff(pos: Position, player: Player): boolean {
  if (pos.bar[player] > 0) return false;
  const outside = player === 'white' ? range(6, 23) : range(0, 17);
  for (const i of outside) {
    if (ownerAt(pos.points, i) === player) return false;
  }
  return true;
}

/** The occupied home index farthest from bearing off (the overshoot checker). */
export function farthestHomeIndex(points: number[], player: Player): number {
  if (player === 'white') {
    for (let i = 5; i >= 0; i--) if (ownerAt(points, i) === 'white') return i;
  } else {
    for (let i = 18; i <= 23; i++) if (ownerAt(points, i) === 'black') return i;
  }
  return -1;
}

/** Pips remaining for a player (lower = closer to winning). */
export function pipCount(pos: Position, player: Player): number {
  let pips = pos.bar[player] * 25;
  for (let i = 0; i < NUM_POINTS; i++) {
    if (ownerAt(pos.points, i) === player) {
      const dist = player === 'white' ? i + 1 : NUM_POINTS - i;
      pips += dist * countAt(pos.points, i);
    }
  }
  return pips;
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
