import { describe, expect, it } from 'vitest';
import { createInitialSecretHitler, secretHitlerModule as mod, shPowers } from '../src/secrethitler';
import type { SHAction, SHPolicy, SHState } from '../src/secrethitler';
import type { Rng } from '../src/dice';

// Deterministic rng: 0 keeps shuffles stable (Fisher-Yates with rng()=0 swaps
// element i with 0 each step) and picks seat 0 as the first president.
const rng: Rng = () => 0;

function start(players = 5, r: Rng = rng): SHState {
  const s = createInitialSecretHitler();
  return mod.applyAction(s, { type: 'start' }, 0, r, { seats: players });
}

function act(s: SHState, action: SHAction, seat: number, r: Rng = rng): SHState {
  return mod.applyAction(s, action, seat, r, { seats: s.seats });
}

/** Everyone alive votes the same way. */
function voteAll(s: SHState, ja: boolean): SHState {
  for (let seat = 0; seat < s.seats; seat++) {
    if (s.alive[seat] && s.votes[seat] === null) s = act(s, { type: 'vote', ja }, seat);
  }
  return s;
}

/** Elect the given chancellor unanimously. */
function elect(s: SHState, chancellor: number): SHState {
  s = act(s, { type: 'nominate', target: chancellor }, s.presidentSeat);
  return voteAll(s, true);
}

/** Force the deck so draws are predictable (top of deck = index 0). */
function rigDeck(s: SHState, top: SHPolicy[]): SHState {
  const next = structuredClone(s);
  next.deck = [...top];
  next.discard = [];
  return next;
}

/** Play one full legislative round enacting the given policy type. */
function enactRound(s: SHState, policy: SHPolicy): SHState {
  const pres = s.presidentSeat;
  const chan = pres === 0 ? (s.alive[1] ? 1 : 2) : 0;
  const pick = eligible(s).includes(chan) ? chan : eligible(s)[0];
  s = rigDeck(s, [policy, policy, policy, ...s.deck]);
  s = elect(s, pick);
  s = act(s, { type: 'discard', index: 0 }, s.presidentSeat);
  return act(s, { type: 'enact', index: 0 }, s.chancellorSeat!);
}

function eligible(s: SHState): number[] {
  return mod.viewFor(s, s.presidentSeat).eligibleChancellors;
}

describe('setup', () => {
  it('deals the right role mix per player count', () => {
    const expectFor = (n: number, fascists: number) => {
      const s = start(n);
      expect(s.roles).toHaveLength(n);
      expect(s.roles.filter((r) => r === 'hitler')).toHaveLength(1);
      expect(s.roles.filter((r) => r === 'fascist')).toHaveLength(fascists);
      expect(s.roles.filter((r) => r === 'liberal')).toHaveLength(n - fascists - 1);
    };
    expectFor(5, 1);
    expectFor(6, 1);
    expectFor(7, 2);
    expectFor(8, 2);
    expectFor(9, 3);
    expectFor(10, 3);
  });

  it('builds a 17-card deck (6 liberal, 11 fascist)', () => {
    const s = start(5);
    expect(s.deck).toHaveLength(17);
    expect(s.deck.filter((p) => p === 'liberal')).toHaveLength(6);
  });

  it('rejects start below 5 or above 10 players, or from a non-host', () => {
    const s = createInitialSecretHitler();
    expect(() => mod.applyAction(s, { type: 'start' }, 0, rng, { seats: 4 })).toThrow();
    expect(() => mod.applyAction(s, { type: 'start' }, 0, rng, { seats: 11 })).toThrow();
    expect(() => mod.applyAction(s, { type: 'start' }, 1, rng, { seats: 5 })).toThrow();
  });

  it('only accepts new players while in lobby', () => {
    const lobby = createInitialSecretHitler();
    expect(mod.acceptsNewPlayers!(lobby)).toBe(true);
    expect(mod.acceptsNewPlayers!(start(5))).toBe(false);
  });
});

