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

export { mangalaModule, createInitialMangala, treasuryOf, pitsOf, oppositeOf, MANGALA_PITS, MANGALA_SEED } from './mangala';
export type { MangalaState, MangalaAction, MangalaView, MangalaLastMove } from './mangala';
export { dortluModule, createInitialDortlu, DORTLU_COLS, DORTLU_ROWS } from './dortlu';
export type { DortluState, DortluAction, DortluView } from './dortlu';
export { chessModule, createInitialChess, legalChessMoves, isAttacked } from './satranc';
export type { ChessState, ChessAction, ChessMove, ChessView, ChessColor, ChessEndReason } from './satranc';
export { secretHitlerModule, createInitialSecretHitler, shPowers, SH_MIN_PLAYERS, SH_MAX_PLAYERS } from './secrethitler';
export type {
  SHState,
  SHAction,
  SHView,
  SHRole,
  SHParty,
  SHPolicy,
  SHPower,
  SHPhase,
  SHLogEntry,
  SHWinReason,
} from './secrethitler';

import { battleshipModule } from './battleship';
import { damaModule } from './dama';
import { dortluModule } from './dortlu';
import { mangalaModule } from './mangala';
import { tavlaModule } from './module';
import { chessModule } from './satranc';
import { secretHitlerModule } from './secrethitler';

/** Registry of all hostable games, keyed by id. The server is game-agnostic. */
export const games: Record<string, import('./module').GameModule<any, any, any, any>> = {
  tavla: tavlaModule,
  dama: damaModule,
  amiral: battleshipModule,
  mangala: mangalaModule,
  dortlu: dortluModule,
  satranc: chessModule,
  secrethitler: secretHitlerModule,
};

export type GameId = 'tavla' | 'dama' | 'amiral' | 'mangala' | 'dortlu' | 'satranc' | 'secrethitler';
