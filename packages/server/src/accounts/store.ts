// Authoritative stats/leaderboard/history store (Firestore). The *server* writes
// these when a match finishes, so they can't be spoofed by a client. These are
// the perks that make registering worthwhile; everything degrades to no-ops when
// accounts are disabled.

import { FieldValue } from 'firebase-admin/firestore';
import { accountsEnabled, db } from './firebase';

export interface UserStats {
  uid: string;
  handle: string;
  avatar: string | null;
  games: number;
  wins: number;
  losses: number;
  gammons: number; // gammon/backgammon wins (mars+)
  rating: number; // Elo, updated only when both players are registered
  streak: number; // +n win streak, -n loss streak
  bestStreak: number;
  updatedAt: number;
}

export interface MatchPlayer {
  seat: number;
  color: 'white' | 'black';
  uid: string | null;
  name: string;
  avatar: string | null;
  score: number;
}

export interface RecordMatchInput {
  roomId: string;
  gameId: string;
  players: MatchPlayer[];
  winnerColor: 'white' | 'black';
  finalKind: string; // tavla: single|gammon|backgammon, dama: win
  finishedAt: number;
}

const START_RATING = 1200;
const K = 24;

function defaultStats(uid: string, handle: string, avatar: string | null): UserStats {
  return {
    uid,
    handle,
    avatar,
    games: 0,
    wins: 0,
    losses: 0,
    gammons: 0,
    rating: START_RATING,
    streak: 0,
    bestStreak: 0,
    updatedAt: 0,
  };
}

function expectedScore(self: number, opp: number): number {
  return 1 / (1 + 10 ** ((opp - self) / 400));
}

export async function recordMatchResult(input: RecordMatchInput): Promise<void> {
  if (!accountsEnabled()) return;
  const authed = input.players.filter((p) => p.uid);
  if (authed.length === 0) return;

  const firestore = db();
  const both = authed.length === 2;

  await firestore.runTransaction(async (tx) => {
    const refs = authed.map((p) => firestore.collection('users').doc(p.uid as string));
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    const stats = authed.map((p, i) => {
      const existing = snaps[i].exists ? (snaps[i].data() as UserStats) : null;
      const base = existing ?? defaultStats(p.uid as string, p.name, p.avatar);
      return { ...base, handle: existing?.handle ?? p.name, avatar: p.avatar ?? base.avatar };
    });

    // Elo (only when both registered)
    let newRatings = stats.map((s) => s.rating);
    if (both) {
      const winIdx = authed.findIndex((p) => p.color === input.winnerColor);
      const loseIdx = winIdx === 0 ? 1 : 0;
      const rw = stats[winIdx].rating;
      const rl = stats[loseIdx].rating;
      newRatings[winIdx] = Math.round(rw + K * (1 - expectedScore(rw, rl)));
      newRatings[loseIdx] = Math.round(rl + K * (0 - expectedScore(rl, rw)));
    }

    authed.forEach((p, i) => {
      const won = p.color === input.winnerColor;
      const s = stats[i];
      const streak = won ? Math.max(s.streak, 0) + 1 : Math.min(s.streak, 0) - 1;
      const updated: UserStats = {
        ...s,
        games: s.games + 1,
        wins: s.wins + (won ? 1 : 0),
        losses: s.losses + (won ? 0 : 1),
        gammons:
          s.gammons + (won && (input.finalKind === 'gammon' || input.finalKind === 'backgammon') ? 1 : 0),
        rating: newRatings[i],
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
        updatedAt: input.finishedAt,
      };
      tx.set(refs[i], updated, { merge: true });
    });
  });

  // Match history (one doc per registered player).
  const batch = firestore.batch();
  for (const p of authed) {
    const ref = firestore
      .collection('users')
      .doc(p.uid as string)
      .collection('matches')
      .doc(`${input.finishedAt}-${input.roomId}`);
    const opponent = input.players.find((o) => o.seat !== p.seat);
    batch.set(ref, {
      roomId: input.roomId,
      gameId: input.gameId,
      won: p.color === input.winnerColor,
      kind: input.finalKind,
      myScore: p.score,
      opponentName: opponent?.name ?? '—',
      opponentUid: opponent?.uid ?? null,
      opponentScore: opponent?.score ?? 0,
      finishedAt: input.finishedAt,
    });
  }
  await batch.commit();

  // Credit the winner's daily-tournament score if they joined it.
  const winner = input.players.find((p) => p.color === input.winnerColor);
  if (winner?.uid) {
    try {
      await bumpTournament(winner.uid, input.gameId, input.finishedAt);
    } catch {
      /* tournament credit is best-effort */
    }
  }
}

// ---- Friends ----

export interface FriendInfo {
  uid: string;
  handle: string;
  avatar: string | null;
}

export async function findUserByHandle(handle: string): Promise<FriendInfo | null> {
  if (!accountsEnabled()) return null;
  const snap = await db().collection('users').where('handle', '==', handle).limit(1).get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data() as UserStats;
  return { uid: d.id, handle: data.handle, avatar: data.avatar };
}