describe('elections', () => {
  it('passes a majority vote and moves to legislation', () => {
    let s = start(5);
    const chan = eligible(s)[0];
    s = elect(s, chan);
    expect(s.phase).toBe('president-discard');
    expect(s.chancellorSeat).toBe(chan);
    expect(s.presidentHand).toHaveLength(3);
    expect(s.lastVote?.passed).toBe(true);
  });

  it('fails a tie and advances the tracker + presidency', () => {
    let s = start(6);
    const before = s.presidentSeat;
    s = act(s, { type: 'nominate', target: eligible(s)[0] }, before);
    // 3 ja, 3 nein → tie → fail
    let ja = 0;
    for (let seat = 0; seat < 6; seat++) s = act(s, { type: 'vote', ja: ja++ < 3 }, seat);
    expect(s.electionTracker).toBe(1);
    expect(s.phase).toBe('nominate');
    expect(s.presidentSeat).not.toBe(before);
  });

  it('term limits: last elected chancellor is not eligible', () => {
    let s = start(5);
    const chan = eligible(s)[0];
    s = elect(s, chan);
    s = act(s, { type: 'discard', index: 0 }, s.presidentSeat);
    s = act(s, { type: 'enact', index: 0 }, chan);
    if (s.phase === 'nominate') {
      expect(eligible(s)).not.toContain(chan);
    }
  });

  it('three failed elections trigger chaos: top policy enacted, limits reset', () => {
    let s = start(5);
    s = rigDeck(s, ['liberal', 'fascist', 'fascist', ...s.deck]);
    for (let round = 0; round < 3; round++) {
      s = act(s, { type: 'nominate', target: eligible(s)[0] }, s.presidentSeat);
      s = voteAll(s, false);
    }
    expect(s.liberalEnacted).toBe(1); // top card was liberal
    expect(s.electionTracker).toBe(0);
    expect(s.lastElected).toEqual({ president: null, chancellor: null });
    expect(s.log.some((e) => e.t === 'policy' && e.chaos)).toBe(true);
  });
});

describe('legislation', () => {
  it('president discards one, chancellor enacts one, leftovers hit the discard pile', () => {
    let s = start(5);
    s = rigDeck(s, ['fascist', 'liberal', 'fascist', 'liberal', 'liberal', 'fascist']);
    s = elect(s, eligible(s)[0]);
    s = act(s, { type: 'discard', index: 0 }, s.presidentSeat); // toss the fascist
    expect(s.chancellorHand).toEqual(['liberal', 'fascist']);
    s = act(s, { type: 'enact', index: 0 }, s.chancellorSeat!); // enact liberal
    expect(s.liberalEnacted).toBe(1);
    expect(s.discard).toHaveLength(2); // president's toss + chancellor's leftover
  });

  it('reshuffles the discard pile back in when the deck runs low', () => {
    let s = start(5);
    s = rigDeck(s, ['fascist', 'fascist']);
    const next = structuredClone(s);
    next.discard = ['liberal', 'liberal', 'liberal'];
    s = elect(next, eligible(next)[0]);
    expect(s.presidentHand).toHaveLength(3);
    expect(s.deck.length + s.presidentHand.length).toBe(5);
  });

  it('5 liberal policies win the game for liberals', () => {
    let s = start(5);
    for (let i = 0; i < 5 && s.phase !== 'over'; i++) s = enactRound(s, 'liberal');
    expect(s.winner).toBe('liberal');
    expect(s.winReason).toBe('liberal-policies');
  });
});

