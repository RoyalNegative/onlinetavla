// Amiral Battı (Battleship) engine — the platform's third GameModule.
//
// 10x10 grid each. Classic fleet: 5-4-3-3-2. Both players place their ships,
// then take turns firing; a hit earns another shot (the common Turkish rule).
// Hidden information lives here: viewFor redacts the opponent's unhit ships,
// revealing a ship's cells only once it is fully sunk (or when the game ends).
//
// Two rule sets via config.noTouch (the Russian/Turkish paper-game convention):
// when true, ships may not touch (diagonals included) and sinking a ship
// auto-marks its surrounding halo as misses — the "easy" mode. When false
// (Hasbro rules) ships may touch and nothing is revealed.

import type { Rng } from './dice';
import type { GameModule } from './module';
import { seatToColor } from './module';
import type { Player } from './types';

export const BATTLESHIP_SIZE = 10;
/** Ship lengths, largest first: carrier, battleship, sub, cruiser, destroyer. */
export const FLEET: readonly number[] = [5, 4, 3, 3, 2];

export type ShotResult = 'miss' | 'hit' | 'sunk';

export interface ShipPlacement {
  r: number;
  c: number;
  len: number;
  dir: 'h' | 'v';
}

export type BattleshipAction =
  | { type: 'place'; ships: ShipPlacement[] }
  | { type: 'fire'; cell: number }
  | { type: 'resign' };

export interface BattleshipConfig {
  noTouch?: boolean;
}

export interface BattleshipState {
  noTouch: boolean;
  phase: 'placing' | 'battle' | 'over';
  /** Per seat: ships as arrays of cell indices (r*10+c). Null until placed. */
  fleets: [number[][] | null, number[][] | null];
  /** Per seat: cells this seat has fired at (on the opponent's board). */
  shots: [number[], number[]];
  turn: number; // seat to act during battle
  winner: number | null; // seat
  lastShot: { by: number; cell: number; result: ShotResult } | null;
  moveSeq: number;
}

/** One board as a viewer sees it. `ships` is null while hidden (enemy board). */
export interface BattleshipBoardView {
  placed: boolean;
  ships: number[][] | null;
  /** Shots received on this board, in firing order. */
  shots: { cell: number; hit: boolean }[];
  /** Fully sunk ships on this board — revealed to everyone. */
  sunk: number[][];
  shipsLeft: number;
}

export interface BattleshipView {
  noTouch: boolean;
  phase: BattleshipState['phase'];
  youAre: Player | null;
  yourTurn: boolean;
  turn: Player;
  fleet: number[];
  /** Indexed by seat: 0 = white, 1 = black. */
  boards: [BattleshipBoardView, BattleshipBoardView];
  winner: Player | null;
  lastShot: { by: Player; cell: number; result: ShotResult } | null;
  moveSeq: number;
}

const N = BATTLESHIP_SIZE;

/** Cells of a placement, or null if it leaves the board / is malformed. */
export function shipCells(p: ShipPlacement): number[] | null {
  if (p.dir !== 'h' && p.dir !== 'v') return null;
  if (!Number.isInteger(p.r) || !Number.isInteger(p.c) || !Number.isInteger(p.len)) return null;
  const cells: number[] = [];
  for (let k = 0; k < p.len; k++) {
    const r = p.r + (p.dir === 'v' ? k : 0);
    const c = p.c + (p.dir === 'h' ? k : 0);
    if (r < 0 || r >= N || c < 0 || c >= N) return null;
    cells.push(r * N + c);
  }
  return cells;
}

/** Cells surrounding a ship (diagonals included), on the board, excluding the ship itself. */
export function haloCells(cells: number[]): number[] {
  const own = new Set(cells);
  const out = new Set<number>();
  for (const c of cells) {
    const r = Math.floor(c / N);
    const col = c % N;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = col + dc;
        if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
        const x = nr * N + nc;
        if (!own.has(x)) out.add(x);
      }
    }
  }
  return [...out];
}

