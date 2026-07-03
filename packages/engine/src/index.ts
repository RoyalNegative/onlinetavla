// Public API of the tavla engine.

export * from './types';
export * from './dice';
export {
  NUM_POINTS,
  otherPlayer,
  sign,
  startingPoints,
  ownerAt,
  countAt,
  canLand,
  isHit,
  homeIndices,
  canBearOff,
  farthestHomeIndex,
  pipCount,
} from './board';
export {
  clonePosition,
  movesForDie,
  applyMoveToPosition,
  maxPlayable,
  forcedSingleDie,
  removeOne,
  sameMove,
} from './moves';
export {
  RuleError,
  createGame,
  legalMoves,
  mustPass,
  applyOpeningRoll,
  rollForTurn,
  playMove,
  undoTurn,
  endTurn,
  offerDouble,
  takeDouble,
  dropDouble,
  resign,
  BASE_POINTS,
} from './game';
export { createMatch, applyAction } from './match';
export { tavlaModule, seatToColor } from './module';
export type { GameModule, TavlaView } from './module';
export { damaModule, createInitialDama, generateMoves } from './dama';
export type { DamaState, DamaMove, DamaView, DamaAction } from './dama';
export {
  battleshipModule,
  createInitialBattleship,
  randomFleet,
  validateFleet,
  shipCells,
  haloCells,
  FLEET,
  BATTLESHIP_SIZE,
} from './battleship';
export type {
  BattleshipState,
  BattleshipAction,
  BattleshipConfig,
  BattleshipView,
  BattleshipBoardView,
  ShipPlacement,
  ShotResult,
} from './battleship';

import { battleshipModule } from './battleship';
import { damaModule } from './dama';
import { tavlaModule } from './module';

/** Registry of all hostable games, keyed by id. The server is game-agnostic. */
export const games: Record<string, import('./module').GameModule<any, any, any, any>> = {
  tavla: tavlaModule,
  dama: damaModule,
  amiral: battleshipModule,
};

export type GameId = 'tavla' | 'dama' | 'amiral';