describe('fascist track & powers', () => {
  it('matches the official power tables', () => {
    expect(shPowers(5)).toEqual([null, null, 'peek', 'execute', 'execute', null]);
    expect(shPowers(7)).toEqual([null, 'investigate', 'special', 'execute', 'execute', null]);
    expect(shPowers(9)).toEqual(['investigate', 'investigate', 'special', 'execute', 'execute', null]);
  });

  it('5p: 3rd fascist policy grants a peek of the top 3', () => {
    let s = start(5);
    s = enactRound(s, 'fascist');
    s = enactRound(s, 'fascist');
    s = enactRound(s, 'fascist');
    expect(s.phase).toBe('power-peek');
    const view = mod.viewFor(s, s.presidentSeat);
    expect(view.peek).toHaveLength(3);
    // hidden from everyone else
    const other = [0, 1, 2, 3, 4].find((x) => x !== s.presidentSeat)!;
    expect(mod.viewFor(s, other).peek).toBeNull();
    s = act(s, { type: 'continue' }, s.presidentSeat);
    expect(s.phase).toBe('nominate');
  });

  it('7p: 2nd fascist policy lets the president investigate a party card', () => {
    let s = start(7);
    s = enactRound(s, 'fascist');
    s = enactRound(s, 'fascist');
    expect(s.phase).toBe('power-investigate');
    const target = mod.viewFor(s, s.presidentSeat).eligibleTargets[0];
    s = act(s, { type: 'power', target }, s.presidentSeat);
    const view = mod.viewFor(s, s.presidentSeat);
    expect(view.investigations).toHaveLength(1);
    expect(view.investigations[0].target).toBe(target);
    // secret from others
    const other = Array.from({ length: 7 }, (_, i) => i).find((x) => x !== s.presidentSeat)!;
    expect(mod.viewFor(s, other).investigations).toHaveLength(0);
    s = act(s, { type: 'continue' }, s.presidentSeat);
    expect(s.phase).toBe('nominate');
    expect(s.investigated).toContain(target);
  });

  it('7p: 3rd fascist policy is a special election; rotation resumes after', () => {
    let s = start(7);
    s = enactRound(s, 'fascist');
    s = enactRound(s, 'fascist');
    const inv = mod.viewFor(s, s.presidentSeat).eligibleTargets[0];
    s = act(s, { type: 'power', target: inv }, s.presidentSeat);
    s = act(s, { type: 'continue' }, s.presidentSeat);
    s = enactRound(s, 'fascist');
    expect(s.phase).toBe('power-special');
    const specialPresident = s.presidentSeat;
    const target = mod.viewFor(s, s.presidentSeat).eligibleTargets[0];
    s = act(s, { type: 'power', target }, s.presidentSeat);
    expect(s.presidentSeat).toBe(target);
    expect(s.phase).toBe('nominate');
    // fail the special president's election → rotation resumes from the seat
    // after the president who called the special election
    s = act(s, { type: 'nominate', target: eligible(s)[0] }, s.presidentSeat);
    s = voteAll(s, false);
    let expected = (specialPresident + 1) % 7;
    while (!s.alive[expected]) expected = (expected + 1) % 7;
    expect(s.presidentSeat).toBe(expected);
  });

  it('execution kills; shooting Hitler wins for liberals', () => {
    let s = start(5);
    for (let i = 0; i < 4 && s.phase !== 'power-execute'; i++) {
      s = enactRound(s, 'fascist');
      if (s.phase === 'power-peek') s = act(s, { type: 'continue' }, s.presidentSeat);
    }
    expect(s.phase).toBe('power-execute');
    const hitler = s.roles.indexOf('hitler');
    if (hitler === s.presidentSeat) {
      // president can't shoot themselves; shoot someone else and check death
      const target = mod.viewFor(s, s.presidentSeat).eligibleTargets[0];
      s = act(s, { type: 'power', target }, s.presidentSeat);
      expect(s.alive[target]).toBe(false);
      expect(s.phase).toBe('nominate');
    } else {
      s = act(s, { type: 'power', target: hitler }, s.presidentSeat);
      expect(s.winner).toBe('liberal');
      expect(s.winReason).toBe('hitler-killed');
    }
  });

  it('6 fascist policies win for fascists', () => {
    let s = start(5);
    for (let i = 0; i < 6 && s.phase !== 'over'; i++) {
      s = enactRound(s, 'fascist');
      if (s.phase === 'power-peek') s = act(s, { type: 'continue' }, s.presidentSeat);
      if (s.phase === 'power-execute') {
        // shoot a liberal to keep the game going
        const targets = mod.viewFor(s, s.presidentSeat).eligibleTargets;
        const liberal = targets.find((t) => s.roles[t] === 'liberal')!;
        s = act(s, { type: 'power', target: liberal }, s.presidentSeat);
      }
    }
    expect(s.winner).toBe('fascist');
    expect(s.winReason).toBe('fascist-policies');
  });

  it('electing Hitler chancellor after 3 fascist policies wins for fascists', () => {
    let s = start(5);
    s = enactRound(s, 'fascist');
    s = enactRound(s, 'fascist');
    s = enactRound(s, 'fascist');
    if (s.phase === 'power-peek') s = act(s, { type: 'continue' }, s.presidentSeat);
    // keep advancing presidents until Hitler is nominatable
    const hitler = s.roles.indexOf('hitler');
    for (let i = 0; i < 6 && s.phase === 'nominate'; i++) {
      if (eligible(s).includes(hitler)) {
        s = elect(s, hitler);
        expect(s.winner).toBe('fascist');
        expect(s.winReason).toBe('hitler-chancellor');
        return;
      }
      s = act(s, { type: 'nominate', target: eligible(s)[0] }, s.presidentSeat);
      s = voteAll(s, false);
    }
    throw new Error('never got a shot at nominating hitler');
  });
});