/** Validate a full fleet submission; returns ship cell arrays or null. */
export function validateFleet(ships: ShipPlacement[], noTouch = false): number[][] | null {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return null;
  const want = [...FLEET].sort((a, b) => a - b).join(',');
  const got = ships
    .map((s) => s?.len)
    .sort((a, b) => a - b)
    .join(',');
  if (want !== got) return null;
  const seen = new Set<number>();
  const fleet: number[][] = [];
  for (const s of ships) {
    const cells = shipCells(s);
    if (!cells) return null;
    for (const c of cells) {
      if (seen.has(c)) return null;
      seen.add(c);
    }
    fleet.push(cells);
  }
  if (noTouch) {
    for (const cells of fleet) {
      const others = new Set(fleet.filter((f) => f !== cells).flat());
      if (haloCells(cells).some((c) => others.has(c))) return null;
    }
  }
  return fleet;
}

/** A random legal fleet — used by the client's "shuffle" button and by tests. */
export function randomFleet(rng: Rng = Math.random, noTouch = false): ShipPlacement[] {
  const taken = new Set<number>(); // ship cells + (in noTouch mode) their halos
  const out: ShipPlacement[] = [];
  const fits = (p: ShipPlacement) => {
    const cells = shipCells(p);
    return cells && cells.every((x) => !taken.has(x)) ? cells : null;
  };
  for (const len of FLEET) {
    let placed: ShipPlacement | null = null;
    let cells: number[] | null = null;
    // Random attempts, then a deterministic scan so a degenerate rng can't spin forever.
    for (let tries = 0; tries < 200 && !cells; tries++) {
      const dir: 'h' | 'v' = rng() < 0.5 ? 'h' : 'v';
      const r = Math.floor(rng() * (dir === 'v' ? N - len + 1 : N));
      const c = Math.floor(rng() * (dir === 'h' ? N - len + 1 : N));
      placed = { r, c, len, dir };
      cells = fits(placed);
    }
    for (let i = 0; i < N * N && !cells; i++) {
      for (const dir of ['h', 'v'] as const) {
        placed = { r: Math.floor(i / N), c: i % N, len, dir };
        cells = fits(placed);
        if (cells) break;
      }
    }
    cells!.forEach((x) => taken.add(x));
    if (noTouch) haloCells(cells!).forEach((x) => taken.add(x));
    out.push(placed!);
  }
  return out;
}

export function createInitialBattleship(config?: BattleshipConfig): BattleshipState {
  return {
    noTouch: !!config?.noTouch,
    phase: 'placing',
    fleets: [null, null],
    shots: [[], []],
    turn: 0,
    winner: null,
    lastShot: null,
    moveSeq: 0,
  };
}

function cloneState(s: BattleshipState): BattleshipState {
  return {
    noTouch: s.noTouch,
    phase: s.phase,
    fleets: [s.fleets[0]?.map((c) => [...c]) ?? null, s.fleets[1]?.map((c) => [...c]) ?? null],
    shots: [[...s.shots[0]], [...s.shots[1]]],
    turn: s.turn,
    winner: s.winner,
    lastShot: s.lastShot ? { ...s.lastShot } : null,
    moveSeq: s.moveSeq,
  };
}

function sunkShips(fleet: number[][], shotsAt: number[]): number[][] {
  const hit = new Set(shotsAt);
  return fleet.filter((ship) => ship.every((c) => hit.has(c)));
}

function applyPlace(state: BattleshipState, seat: number, ships: ShipPlacement[]): void {
  if (state.phase !== 'placing') throw new Error('not_placing');
  if (state.fleets[seat]) throw new Error('already_placed');
  const fleet = validateFleet(ships, state.noTouch);
  if (!fleet) throw new Error('illegal_placement');
  state.fleets[seat] = fleet;
  state.moveSeq += 1;
}

