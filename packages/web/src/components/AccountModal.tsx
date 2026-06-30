// Leaderboard / profile / match history — the perks for registered players.

import { useEffect, useState } from 'react';
import {
  fetchLeaderboard,
  fetchMyMatches,
  fetchMyProfile,
  type LeaderboardEntry,
  type MatchRecord,
} from '../lib/api';
import { useStore } from '../store';

type Tab = 'leaderboard' | 'profile' | 'matches';

export function AccountModal({ initialTab, onClose }: { initialTab: Tab; onClose: () => void }) {
  const authUser = useStore((s) => s.authUser);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [profile, setProfile] = useState<LeaderboardEntry | null>(null);
  const [matches, setMatches] = useState<MatchRecord[]>([]);

  useEffect(() => {
    void fetchLeaderboard().then(setBoard);
  }, []);
  useEffect(() => {
    if (authUser) {
      void fetchMyProfile().then(setProfile);
      void fetchMyMatches().then(setMatches);
    }
  }, [authUser]);

  const winRate = (e: LeaderboardEntry) => (e.games ? Math.round((e.wins / e.games) * 100) : 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex gap-2">
            {(['leaderboard', 'profile', 'matches'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-amber-glow text-ink-900' : 'bg-white/5 text-white/70'}`}
              >
                {t === 'leaderboard' ? '🏆 Sıralama' : t === 'profile' ? 'Profilim' : 'Maçlarım'}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        {tab === 'leaderboard' && (
          <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
            {board.length === 0 && <p className="text-sm text-white/40">Henüz sıralama yok. İlk olan sen ol!</p>}
            {board.map((e, i) => (
              <div key={e.uid} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2">
                <span className="w-6 text-center font-bold text-white/50">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{e.handle}</span>
                <span className="text-xs text-white/50">{e.wins}G {e.losses}M · %{winRate(e)}</span>
                <span className="w-12 text-right font-bold text-amber-glow">{e.rating}</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'profile' &&
          (!authUser ? (
            <p className="text-sm text-white/50">Profil için giriş yap.</p>
          ) : profile ? (
            <div className="grid grid-cols-2 gap-3 text-center">
              <Stat label="Puan (Elo)" value={profile.rating} />
              <Stat label="Galibiyet" value={profile.wins} />
              <Stat label="Mağlubiyet" value={profile.losses} />
              <Stat label="Kazanma %" value={profile.games ? Math.round((profile.wins / profile.games) * 100) : 0} />
              <Stat label="Mars+" value={profile.gammons} />
              <Stat label="En iyi seri" value={profile.bestStreak} />
            </div>
          ) : (
            <p className="text-sm text-white/40">Yükleniyor…</p>
          ))}

        {tab === 'matches' &&
          (!authUser ? (
            <p className="text-sm text-white/50">Maç geçmişi için giriş yap.</p>
          ) : (
            <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
              {matches.length === 0 && <p className="text-sm text-white/40">Henüz maç yok.</p>}
              {matches.map((m, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className={`font-bold ${m.won ? 'text-emerald-400' : 'text-rose-400'}`}>{m.won ? 'G' : 'M'}</span>
                  <span className="flex-1 truncate">vs {m.opponentName}</span>
                  <span className="tabular-nums text-white/60">
                    {m.myScore}–{m.opponentScore}
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 py-3">
      <div className="text-2xl font-black text-amber-glow">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