describe('veto', () => {
  function toFiveFascist(): SHState {
    let s = start(5);
    while (s.fascistEnacted < 5 && s.phase !== 'over') {
      s = enactRound(s, 'fascist');
      if (s.phase === 'power-peek') s = act(s, { type: 'continue' }, s.presidentSeat);
      if (s.phase === 'power-execute') {
        const liberal = mod.viewFor(s, s.presidentSeat).eligibleTargets.find((t) => s.roles[t] === 'liberal')!;
        s = act(s, { type: 'power', target: liberal }, s.presidentSeat);
      }
    }
    return s;
  }

  it('unlocks at 5 fascist policies; agreed veto burns the hand and bumps the tracker', () => {
    let s = toFiveFascist();
    expect(s.fascistEnacted).toBe(5);
    // elect a non-hitler chancellor so the game doesn't end instantly
    const safe = eligible(s).find((t) => s.roles[t] !== 'hitler')!;
    s = rigDeck(s, ['fascist', 'fascist', 'fascist', ...s.deck]);
    s = elect(s, safe);
    s = act(s, { type: 'discard', index: 0 }, s.presidentSeat);
    const tracker = s.electionTracker;
    const discardBefore = s.discard.length;
    s = act(s, { type: 'veto' }, s.chancellorSeat!);
    expect(s.phase).toBe('veto-decision');
    s = act(s, { type: 'veto-decision', accept: true }, s.presidentSeat);
    expect(s.discard.length).toBe(discardBefore + 2);
    expect(s.electionTracker).toBe(tracker + 1);
    expect(s.phase).toBe('nominate');
  });

  it('a refused veto forces the chancellor to enact', () => {
    let s = toFiveFascist();
    const safe = eligible(s).find((t) => s.roles[t] !== 'hitler')!;
    s = rigDeck(s, ['liberal', 'liberal', 'liberal', ...s.deck]);
    s = elect(s, safe);
    s = act(s, { type: 'discard', index: 0 }, s.presidentSeat);
    s = act(s, { type: 'veto' }, s.chancellorSeat!);
    s = act(s, { type: 'veto-decision', accept: false }, s.presidentSeat);
    expect(s.phase).toBe('chancellor-enact');
    expect(() => act(s, { type: 'veto' }, s.chancellorSeat!)).toThrow();
    s = act(s, { type: 'enact', index: 0 }, s.chancellorSeat!);
    expect(s.liberalEnacted).toBeGreaterThan(0);
  });

  it('veto is rejected before 5 fascist policies', () => {
    let s = start(5);
    s = rigDeck(s, ['liberal', 'liberal', 'liberal', ...s.deck]);
    s = elect(s, eligible(s)[0]);
    s = act(s, { type: 'discard', index: 0 }, s.presidentSeat);
    expect(() => act(s, { type: 'veto' }, s.chancellorSeat!)).toThrow();
  });
});

