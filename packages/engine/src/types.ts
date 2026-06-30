// Core domain types for the tavla (backgammon) engine.
// Pure data — no framework, no IO. Shared by both server and web client.

export type Player = 'white' | 'black';

/** A board location for a single checker move. */
export type Point = number | 'bar' | 'off';

/** One die's worth of movement. `die` is the pip value consumed. */
export interface DieMove {
  from: number | 'bar';
  to: number | 'off';
  die: number;
}

export type Phase =
  | 'opening' // each side rolls one die to decide who starts
  | 'toRoll' // current player must roll (or, in cube mode, may double)
  | 'moving' // current player plays out the rolled dice
  | 'doubleOffered' // a double was offered; opponent must take/drop
  | 'gameOver'; // single game finished (match may continue)

export type WinKind = 'single' | 'gammon' | 'backgammon';

export interface GameResult {
  winner: Player;
  kind: WinKind;
  /** Points awarded for this game (base * cube value). */
  points: number;
  /** How the game ended. */
  reason: 'borneOff' | 'resign' | 'doubleDrop';
}

export interface Cube {
  value: number; // 1, 2, 4, ...
  owner: Player | null; // null = centered (either side may double)
}

/**
 * The physical board: where every checker sits and whose turn it is. `points`
 * is length 24, indices 0..23. Positive = white checkers, negative = black
 * checkers, 0 = empty. White moves high->low index and bears off below 0; black
 * moves low->high and bears off above 23. The move generator works on this
 * minimal shape so it can be reused for look-ahead without the turn bookkeeping.
 */
export interface Position {
  points: number[];
  bar: { white: number; black: number };
  off: { white: number; black: number };
  turn: Player;
}

/**
 * Full state of a single tavla game. The match layer wraps several of these.
 */
export interface GameState extends Position {
  phase: Phase;
  dice: number[]; // full roll for the turn (2 values, or 4 on doubles)
  remaining: number[]; // dice values not yet consumed this turn
  movesThisTurn: DieMove[];
  maxThisTurn: number; // max dice playable this turn (computed at roll time)
  forcedValue: number | null; // larger-die rule when only one die is playable
  /** Board snapshot at roll time, used to take back the current turn's moves. */
  turnStart: { points: number[]; bar: { white: number; black: number }; off: { white: number; black: number } } | null;
  openingRolls: { white: number | null; black: number | null };
  cube: Cube | null; // null in classic mode
  doubleOfferedBy: Player | null;
  result: GameResult | null;
  /** Most recently applied move (kept after the turn ends, for animation). */
  lastMove: DieMove | null;
  lastMoveBy: Player | null;
  moveSeq: number; // increments on every applied move
}

export type GameMode = 'classic' | 'backgammon';

export interface MatchConfig {
  mode: GameMode; // classic = no doubling cube; backgammon = with cube
  targetPoints: number; // first to this many points wins the match
}

export interface MatchState {
  config: MatchConfig;
  score: { white: number; black: number };
  game: GameState;
  gameNumber: number;
  startingPlayer: Player; // who opened the current game (after opening roll)
  matchWinner: Player | null;
  /** Last finished game's result, kept for the post-game screen. */
  lastResult: GameResult | null;
}

// ---- Actions the players can take (validated by the engine) ----

export type Action =
  | { type: 'roll' }
  | { type: 'move'; move: DieMove }
  | { type: 'pass' } // end the turn when no legal moves remain
  | { type: 'undo' } // take back the moves played so far this turn (before ending)
  | { type: 'double' }
  | { type: 'takeDouble' }
  | { type: 'dropDouble' }
  | { type: 'resign'; kind?: WinKind }
  | { type: 'nextGame' }; // deal the next game after one finishes
