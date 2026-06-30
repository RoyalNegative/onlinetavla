// Match layer: wraps a sequence of games, keeps the score, and decides when the
// match is won. `applyAction` is the single entry point the server calls — it
// clones, validates via the game state machine, and applies scoring.

import { otherPlayer } from './board';
import type { Rng } from './dice';
import {
  applyOpeningRoll,
  createGame,
  dropDouble,
  endTurn,
  mustPass,
  offerDouble,
  playMove,
  resign,
  rollForTurn,
  takeDouble,
  undoTurn,
} from './game';
import type { Action, GameState, MatchConfig, MatchState, Player } from './types';

export function createMatch(config: MatchConfig): MatchState {
  return {
    config,
    score: { white: 0, black: 0 },
    game: createGame(config.mode),
    gameNumber: 1,
    startingPlayer: 'white',
    matchWinner: null,
    lastResult: null,
  };
}

function cloneGame(g: GameState): GameState {
  return {
    ...g,
    points: g.points.slice(),
    bar: { ...g.bar },
    off: { ...g.off },
    dice: g.dice.slice(),
    remaining: g.remaining.slice(),
    movesThisTurn: g.movesThisTurn.map((m) => ({ ...m })),
    openingRolls: { ...g.openingRolls },
    cube: g.cube ? { ...g.cube } : null,
    turnStart: g.turnStart
      ? { points: g.turnStart.points.slice(), bar: { ...g.turnStart.bar }, off: { ...g.turnStart.off } }
      : null,
    result: g.result ? { ...g.result } : null,
    lastMove: g.lastMove ? { ...g.lastMove } : null,
  };
}

function cloneMatch(m: MatchState): MatchState {
  return {
    ...m,
    score: { ...m.score },
    game: cloneGame(m.game),
    lastResult: m.lastResult ? { ...m.lastResult } : null,
  };
}

/** Roll up a finished game's result into the match score. Runs once per game. */
function scoreFinishedGame(match: MatchState): void {
  const result = match.game.result;
  if (!result) return;
  match.score[result.winner] += result.points;
  match.lastResult = result;
  if (match.score[result.winner] >= match.config.targetPoints) {
    match.matchWinner = result.winner;
  }
}

/**
 * Apply a player action to the match. Returns a NEW match state. Throws
 * RuleError on an illegal action so the server can reject it.
 */
export function applyAction(
  match: MatchState,
  action: Action,
  player: Player,
  rng: Rng,
): MatchState {
  if (match.matchWinner) throw new Error('match_over');
  const next = cloneMatch(match);
  const g = next.game;

  switch (action.type) {
    case 'roll': {
      if (g.phase === 'opening') {
        applyOpeningRoll(g, player, rng);
        const openingResolved = (g.phase as GameState['phase']) !== 'opening';
        if (openingResolved) next.startingPlayer = g.turn;
      } else {
        rollForTurn(g, player, rng);
      }
      break;
    }
    case 'move':
      playMove(g, player, action.move);
      if (g.phase === 'gameOver') scoreFinishedGame(next);
      break;
    case 'pass':
      if (g.turn !== player) throw new Error('not_your_turn');
      if (!mustPass(g)) throw new Error('moves_available');
      endTurn(g);
      break;
    case 'undo':
      undoTurn(g, player);
      break;
    case 'double':
      offerDouble(g, player);
      break;
    case 'takeDouble':
      takeDouble(g, player);
      break;
    case 'dropDouble':
      dropDouble(g, player);
      scoreFinishedGame(next);
      break;
    case 'resign':
      resign(g, player, action.kind);
      scoreFinishedGame(next);
      break;
    case 'nextGame':
      if (g.phase !== 'gameOver') throw new Error('game_not_over');
      if (next.matchWinner) throw new Error('match_over');
      next.game = createGame(next.config.mode);
      next.gameNumber += 1;
      break;
    default: {
      const _exhaustive: never = action;
      throw new Error(`unknown_action:${JSON.stringify(_exhaustive)}`);
    }
  }
  return next;
}

export { otherPlayer };