describe('view redaction', () => {
  it('liberals see only their own role; fascists see the whole team', () => {
    const s = start(7);
    const liberal = s.roles.indexOf('liberal');
    const fascist = s.roles.indexOf('fascist');
    const lview = mod.viewFor(s, liberal);
    expect(lview.roles.filter((r) => r !== null)).toHaveLength(1);
    expect(lview.roles[liberal]).toBe('liberal');
    const fview = mod.viewFor(s, fascist);
    const known = fview.roles.filter((r) => r !== null);
    expect(known).toContain('hitler');
    expect(known.filter((r) => r === 'fascist')).toHaveLength(2);
  });

  it('hitler knows the fascist at 5-6 players but not at 7+', () => {
    const small = start(6);
    const hSmall = small.roles.indexOf('hitler');
    expect(mod.viewFor(small, hSmall).roles.filter((r) => r === 'fascist')).toHaveLength(1);
    const big = start(8);
    const hBig = big.roles.indexOf('hitler');
    expect(mod.viewFor(big, hBig).roles.filter((r) => r === 'fascist')).toHaveLength(0);
  });

  it('policy hands are visible only to their owner; deck contents never leak', () => {
    let s = start(5);
    s = elect(s, eligible(s)[0]);
    const pres = mod.viewFor(s, s.presidentSeat);
    expect(pres.hand).toHaveLength(3);
    const other = [0, 1, 2, 3, 4].find((x) => x !== s.presidentSeat)!;
    expect(mod.viewFor(s, other).hand).toBeNull();
    expect(JSON.stringify(mod.viewFor(s, other))).not.toContain('"deck"');
  });

  it('votes stay hidden until everyone voted, then the tally is public', () => {
    let s = start(5);
    s = act(s, { type: 'nominate', target: eligible(s)[0] }, s.presidentSeat);
    s = act(s, { type: 'vote', ja: true }, 0);
    const midView = mod.viewFor(s, 1);
    expect(midView.votedSeats[0]).toBe(true);
    expect(midView.yourVote).toBeNull();
    expect(midView.lastVote).toBeNull();
    s = voteAll(s, true);
    expect(mod.viewFor(s, 1).lastVote?.votes[0]).toBe(true);
  });

  it('all roles are revealed when the game ends', () => {
    let s = start(5);
    for (let i = 0; i < 5 && s.phase !== 'over'; i++) s = enactRound(s, 'liberal');
    const view = mod.viewFor(s, 0);
    expect(view.roles.every((r) => r !== null)).toBe(true);
  });

  it('dead players cannot vote', () => {
    let s = start(5);
    for (let i = 0; i < 4 && s.phase !== 'power-execute'; i++) {
      s = enactRound(s, 'fascist');
      if (s.phase === 'power-peek') s = act(s, { type: 'continue' }, s.presidentSeat);
    }
    const target = mod.viewFor(s, s.presidentSeat).eligibleTargets.find((t) => s.roles[t] !== 'hitler')!;
    s = act(s, { type: 'power', target }, s.presidentSeat);
    if (s.phase === 'nominate') {
      s = act(s, { type: 'nominate', target: eligible(s)[0] }, s.presidentSeat);
      expect(() => act(s, { type: 'vote', ja: true }, target)).toThrow();
    }
  });
});
