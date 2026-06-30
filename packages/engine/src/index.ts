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
