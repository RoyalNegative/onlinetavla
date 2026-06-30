// Account hub: leaderboard, profile (editable handle), match history, friends
// (with presence + invite to play), and the daily tournament. The perks that
// reward registering.

import { useEffect, useState } from 'react';
import {
  addFriend as apiAddFriend,
  fetchFriends,
  fetchLeaderboard,
  fetchMyMatches,
  fetchMyProfile,
  fetchTournament,
  joinTournament,
  removeFriend as apiRemoveFriend,
  updateHandle,
  type Friend,
  type LeaderboardEntry,
  type MatchRecord,
  type Tournament,
} from '../lib/api';
import { useStore } from '../store';

type Tab = 'leaderboard' | 'profile' | 'matches' | 'friends' | 'tournament';

const TABS: { key: Tab; label: string }[] = [
  { key: 'leaderboard', label: '🏆 Sıralama' },
  { key: 'tournament', label: '🎪 Turnuva' },
  { key: 'friends', label: '👥 Arkadaşlar' },
  { key: 'profile', label: 'Profilim' },
  { key: 'matches', label: 'Maçlarım' },
];

export function AccountModal({ initialTab, onClose }: { initialTab: Tab; onClose: () => void }) {
  const authUser = useStore((s) => s.authUser);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    void fetchLeaderboard().then(setBoard);
  }, []);

  const winRate = (e: { wins: number; games: number }) => (e.games ? Math.round((e.wins / e.games) * 100) : 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-amber-glow text-ink-900' : 'bg-white/5 text-white/70'}`}
              >
                {t.label}
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

        {tab === 'tournament' && <TournamentTab />}
        {tab === 'friends' && <FriendsTab authed={!!authUser} />}
        {tab === 'profile' && <ProfileTab authed={!!authUser} winRate={winRate} />}
        {tab === 'matches' && <MatchesTab authed={!!authUser} />}
      </div>
    </div>
  );
}

