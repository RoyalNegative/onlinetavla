// The platform abstraction. A GameModule is everything the (game-agnostic)
// server needs to host one game type in a room. Tavla is the first module;
// adding okey / checkers / chess later means writing another GameModule — the
// room manager, sockets, chat, rematch and accounts code stay untouched.

import { pipCount } from './board';
import type { Rng } from './dice';
import { legalMoves, mustPass } from './game';
import { applyAction, createMatch } from './match';
import type { Action, DieMove, MatchConfig, MatchState, Player } from './types';

export interface GameModule<State, ActionT, Config, View> {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  createInitialState(config: Config): State;
  /** Apply an action taken by the player in seat `seat` (0-indexed). */
  applyAction(state: State, action: ActionT, seat: number, rng: Rng): State;
  isOver(state: State): boolean;
  /** Redact state for a viewer (a seat index, or null for a spectator). */
  viewFor(state: State, seat: number | null): View;
}

export function seatToColor(seat: number): Player {
  return seat === 0 ? 'white' : 'black';
}

export interface TavlaView {
  config: MatchState['config'];
  score: MatchState['score'];
  gameNumber: number;
  startingPlayer: Player;
  matchWinner: Player | null;
  lastResult: MatchState['lastResult'];
  game: MatchState['game'];
  youAre: Player | null;
  yourTurn: boolean;
  legalMoves: DieMove[];
  mustPass: boolean;
  pip: { white: number; black: number };
}

export const tavlaModule: GameModule<MatchState, Action, MatchConfig, TavlaView> = {
  id: 'tavla',
  name: 'Tavla',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(config) {
    return createMatch(config);
  },

  applyAction(state, action, seat, rng) {
    return applyAction(state, action, seatToColor(seat), rng);
  },

  isOver(state) {
    return state.matchWinner !== null;
  },

  viewFor(state, seat) {
    const youAre = seat === null ? null : seatToColor(seat);
    const yourTurn =
      youAre !== null && state.game.turn === youAre && state.matchWinner === null;
    return {
      config: state.config,
      score: state.score,
      gameNumber: state.gameNumber,
      startingPlayer: state.startingPlayer,
      matchWinner: state.matchWinner,
      lastResult: state.lastResult,
      game: state.game,
      youAre,
      yourTurn,
      legalMoves: yourTurn ? legalMoves(state.game) : [],
      mustPass: yourTurn ? mustPass(state.game) : false,
      pip: { white: pipCount(state.game, 'white'), black: pipCount(state.game, 'black') },
    };
  },
};
