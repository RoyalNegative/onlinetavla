// Secret Hitler engine — a GameModule for the hub. 5-10 players, social
// deduction. (Secret Hitler © Goat, Wolf & Cabbage, CC BY-NC-SA 4.0 — this is a
// free, non-commercial fan implementation.)
//
// Liberals vs fascists + Hitler. Each round the president nominates a
// chancellor, everyone votes; an elected government draws 3 policies, the
// president discards one and the chancellor enacts one of the remaining two.
// Fascist policies unlock presidential powers (peek / investigate / special
// election / execution). Liberals win with 5 liberal policies or by shooting
// Hitler; fascists win with 6 fascist policies or by electing Hitler
// chancellor once 3 fascist policies are down.
//
// Unlike the 2-player modules this one starts in a LOBBY phase: seats fill up
// (the room accepts players while `acceptsNewPlayers` is true) and the host
// (seat 0) starts the game, which locks the table and deals roles.

import type { Rng } from './dice';
import type { GameModule } from './module';

export const SH_MIN_PLAYERS = 5;
export const SH_MAX_PLAYERS = 10;

export type SHRole = 'liberal' | 'fascist' | 'hitler';
export type SHParty = 'liberal' | 'fascist';
export type SHPolicy = 'liberal' | 'fascist';
export type SHPower = 'peek' | 'investigate' | 'special' | 'execute';

export type SHPhase =
  | 'lobby'
  | 'nominate'
  | 'vote'
  | 'president-discard'
  | 'chancellor-enact'
  | 'veto-decision'
  | 'power-peek'
  | 'power-investigate'
  | 'power-special'
  | 'power-execute'
  | 'over';

export type SHAction =
  | { type: 'start' }
  | { type: 'nominate'; target: number }
  | { type: 'vote'; ja: boolean }
  | { type: 'discard'; index: number }
  | { type: 'enact'; index: number }
  | { type: 'veto' }
  | { type: 'veto-decision'; accept: boolean }
  | { type: 'power'; target: number }
  | { type: 'continue' };

/** Public history — everything in here is visible to everyone. */
export type SHLogEntry =
  | { t: 'start'; n: number }
  | { t: 'nominate'; p: number; c: number }
  | { t: 'election'; p: number; c: number; ja: number; nein: number; passed: boolean }
  | { t: 'policy'; policy: SHPolicy; chaos?: boolean }
  | { t: 'peek'; p: number }
  | { t: 'investigate'; p: number; target: number }
  | { t: 'special'; p: number; target: number }
  | { t: 'execute'; p: number; target: number }
  | { t: 'veto-request'; c: number }
  | { t: 'veto'; accepted: boolean }
  | { t: 'win'; team: SHParty; reason: SHWinReason };

export type SHWinReason = 'liberal-policies' | 'hitler-killed' | 'fascist-policies' | 'hitler-chancellor';

export interface SHState {
  phase: SHPhase;
  seats: number; // players dealt in (0 while in lobby)
  roles: SHRole[];
  alive: boolean[];
  deck: SHPolicy[];
  discard: SHPolicy[];
  liberalEnacted: number;
  fascistEnacted: number;
  electionTracker: number; // 0..2; the 3rd failed election triggers chaos
  presidentSeat: number;
  chancellorSeat: number | null; // elected chancellor of the current government
  nomineeSeat: number | null;
  votes: (boolean | null)[];
  lastElected: { president: number | null; chancellor: number | null }; // term limits
  presidentHand: SHPolicy[];
  chancellorHand: SHPolicy[];
  vetoRequested: boolean; // chancellor already tried (and was refused) this round
  specialReturnSeat: number | null; // resume rotation after a special election
  investigated: number[];
  /** Private: each entry is visible only to `by`. */
  investigations: { by: number; target: number; party: SHParty }[];
  /** Set once the president picked a target during the current power phase. */
  powerPicked: boolean;
  peek: SHPolicy[] | null; // top 3, visible to the president during power-peek
  winner: SHParty | null;
  winReason: SHWinReason | null;
  lastVote: { president: number; chancellor: number; votes: (boolean | null)[]; passed: boolean } | null;
  log: SHLogEntry[];
  moveSeq: number;
}