function ProfileTab({ authed, winRate }: { authed: boolean; winRate: (e: { wins: number; games: number }) => number }) {
  const [profile, setProfile] = useState<LeaderboardEntry | null>(null);
  const [handle, setHandle] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (authed)
      void fetchMyProfile().then((p) => {
        setProfile(p);
        if (p) setHandle(p.handle);
      });
  }, [authed]);

  if (!authed) return <p className="text-sm text-white/50">Profil için giriş yap.</p>;
  if (!profile) return <p className="text-sm text-white/40">Yükleniyor…</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="Puan (Elo)" value={profile.rating} />
        <Stat label="Galibiyet" value={profile.wins} />
        <Stat label="Mağlubiyet" value={profile.losses} />
        <Stat label="Kazanma %" value={winRate(profile)} />
        <Stat label="Toplam mars" value={profile.gammons} />
        <Stat label="En iyi seri" value={profile.bestStreak} />
      </div>
      <div>
        <label className="mb-1 block text-xs text-white/50">Görünen ad (handle)</label>
        <div className="flex gap-2">
          <input className="input py-2" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value)} />
          <button
            className="btn-primary px-3"
            onClick={async () => {
              await updateHandle(handle.trim());
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          >
            {saved ? '✓' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchesTab({ authed }: { authed: boolean }) {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  useEffect(() => {
    if (authed) void fetchMyMatches().then(setMatches);
  }, [authed]);
  if (!authed) return <p className="text-sm text-white/50">Maç geçmişi için giriş yap.</p>;
  return (
    <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
      {matches.length === 0 && <p className="text-sm text-white/40">Henüz maç yok.</p>}
      {matches.map((m, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
          <span className={`font-bold ${m.won ? 'text-emerald-400' : 'text-rose-400'}`}>{m.won ? 'G' : 'M'}</span>
          <span className="w-10 text-xs text-white/40">{m.gameId === 'dama' ? 'Dama' : 'Tavla'}</span>
          <span className="flex-1 truncate">vs {m.opponentName}</span>
          <span className="tabular-nums text-white/60">{m.myScore}–{m.opponentScore}</span>
        </div>
      ))}
    </div>
  );
}

function FriendsTab({ authed }: { authed: boolean }) {
  const inviteFriend = useStore((s) => s.inviteFriend);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [handle, setHandle] = useState('');
  const [err, setErr] = useState('');
  const [game, setGame] = useState<'tavla' | 'dama'>('tavla');

  const reload = () => void fetchFriends().then(setFriends);
  useEffect(() => {
    if (authed) reload();
  }, [authed]);

  if (!authed) return <p className="text-sm text-white/50">Arkadaş eklemek için giriş yap.</p>;

  async function add() {
    setErr('');
    const res = await apiAddFriend(handle.trim());
    if (res.error) setErr(res.error === 'not_found' ? 'Bu adda oyuncu yok.' : res.error === 'self' ? 'Kendini ekleyemezsin.' : 'Eklenemedi.');
    else {
      setHandle('');
      reload();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="input py-2" placeholder="oyuncu adı (handle)" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary px-3" onClick={add}>
          Ekle
        </button>
      </div>
      {err && <p className="text-xs text-rose-400">{err}</p>}

      <div className="flex items-center gap-2 text-xs text-white/50">
        Davet oyunu:
        <button onClick={() => setGame('tavla')} className={`rounded px-2 py-0.5 ${game === 'tavla' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Tavla</button>
        <button onClick={() => setGame('dama')} className={`rounded px-2 py-0.5 ${game === 'dama' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Dama</button>
      </div>

      <div className="scroll-thin max-h-64 space-y-1 overflow-y-auto">
        {friends.length === 0 && <p className="text-sm text-white/40">Henüz arkadaş yok. Handle ile ekle.</p>}
        {friends.map((f) => (
          <div key={f.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.online ? '#34d399' : '#6b7280' }} />
            <span className="flex-1 truncate font-semibold">{f.handle}</span>
            <button className="rounded bg-amber-glow px-2 py-1 text-xs font-bold text-ink-900 disabled:opacity-40" disabled={!f.online} onClick={() => inviteFriend(f.uid, game)}>
              Çağır
            </button>
            <button className="text-white/40 hover:text-rose-400" onClick={async () => { await apiRemoveFriend(f.uid); reload(); }}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TournamentTab() {
  const authUser = useStore((s) => s.authUser);
  const [game, setGame] = useState<'tavla' | 'dama'>('tavla');
  const [data, setData] = useState<Tournament | null>(null);

  const reload = (g: 'tavla' | 'dama') => void fetchTournament(g).then(setData);
  useEffect(() => {
    reload(game);
  }, [game]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-white/50">
        <button onClick={() => setGame('tavla')} className={`rounded px-2 py-1 ${game === 'tavla' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Tavla</button>
        <button onClick={() => setGame('dama')} className={`rounded px-2 py-1 ${game === 'dama' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Dama</button>
      </div>

      {data && (
        <>
          <div className="rounded-xl bg-white/5 p-3 text-center">
            <p className="font-bold">{data.meta.name}</p>
            <p className="text-xs text-white/50">Bugün kazandığın her maç +1 puan</p>
            {authUser && !data.joined && (
              <button className="btn-primary mt-2 w-full" onClick={async () => { await joinTournament(game); reload(game); }}>
                Turnuvaya katıl
              </button>
            )}
            {data.joined && <p className="mt-2 text-sm text-emerald-400">✓ Katıldın — maçların sayılıyor</p>}
            {!authUser && <p className="mt-2 text-xs text-amber-glow/80">Katılmak için giriş yap.</p>}
          </div>

          <div className="scroll-thin max-h-60 space-y-1 overflow-y-auto">
            {data.standings.length === 0 && <p className="text-sm text-white/40">Henüz katılan yok.</p>}
            {data.standings.map((s, i) => (
              <div key={s.uid} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${s.uid === authUser?.uid ? 'bg-amber-glow/15 ring-1 ring-amber-glow/40' : 'bg-white/5'}`}>
                <span className="w-6 text-center font-bold text-white/50">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{s.handle}</span>
                <span className="font-bold text-amber-glow">{s.points} puan</span>
              </div>
            ))}
          </div>
        </>
      )}
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
