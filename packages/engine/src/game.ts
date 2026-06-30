// Single-game state machine: opening roll-off, rolling, playing dice, the
// doubling cube, and win detection. All functions mutate the passed-in state;
// the match reducer clones before dispatching so callers stay immutable.

import { canBearOff, otherPlayer, ownerAt } from './board';
import { rollDie, type Rng } from './dice';
import {
  applyMoveToPosition,
  forcedSingleDie,
  maxPlayable,
  movesForDie,
  removeOne,
  sameMove,
} from './moves';
import type { DieMove, GameMode, GameState, Player, WinKind } from './types';

export class RuleError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = 'RuleError';
  }
}

export function createGame(mode: GameMode): GameState {
  return {
    points: startingPoints(),
    bar: { white: 0, black: 0 },
    off: { white: 0, black: 0 },
    turn: 'white',
    phase: 'opening',
    dice: [],
    remaining: [],
    movesThisTurn: [],
    maxThisTurn: 0,
    forcedValue: null,
    turnStart: null,
    openingRolls: { white: null, black: null },
    cube: mode === 'backgammon' ? { value: 1, owner: null } : null,
    doubleOfferedBy: null,
    result: null,
  };
}

function startingPoints(): number[] {
  const pts = new Array<number>(24).fill(0);
  pts[23] = 2;
  pts[12] = 5;
  pts[7] = 3;
  pts[5] = 5;
  pts[0] = -2;
  pts[11] = -5;
  pts[16] = -3;
  pts[18] = -5;
  return pts;
}

const BASE_POINTS: Record<WinKind, number> = { single: 1, gammon: 2, backgammon: 3 };

// ---- Legal move generation for the current turn ----

export function legalMoves(state: GameState): DieMove[] {
  if (state.phase !== 'moving') return [];
  const k = state.movesThisTurn.length;
  const out: DieMove[] = [];
  const distinct = [...new Set(state.remaining)];
  for (const v of distinct) {
    if (state.forcedValue !== null && v !== state.forcedValue) continue;
    for (const m of movesForDie(state, v)) {
      if (state.maxThisTurn > 1) {
        const rest = removeOne(state.remaining, v);
        if (k + 1 + maxPlayable(applyMoveToPosition(state, m), rest) >= state.maxThisTurn) {
          out.push(m);
        }
      } else {
        out.push(m); // maxThisTurn === 1, forced value already filtered
      }
    }
  }
  return out;
}

export function mustPass(state: GameState): boolean {
  return state.phase === 'moving' && legalMoves(state).length === 0;
}

// ---- Rolling ----

function snapshot(state: GameState): GameState['turnStart'] {
  return {
    points: state.points.slice(),
    bar: { ...state.bar },
    off: { ...state.off },
  };
}

function beginMoving(state: GameState, dice: number[]): void {
  state.dice = dice;
  state.remaining = dice.slice();
  state.movesThisTurn = [];
  state.maxThisTurn = maxPlayable(state, dice);
  state.forcedValue = state.maxThisTurn === 1 ? forcedSingleDie(state, dice) : null;
  state.turnStart = snapshot(state);
  state.phase = 'moving';
}

/** Each side rolls one die in the opening; higher die plays both as the first roll. */
export function applyOpeningRoll(state: GameState, player: Player, rng: Rng): void {
  if (state.phase !== 'opening') throw new RuleError('not_opening');
  if (state.openingRolls[player] !== null) throw new RuleError('already_rolled');
  state.openingRolls[player] = rollDie(rng);

  const { white, black } = state.openingRolls;
  if (white === null || black === null) return; // wait for the other player
  if (white === black) {
    state.openingRolls = { white: null, black: null }; // tie -> re-roll
    return;
  }
  state.turn = white > black ? 'white' : 'black';
  beginMoving(state, [white, black]);
}

export function rollForTurn(state: GameState, player: Player, rng: Rng): void {
  if (state.phase !== 'toRoll') throw new RuleError('not_to_roll');
  if (state.turn !== player) throw new RuleError('not_your_turn');
  const a = rollDie(rng);
  const b = rollDie(rng);
  beginMoving(state, a === b ? [a, a, a, a] : [a, b]);
}

// ---- Playing dice ----