export async function addFriend(uid: string, handle: string): Promise<FriendInfo | { error: string }> {
  if (!accountsEnabled()) return { error: 'disabled' };
  const target = await findUserByHandle(handle.trim());
  if (!target) return { error: 'not_found' };
  if (target.uid === uid) return { error: 'self' };
  await db()
    .collection('users')
    .doc(uid)
    .collection('friends')
    .doc(target.uid)
    .set({ handle: target.handle, avatar: target.avatar, addedAt: Date.now() }, { merge: true });
  return target;
}

export async function removeFriend(uid: string, friendUid: string): Promise<void> {
  if (!accountsEnabled()) return;
  await db().collection('users').doc(uid).collection('friends').doc(friendUid).delete();
}

export async function isFriend(uid: string, friendUid: string): Promise<boolean> {
  if (!accountsEnabled()) return false;
  const doc = await db().collection('users').doc(uid).collection('friends').doc(friendUid).get();
  return doc.exists;
}

export async function listFriends(uid: string): Promise<FriendInfo[]> {
  if (!accountsEnabled()) return [];
  const snap = await db().collection('users').doc(uid).collection('friends').get();
  return snap.docs.map((d) => ({
    uid: d.id,
    handle: (d.data().handle as string) ?? 'Oyuncu',
    avatar: (d.data().avatar as string) ?? null,
  }));
}

// ---- Daily tournaments (one per game per day) ----

export interface TournamentMeta {
  id: string;
  gameId: string;
  date: string;
  name: string;
}

export interface TournamentStanding {
  uid: string;
  handle: string;
  avatar: string | null;
  points: number;
  wins: number;
}

function dayStr(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function currentTournament(gameId: string, ts = Date.now()): TournamentMeta {
  const date = dayStr(ts);
  const pretty = new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const name = `${gameId === 'dama' ? 'Dama' : 'Tavla'} Günlük Turnuva · ${pretty}`;
  return { id: `${gameId}-${date}`, gameId, date, name };
}

export async function joinTournament(uid: string, gameId: string, handle: string, avatar: string | null): Promise<TournamentMeta | { error: string }> {
  if (!accountsEnabled()) return { error: 'disabled' };
  const t = currentTournament(gameId);
  const tref = db().collection('tournaments').doc(t.id);
  await tref.set({ gameId: t.gameId, date: t.date, name: t.name }, { merge: true });
  await tref
    .collection('participants')
    .doc(uid)
    .set({ handle, avatar, joinedAt: Date.now(), points: FieldValue.increment(0), wins: FieldValue.increment(0) }, { merge: true });
  return t;
}

export async function tournamentStandings(gameId: string, ts = Date.now()): Promise<{ meta: TournamentMeta; standings: TournamentStanding[] }> {
  const meta = currentTournament(gameId, ts);
  if (!accountsEnabled()) return { meta, standings: [] };
  const snap = await db().collection('tournaments').doc(meta.id).collection('participants').orderBy('points', 'desc').limit(50).get();
  const standings = snap.docs.map((d) => {
    const v = d.data();
    return { uid: d.id, handle: (v.handle as string) ?? 'Oyuncu', avatar: (v.avatar as string) ?? null, points: (v.points as number) ?? 0, wins: (v.wins as number) ?? 0 };
  });
  return { meta, standings };
}

async function bumpTournament(uid: string, gameId: string, ts: number): Promise<void> {
  const t = currentTournament(gameId, ts);
  const pref = db().collection('tournaments').doc(t.id).collection('participants').doc(uid);
  const doc = await pref.get();
  if (!doc.exists) return; // only counts if the player joined
  await pref.set({ points: FieldValue.increment(1), wins: FieldValue.increment(1) }, { merge: true });
}

export async function getLeaderboard(limit = 50): Promise<UserStats[]> {
  if (!accountsEnabled()) return [];
  const snap = await db()
    .collection('users')
    .orderBy('rating', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as UserStats);
}

export async function getProfile(uid: string): Promise<UserStats | null> {
  if (!accountsEnabled()) return null;
  const snap = await db().collection('users').doc(uid).get();
  return snap.exists ? (snap.data() as UserStats) : null;
}

export async function getMatchHistory(uid: string, limit = 20): Promise<unknown[]> {
  if (!accountsEnabled()) return [];
  const snap = await db()
    .collection('users')
    .doc(uid)
    .collection('matches')
    .orderBy('finishedAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data());
}

export async function ensureProfile(
  uid: string,
  handle: string,
  avatar: string | null,
): Promise<UserStats> {
  const existing = await getProfile(uid);
  if (existing) return existing;
  const fresh = defaultStats(uid, handle, avatar);
  await db().collection('users').doc(uid).set(fresh, { merge: true });
  return fresh;
}

export async function updateProfile(
  uid: string,
  patch: { handle?: string; avatar?: string | null },
): Promise<void> {
  if (!accountsEnabled()) return;
  const clean: Record<string, unknown> = {};
  if (typeof patch.handle === 'string') clean.handle = patch.handle.slice(0, 24);
  if (patch.avatar !== undefined) clean.avatar = patch.avatar;
  if (Object.keys(clean).length === 0) return;
  await db().collection('users').doc(uid).set(clean, { merge: true });
}
