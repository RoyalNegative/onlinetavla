// REST helpers for account perks (leaderboard, profile, history).

import { currentIdToken } from './firebase';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await currentIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface LeaderboardEntry {
  uid: string;
  handle: string;
  avatar: string | null;
  games: number;
  wins: number;
  losses: number;
  gammons: number;
  rating: number;
  streak: number;
  bestStreak: number;
}

export interface MatchRecord {
  roomId: string;
  gameId: string;
  won: boolean;
  kind: string;
  myScore: number;
  opponentName: string;
  opponentScore: number;
  finishedAt: number;
}

export async function fetchAccountsEnabled(): Promise<boolean> {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    return Boolean(data.accountsEnabled);
  } catch {
    return false;
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    return (data.entries ?? []) as LeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function fetchMyProfile(): Promise<LeaderboardEntry | null> {
  const res = await fetch('/api/me', { headers: await authHeaders() });
  if (!res.ok) return null;
  return (await res.json()).profile as LeaderboardEntry;
}

export async function fetchMyMatches(): Promise<MatchRecord[]> {
  const res = await fetch('/api/me/matches', { headers: await authHeaders() });
  if (!res.ok) return [];
  return ((await res.json()).matches ?? []) as MatchRecord[];
}

export async function updateHandle(handle: string): Promise<void> {
  await fetch('/api/me', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ handle }),
  });
}

export interface Friend {
  uid: string;
  handle: string;
  avatar: string | null;
  online: boolean;
}

export async function fetchFriends(): Promise<Friend[]> {
  const res = await fetch('/api/friends', { headers: await authHeaders() });
  if (!res.ok) return [];
  return ((await res.json()).friends ?? []) as Friend[];
}

export async function addFriend(handle: string): Promise<{ friend?: Friend; error?: string }> {
  const res = await fetch('/api/friends', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ handle }),
  });
  const data = await res.json();
  return res.ok ? { friend: data.friend } : { error: data.error ?? 'error' };
}

export async function removeFriend(uid: string): Promise<void> {
  await fetch(`/api/friends/${uid}`, { method: 'DELETE', headers: await authHeaders() });
}

export interface TournamentStanding {
  uid: string;
  handle: string;
  avatar: string | null;
  points: number;
  wins: number;
}

export interface Tournament {
  meta: { id: string; gameId: string; date: string; name: string };
  standings: TournamentStanding[];
  joined: boolean;
}

export async function fetchTournament(gameId: 'tavla' | 'dama'): Promise<Tournament> {
  const res = await fetch(`/api/tournaments?gameId=${gameId}`, { headers: await authHeaders() });
  return (await res.json()) as Tournament;
}

export async function joinTournament(gameId: 'tavla' | 'dama'): Promise<boolean> {
  const res = await fetch('/api/tournaments/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ gameId }),
  });
  return res.ok;
}