export interface SHView {
  phase: SHPhase;
  seats: number;
  youSeat: number | null;
  yourRole: SHRole | null;
  /** Redacted per viewer: your own role, teammates you know, everyone when over. */
  roles: (SHRole | null)[];
  alive: boolean[];
  deckCount: number;
  discardCount: number;
  liberalEnacted: number;
  fascistEnacted: number;
  electionTracker: number;
  presidentSeat: number;
  chancellorSeat: number | null;
  nomineeSeat: number | null;
  eligibleChancellors: number[];
  /** Valid targets while a power (or nomination) is being aimed. */
  eligibleTargets: number[];
  /** True once the president made their pick in the current power phase. */
  powerPicked: boolean;
  votedSeats: boolean[]; // who has cast a vote (not what) during 'vote'
  yourVote: boolean | null;
  lastVote: SHState['lastVote'];
  hand: SHPolicy[] | null; // your policy cards when it's your decision
  vetoUnlocked: boolean;
  vetoRequested: boolean;
  peek: SHPolicy[] | null;
  investigations: { target: number; party: SHParty }[]; // yours only
  investigated: number[];
  powers: (SHPower | null)[]; // fascist track slots 1..6 for this table size
  winner: SHParty | null;
  winReason: SHWinReason | null;
  log: SHLogEntry[];
  yourTurn: boolean;
  moveSeq: number;
}

// ---- setup tables ----

function fascistCount(players: number): number {
  return players <= 6 ? 1 : players <= 8 ? 2 : 3; // excluding Hitler
}