function applyFire(state: BattleshipState, seat: number, cell: unknown): void {
  if (state.phase !== 'battle') throw new Error('not_battle');
  if (state.turn !== seat) throw new Error('not_your_turn');
  if (!Number.isInteger(cell) || (cell as number) < 0 || (cell as number) >= N * N) {
    throw new Error('illegal_move');
  }
  const target = cell as number;
  const mine = state.shots[seat];
  if (mine.includes(target)) throw new Error('illegal_move');

  const enemyFleet = state.fleets[1 - seat]!;
  mine.push(target);
  const ship = enemyFleet.find((s) => s.includes(target));
  let result: ShotResult = 'miss';
  if (ship) {
    const hitSet = new Set(mine);
    result = ship.every((c) => hitSet.has(c)) ? 'sunk' : 'hit';
  }
  state.lastShot = { by: seat, cell: target, result };
  state.moveSeq += 1;
  // Easy mode: ships can't touch, so a sunk ship's halo is provably empty —
  // auto-mark it as misses (no wasted shots there).
  if (result === 'sunk' && state.noTouch && ship) {
    for (const h of haloCells(ship)) if (!mine.includes(h)) mine.push(h);
  }

  const allCells = enemyFleet.flat();
  if (allCells.every((c) => mine.includes(c))) {
    state.winner = seat;
    state.phase = 'over';
    return;
  }
  // A hit keeps the turn (Turkish rule); a miss passes it.
  if (result === 'miss') state.turn = 1 - seat;
}

export const battleshipModule: GameModule<BattleshipState, BattleshipAction, unknown, BattleshipView> = {
  id: 'amiral',
  name: 'Amiral Battı',
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(config) {
    return createInitialBattleship(config as BattleshipConfig | undefined);
  },

  applyAction(state, action, seat, rng) {
    if (state.phase === 'over') throw new Error('game_over');
    const next = cloneState(state);
    if (action.type === 'place') {
      applyPlace(next, seat, action.ships);
      if (next.fleets[0] && next.fleets[1]) {
        next.phase = 'battle';
        next.turn = rng() < 0.5 ? 0 : 1; // fair coin for who fires first
      }
    } else if (action.type === 'fire') {
      applyFire(next, seat, action.cell);
    } else if (action.type === 'resign') {
      next.winner = 1 - seat;
      next.phase = 'over';
      next.moveSeq += 1;
    } else {
      throw new Error('unknown_action');
    }
    return next;
  },

  isOver(state) {
    return state.phase === 'over';
  },

  viewFor(state, seat) {
    const reveal = state.phase === 'over';
    const boards = [0, 1].map((b) => {
      const fleet = state.fleets[b];
      const shotsAt = state.shots[1 - b];
      const sunk = fleet ? sunkShips(fleet, shotsAt) : [];
      const hitCells = new Set(fleet ? fleet.flat() : []);
      return {
        placed: fleet !== null,
        ships: fleet && (seat === b || reveal) ? fleet : null,
        shots: shotsAt.map((cell) => ({ cell, hit: hitCells.has(cell) })),
        sunk,
        shipsLeft: fleet ? fleet.length - sunk.length : FLEET.length,
      };
    }) as [BattleshipBoardView, BattleshipBoardView];

    const youAre = seat === null ? null : seatToColor(seat);
    return {
      noTouch: state.noTouch,
      phase: state.phase,
      youAre,
      yourTurn:
        seat !== null &&
        state.phase !== 'over' &&
        (state.phase === 'placing' ? state.fleets[seat] === null : state.turn === seat),
      turn: seatToColor(state.turn),
      fleet: [...FLEET],
      boards,
      winner: state.winner === null ? null : seatToColor(state.winner),
      lastShot: state.lastShot
        ? { by: seatToColor(state.lastShot.by), cell: state.lastShot.cell, result: state.lastShot.result }
        : null,
      moveSeq: state.moveSeq,
    };
  },

  needsAutoStep() {
    return null;
  },

  result(state) {
    if (state.winner === null) return null;
    const left = (b: number) =>
      state.fleets[b] ? state.fleets[b]!.length - sunkShips(state.fleets[b]!, state.shots[1 - b]).length : 0;
    return {
      winnerSeat: state.winner,
      kind: 'win',
      scores: [left(0), left(1)],
    };
  },
};