export function playMove(state: GameState, player: Player, move: DieMove): void {
  if (state.phase !== 'moving') throw new RuleError('not_moving');
  if (state.turn !== player) throw new RuleError('not_your_turn');
  if (!legalMoves(state).some((m) => sameMove(m, move))) throw new RuleError('illegal_move');

  const next = applyMoveToPosition(state, move);
  state.points = next.points;
  state.bar = next.bar;
  state.off = next.off;
  state.remaining = removeOne(state.remaining, move.die);
  state.movesThisTurn.push(move);

  if (state.off[player] === 15) {
    finishGame(state, player, 'borneOff');
    return;
  }
  if (state.remaining.length === 0 || legalMoves(state).length === 0) endTurn(state);
}

export function undoTurn(state: GameState, player: Player): void {
  if (state.phase !== 'moving') throw new RuleError('not_moving');
  if (state.turn !== player) throw new RuleError('not_your_turn');
  if (!state.turnStart || state.movesThisTurn.length === 0) throw new RuleError('nothing_to_undo');
  state.points = state.turnStart.points.slice();
  state.bar = { ...state.turnStart.bar };
  state.off = { ...state.turnStart.off };
  state.remaining = state.dice.slice();
  state.movesThisTurn = [];
}

export function endTurn(state: GameState): void {
  state.turn = otherPlayer(state.turn);
  state.phase = 'toRoll';
  state.dice = [];
  state.remaining = [];
  state.movesThisTurn = [];
  state.maxThisTurn = 0;
  state.forcedValue = null;
  state.turnStart = null;
}

// ---- Doubling cube ----

export function offerDouble(state: GameState, player: Player): void {
  if (!state.cube) throw new RuleError('no_cube');
  if (state.phase !== 'toRoll') throw new RuleError('cannot_double_now');
  if (state.turn !== player) throw new RuleError('not_your_turn');
  if (state.cube.owner !== null && state.cube.owner !== player) throw new RuleError('not_cube_owner');
  state.doubleOfferedBy = player;
  state.phase = 'doubleOffered';
}

export function takeDouble(state: GameState, player: Player): void {
  if (state.phase !== 'doubleOffered' || !state.cube) throw new RuleError('no_double');
  if (player !== otherPlayer(state.doubleOfferedBy!)) throw new RuleError('not_your_decision');
  state.cube.value *= 2;
  state.cube.owner = player;
  state.doubleOfferedBy = null;
  state.phase = 'toRoll';
}

export function dropDouble(state: GameState, player: Player): void {
  if (state.phase !== 'doubleOffered' || !state.cube) throw new RuleError('no_double');
  if (player !== otherPlayer(state.doubleOfferedBy!)) throw new RuleError('not_your_decision');
  const winner = state.doubleOfferedBy!;
  state.result = { winner, kind: 'single', points: state.cube.value, reason: 'doubleDrop' };
  state.phase = 'gameOver';
}

export function resign(state: GameState, player: Player, kind: WinKind = 'single'): void {
  if (state.phase === 'gameOver') throw new RuleError('game_over');
  const winner = otherPlayer(player);
  const cubeValue = state.cube?.value ?? 1;
  state.result = { winner, kind, points: BASE_POINTS[kind] * cubeValue, reason: 'resign' };
  state.phase = 'gameOver';
}

// ---- Win detection ----

function winKind(state: GameState, winner: Player): WinKind {
  const loser = otherPlayer(winner);
  if (state.off[loser] > 0) return 'single';
  // Loser bore off nothing: gammon, or backgammon if still in winner's home / on bar.
  if (state.bar[loser] > 0) return 'backgammon';
  const winnerHome = winner === 'white' ? [0, 1, 2, 3, 4, 5] : [18, 19, 20, 21, 22, 23];
  for (const i of winnerHome) if (ownerAt(state.points, i) === loser) return 'backgammon';
  return 'gammon';
}

function finishGame(state: GameState, winner: Player, reason: 'borneOff'): void {
  const kind = winKind(state, winner);
  const cubeValue = state.cube?.value ?? 1;
  state.result = { winner, kind, points: BASE_POINTS[kind] * cubeValue, reason };
  state.phase = 'gameOver';
}

// Re-exported so the match layer / server can reuse without deep imports.
export { BASE_POINTS, canBearOff };