/** Presidential power per fascist-policy slot (1-based), by table size. */
export function shPowers(players: number): (SHPower | null)[] {
  if (players <= 6) return [null, null, 'peek', 'execute', 'execute', null];
  if (players <= 8) return [null, 'investigate', 'special', 'execute', 'execute', null];
  return ['investigate', 'investigate', 'special', 'execute', 'execute', null];
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function freshDeck(): SHPolicy[] {
  return [...Array<SHPolicy>(6).fill('liberal'), ...Array<SHPolicy>(11).fill('fascist')];
}

export function createInitialSecretHitler(): SHState {
  return {
    phase: 'lobby',
    seats: 0,
    roles: [],
    alive: [],
    deck: [],
    discard: [],
    liberalEnacted: 0,
    fascistEnacted: 0,
    electionTracker: 0,
    presidentSeat: 0,
    chancellorSeat: null,
    nomineeSeat: null,
    votes: [],
    lastElected: { president: null, chancellor: null },
    presidentHand: [],
    chancellorHand: [],
    vetoRequested: false,
    specialReturnSeat: null,
    investigated: [],
    investigations: [],
    powerPicked: false,
    peek: null,
    winner: null,
    winReason: null,
    lastVote: null,
    log: [],
    moveSeq: 0,
  };
}

// ---- helpers ----

function aliveCount(s: SHState): number {
  return s.alive.filter(Boolean).length;
}

function nextAliveSeat(s: SHState, from: number): number {
  for (let i = 1; i <= s.seats; i++) {
    const seat = (from + i) % s.seats;
    if (s.alive[seat]) return seat;
  }
  return from;
}

function eligibleChancellors(s: SHState): number[] {
  const out: number[] = [];
  for (let seat = 0; seat < s.seats; seat++) {
    if (!s.alive[seat] || seat === s.presidentSeat) continue;
    if (seat === s.lastElected.chancellor) continue;
    if (aliveCount(s) > 5 && seat === s.lastElected.president) continue;
    out.push(seat);
  }
  return out;
}

function powerTargets(s: SHState): number[] {
  const out: number[] = [];
  for (let seat = 0; seat < s.seats; seat++) {
    if (!s.alive[seat] || seat === s.presidentSeat) continue;
    if (s.phase === 'power-investigate' && s.investigated.includes(seat)) continue;
    out.push(seat);
  }
  return out;
}

function reshuffleIfNeeded(s: SHState, rng: Rng): void {
  if (s.deck.length < 3) {
    s.deck = shuffle([...s.deck, ...s.discard], rng);
    s.discard = [];
  }
}

function pushLog(s: SHState, e: SHLogEntry): void {
  s.log.push(e);
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
}

function win(s: SHState, team: SHParty, reason: SHWinReason): void {
  s.winner = team;
  s.winReason = reason;
  s.phase = 'over';
  pushLog(s, { t: 'win', team, reason });
}

/** Rotate to the next president and open nominations. */
function advanceGovernment(s: SHState): void {
  const from = s.specialReturnSeat ?? s.presidentSeat;
  s.specialReturnSeat = null;
  s.presidentSeat = nextAliveSeat(s, from);
  s.chancellorSeat = null;
  s.nomineeSeat = null;
  s.votes = new Array(s.seats).fill(null);
  s.vetoRequested = false;
  s.phase = 'nominate';
}

function enactPolicy(s: SHState, policy: SHPolicy, rng: Rng, chaos: boolean): void {
  if (policy === 'liberal') s.liberalEnacted += 1;
  else s.fascistEnacted += 1;
  pushLog(s, { t: 'policy', policy, ...(chaos ? { chaos: true } : {}) });

  if (s.liberalEnacted >= 5) return win(s, 'liberal', 'liberal-policies');
  if (s.fascistEnacted >= 6) return win(s, 'fascist', 'fascist-policies');

  if (!chaos && policy === 'fascist') {
    const power = shPowers(s.seats)[s.fascistEnacted - 1];
    if (power === 'peek') {
      reshuffleIfNeeded(s, rng);
      s.peek = s.deck.slice(0, 3);
      s.phase = 'power-peek';
      return;
    }
    if (power === 'investigate') {
      // Skip the power if no valid target remains (everyone investigated).
      s.phase = 'power-investigate';
      s.powerPicked = false;
      if (powerTargets(s).length === 0) advanceGovernment(s);
      return;
    }
    if (power === 'special') {
      s.phase = 'power-special';
      return;
    }
    if (power === 'execute') {
      s.phase = 'power-execute';
      return;
    }
  }
  advanceGovernment(s);
}

function failedElection(s: SHState, rng: Rng): void {
  s.electionTracker += 1;
  if (s.electionTracker >= 3) {
    // Chaos: the country enacts the top policy on its own. Term limits reset,
    // no power triggers.
    s.electionTracker = 0;
    s.lastElected = { president: null, chancellor: null };
    reshuffleIfNeeded(s, rng);
    const policy = s.deck.shift()!;
    enactPolicy(s, policy, rng, true);
    if (s.phase === 'over') return;
  }
  advanceGovernment(s);
}

function cloneSH(s: SHState): SHState {
  return {
    ...s,
    roles: [...s.roles],
    alive: [...s.alive],
    deck: [...s.deck],
    discard: [...s.discard],
    votes: [...s.votes],
    lastElected: { ...s.lastElected },
    presidentHand: [...s.presidentHand],
    chancellorHand: [...s.chancellorHand],
    investigated: [...s.investigated],
    investigations: s.investigations.map((i) => ({ ...i })),
    peek: s.peek ? [...s.peek] : null,
    lastVote: s.lastVote ? { ...s.lastVote, votes: [...s.lastVote.votes] } : null,
    log: [...s.log],
  };
}

// ---- actions ----

function applyStart(s: SHState, seat: number, rng: Rng, players: number): void {
  if (s.phase !== 'lobby') throw new Error('already_started');
  if (seat !== 0) throw new Error('host_only');
  if (players < SH_MIN_PLAYERS || players > SH_MAX_PLAYERS) throw new Error('need_5_to_10_players');

  const roles: SHRole[] = ['hitler', ...Array<SHRole>(fascistCount(players)).fill('fascist')];
  while (roles.length < players) roles.push('liberal');
  s.roles = shuffle(roles, rng);
  s.seats = players;
  s.alive = new Array(players).fill(true);
  s.deck = shuffle(freshDeck(), rng);
  s.discard = [];
  s.presidentSeat = Math.floor(rng() * players);
  s.votes = new Array(players).fill(null);
  s.phase = 'nominate';
  pushLog(s, { t: 'start', n: players });
}

function applyNominate(s: SHState, seat: number, target: unknown): void {
  if (s.phase !== 'nominate') throw new Error('wrong_phase');
  if (seat !== s.presidentSeat) throw new Error('president_only');
  if (typeof target !== 'number' || !eligibleChancellors(s).includes(target)) throw new Error('illegal_target');
  s.nomineeSeat = target;
  s.votes = new Array(s.seats).fill(null);
  s.phase = 'vote';
  pushLog(s, { t: 'nominate', p: s.presidentSeat, c: target });
}

function applyVote(s: SHState, seat: number, ja: unknown, rng: Rng): void {
  if (s.phase !== 'vote') throw new Error('wrong_phase');
  if (!s.alive[seat]) throw new Error('dead_players_cannot_vote');
  if (s.votes[seat] !== null) throw new Error('already_voted');
  if (typeof ja !== 'boolean') throw new Error('illegal_move');
  s.votes[seat] = ja;

  const remaining = s.alive.some((a, i) => a && s.votes[i] === null);
  if (remaining) return;

  const jaCount = s.votes.filter((v) => v === true).length;
  const neinCount = s.votes.filter((v) => v === false).length;
  const passed = jaCount > neinCount;
  const nominee = s.nomineeSeat!;
  s.lastVote = { president: s.presidentSeat, chancellor: nominee, votes: [...s.votes], passed };
  pushLog(s, { t: 'election', p: s.presidentSeat, c: nominee, ja: jaCount, nein: neinCount, passed });

  if (!passed) {
    s.nomineeSeat = null;
    failedElection(s, rng);
    return;
  }

  s.chancellorSeat = nominee;
  s.nomineeSeat = null;
  s.electionTracker = 0;

  // Hitler elected chancellor after 3 fascist policies → fascists win.
  if (s.fascistEnacted >= 3 && s.roles[nominee] === 'hitler') {
    return win(s, 'fascist', 'hitler-chancellor');
  }

  s.lastElected = { president: s.presidentSeat, chancellor: nominee };
  reshuffleIfNeeded(s, rng);
  s.presidentHand = s.deck.splice(0, 3);
  s.phase = 'president-discard';
}

function applyDiscard(s: SHState, seat: number, index: unknown): void {
  if (s.phase !== 'president-discard') throw new Error('wrong_phase');
  if (seat !== s.presidentSeat) throw new Error('president_only');
  if (typeof index !== 'number' || index < 0 || index >= s.presidentHand.length) throw new Error('illegal_move');
  const [removed] = s.presidentHand.splice(index, 1);
  s.discard.push(removed);
  s.chancellorHand = s.presidentHand;
  s.presidentHand = [];
  s.phase = 'chancellor-enact';
}

function applyEnact(s: SHState, seat: number, index: unknown, rng: Rng): void {
  if (s.phase !== 'chancellor-enact') throw new Error('wrong_phase');
  if (seat !== s.chancellorSeat) throw new Error('chancellor_only');
  if (typeof index !== 'number' || index < 0 || index >= s.chancellorHand.length) throw new Error('illegal_move');
  const [policy] = s.chancellorHand.splice(index, 1);
  s.discard.push(...s.chancellorHand);
  s.chancellorHand = [];
  enactPolicy(s, policy, rng, false);
}

function applyVeto(s: SHState, seat: number): void {
  if (s.phase !== 'chancellor-enact') throw new Error('wrong_phase');
  if (seat !== s.chancellorSeat) throw new Error('chancellor_only');
  if (s.fascistEnacted < 5) throw new Error('veto_locked');
  if (s.vetoRequested) throw new Error('veto_already_refused');
  s.phase = 'veto-decision';
  pushLog(s, { t: 'veto-request', c: seat });
}

function applyVetoDecision(s: SHState, seat: number, accept: unknown, rng: Rng): void {
  if (s.phase !== 'veto-decision') throw new Error('wrong_phase');
  if (seat !== s.presidentSeat) throw new Error('president_only');
  if (typeof accept !== 'boolean') throw new Error('illegal_move');
  pushLog(s, { t: 'veto', accepted: accept });
  if (accept) {
    s.discard.push(...s.chancellorHand);
    s.chancellorHand = [];
    failedElection(s, rng); // an agreed veto advances the election tracker
  } else {
    s.vetoRequested = true;
    s.phase = 'chancellor-enact'; // must enact now
  }
}

function applyPower(s: SHState, seat: number, target: unknown): void {
  if (seat !== s.presidentSeat) throw new Error('president_only');
  if (typeof target !== 'number' || !powerTargets(s).includes(target)) throw new Error('illegal_target');

  if (s.phase === 'power-investigate') {
    if (s.powerPicked) throw new Error('already_investigated');
    const party: SHParty = s.roles[target] === 'liberal' ? 'liberal' : 'fascist';
    s.investigated.push(target);
    s.investigations.push({ by: seat, target, party });
    s.powerPicked = true;
    pushLog(s, { t: 'investigate', p: seat, target });
    // Stay in phase; the president confirms with 'continue' after reading it.
    return;
  }
  if (s.phase === 'power-special') {
    pushLog(s, { t: 'special', p: seat, target });
    s.specialReturnSeat = s.presidentSeat;
    s.presidentSeat = target;
    s.chancellorSeat = null;
    s.nomineeSeat = null;
    s.votes = new Array(s.seats).fill(null);
    s.vetoRequested = false;
    s.phase = 'nominate';
    return;
  }
  if (s.phase === 'power-execute') {
    s.alive[target] = false;
    pushLog(s, { t: 'execute', p: seat, target });
    if (s.roles[target] === 'hitler') return win(s, 'liberal', 'hitler-killed');
    advanceGovernment(s);
    return;
  }
  throw new Error('wrong_phase');
}

function applyContinue(s: SHState, seat: number): void {
  if (seat !== s.presidentSeat) throw new Error('president_only');
  if (s.phase === 'power-peek') {
    pushLog(s, { t: 'peek', p: seat });
    s.peek = null;
    advanceGovernment(s);
    return;
  }
  if (s.phase === 'power-investigate') {
    // Only valid once a target was picked this phase.
    if (!s.powerPicked) throw new Error('pick_target_first');
    advanceGovernment(s);
    return;
  }
  throw new Error('wrong_phase');
}

// ---- module ----

export const secretHitlerModule: GameModule<SHState, SHAction, unknown, SHView> = {
  id: 'secrethitler',
  name: 'Secret Hitler',
  minPlayers: SH_MIN_PLAYERS,
  maxPlayers: SH_MAX_PLAYERS,

  createInitialState() {
    return createInitialSecretHitler();
  },

  acceptsNewPlayers(state) {
    return state.phase === 'lobby';
  },

  applyAction(state, action, seat, rng, ctx) {
    if (state.phase === 'over') throw new Error('game_over');
    const s = cloneSH(state);
    switch (action.type) {
      case 'start':
        applyStart(s, seat, rng, ctx?.seats ?? 0);
        break;
      case 'nominate':
        applyNominate(s, seat, action.target);
        break;
      case 'vote':
        applyVote(s, seat, action.ja, rng);
        break;
      case 'discard':
        applyDiscard(s, seat, action.index);
        break;
      case 'enact':
        applyEnact(s, seat, action.index, rng);
        break;
      case 'veto':
        applyVeto(s, seat);
        break;
      case 'veto-decision':
        applyVetoDecision(s, seat, action.accept, rng);
        break;
      case 'power':
        applyPower(s, seat, action.target);
        break;
      case 'continue':
        applyContinue(s, seat);
        break;
      default:
        throw new Error('unknown_action');
    }
    s.moveSeq += 1;
    return s;
  },

  isOver(state) {
    return state.phase === 'over';
  },

  viewFor(state, seat) {
    const s = state;
    const me = seat !== null && seat < s.seats ? seat : seat !== null && s.phase === 'lobby' ? seat : null;
    const myRole = me !== null && s.roles.length > me ? s.roles[me] : null;

    // Role knowledge: yours; fascists know each other + Hitler; Hitler knows
    // the fascist only at 5-6 players; everyone sees everything when over.
    const roles: (SHRole | null)[] = new Array(s.seats).fill(null);
    if (s.phase === 'over') {
      for (let i = 0; i < s.seats; i++) roles[i] = s.roles[i];
    } else if (me !== null && myRole) {
      roles[me] = myRole;
      if (myRole === 'fascist') {
        for (let i = 0; i < s.seats; i++) if (s.roles[i] !== 'liberal') roles[i] = s.roles[i];
      } else if (myRole === 'hitler' && s.seats <= 6) {
        for (let i = 0; i < s.seats; i++) if (s.roles[i] === 'fascist') roles[i] = 'fascist';
      }
    }

    const isPresident = me !== null && me === s.presidentSeat;
    const isChancellor = me !== null && me === s.chancellorSeat;
    const hand =
      s.phase === 'president-discard' && isPresident
        ? [...s.presidentHand]
        : s.phase === 'chancellor-enact' && isChancellor
          ? [...s.chancellorHand]
          : null;

    const yourTurn =
      me !== null &&
      s.phase !== 'lobby' &&
      s.phase !== 'over' &&
      (s.phase === 'nominate'
        ? isPresident
        : s.phase === 'vote'
          ? s.alive[me] && s.votes[me] === null
          : s.phase === 'president-discard'
            ? isPresident
            : s.phase === 'chancellor-enact'
              ? isChancellor
              : s.phase === 'veto-decision'
                ? isPresident
                : isPresident); // powers

    return {
      phase: s.phase,
      seats: s.seats,
      youSeat: me,
      yourRole: myRole,
      roles,
      alive: [...s.alive],
      deckCount: s.deck.length,
      discardCount: s.discard.length,
      liberalEnacted: s.liberalEnacted,
      fascistEnacted: s.fascistEnacted,
      electionTracker: s.electionTracker,
      presidentSeat: s.presidentSeat,
      chancellorSeat: s.chancellorSeat,
      nomineeSeat: s.nomineeSeat,
      eligibleChancellors: s.phase === 'nominate' ? eligibleChancellors(s) : [],
      eligibleTargets:
        (s.phase === 'power-investigate' && !s.powerPicked) || s.phase === 'power-special' || s.phase === 'power-execute'
          ? powerTargets(s)
          : [],
      powerPicked: s.powerPicked,
      votedSeats: s.votes.map((v) => v !== null),
      yourVote: me !== null && s.phase === 'vote' ? s.votes[me] : null,
      lastVote: s.lastVote ? { ...s.lastVote, votes: [...s.lastVote.votes] } : null,
      hand,
      vetoUnlocked: s.fascistEnacted >= 5,
      vetoRequested: s.vetoRequested,
      peek: s.phase === 'power-peek' && isPresident && s.peek ? [...s.peek] : null,
      investigations:
        me === null ? [] : s.investigations.filter((i) => i.by === me).map(({ target, party }) => ({ target, party })),
      investigated: [...s.investigated],
      powers: shPowers(s.seats || SH_MIN_PLAYERS),
      winner: s.winner,
      winReason: s.winReason,
      log: [...s.log],
      yourTurn,
      moveSeq: s.moveSeq,
    };
  },

  needsAutoStep() {
    return null;
  },
};
