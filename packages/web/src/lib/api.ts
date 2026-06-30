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
  mode: 'classic' | 'backgammon';
  won: boolean;
  kind: 'single' | 'gammon' | 'backgammon';
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
