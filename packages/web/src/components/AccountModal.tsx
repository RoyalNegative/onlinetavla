// Account hub: leaderboard, profile (editable handle), match history, friends
// (with presence + invite to play), and the daily tournament. The perks that
// reward registering.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameId } from '@tavla/engine';
import {
  addFriend as apiAddFriend,
  fetchFriendRequests,
  fetchFriends,
  fetchLeaderboard,
  fetchMyMatches,
  fetchMyProfile,
  fetchTournament,
  joinTournament,
  removeFriend as apiRemoveFriend,
  respondFriendRequest,
  updateHandle,
  type Friend,
  type FriendRequest,
  type LeaderboardEntry,
  type MatchRecord,
  type Tournament,
} from '../lib/api';
import { useStore } from '../store';

type Tab = 'leaderboard' | 'profile' | 'matches' | 'friends' | 'tournament';

const MEDALS = ['🥇', '🥈', '🥉'];

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
  const [me, setMe] = useState<(LeaderboardEntry & { rank: number | null }) | null>(null);

  useEffect(() => {
    void fetchLeaderboard().then(setBoard);
  }, []);
  useEffect(() => {
    if (authUser) void fetchMyProfile().then(setMe);
    else setMe(null);
  }, [authUser]);

  const winRate = (e: { wins: number; games: number }) => (e.games ? Math.round((e.wins / e.games) * 100) : 0);
  // Pin your own row below the top-50 board when you didn't make the cut, so
  // you can always see where you stand.
  const inBoard = board.some((e) => e.uid === authUser?.uid);

  // Keep the active tab visible even when the strip scrolls (e.g. opening
  // straight to a right-hand tab like Profilim on a narrow phone).
  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stripRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [tab]);

  // Portal to <body>: callers render this inside .card containers whose
  // backdrop-filter would otherwise trap the fixed overlay in their stacking
  // context (the modal appeared *behind* the cards below it).
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg overflow-hidden p-5" onClick={(e) => e.stopPropagation()}>
        {/* Title bar owns the ✕ so the tab strip below gets the full width and
            never wraps a lone tab; the strip scrolls sideways when it must. */}
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-white/80">Hesabım</span>
            <button onClick={onClose} className="text-white/50 hover:text-white" aria-label="Kapat">
              ✕
            </button>
          </div>
          <div ref={stripRef} className="scroll-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                data-active={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold ${tab === t.key ? 'bg-amber-glow text-ink-900' : 'bg-white/5 text-white/70'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'leaderboard' && (
          <div className="space-y-1">
            <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
              {board.length === 0 && <p className="text-sm text-white/40">Henüz sıralama yok. İlk olan sen ol!</p>}
              {board.map((e, i) => (
                <LeaderRow key={e.uid} rank={MEDALS[i] ?? String(i + 1)} entry={e} winRate={winRate} mine={e.uid === authUser?.uid} />
              ))}
            </div>
            {me && me.rank && !inBoard && board.length > 0 && (
              <>
                <div className="text-center text-xs text-white/25">···</div>
                <LeaderRow rank={String(me.rank)} entry={me} winRate={winRate} mine />
              </>
            )}
          </div>
        )}

        {tab === 'tournament' && <TournamentTab />}
        {tab === 'friends' && <FriendsTab authed={!!authUser} />}
        {tab === 'profile' && <ProfileTab authed={!!authUser} winRate={winRate} />}
        {tab === 'matches' && <MatchesTab authed={!!authUser} />}
      </div>
    </div>,
    document.body,
  );
}

function ProfileTab({ authed, winRate }: { authed: boolean; winRate: (e: { wins: number; games: number }) => number }) {
  const [profile, setProfile] = useState<(LeaderboardEntry & { rank: number | null }) | null>(null);
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
        {profile.rank != null && <Stat label="Sıra" value={profile.rank} prefix="#" />}
        <Stat label="Kazanma %" value={winRate(profile)} />
        <Stat label="Galibiyet" value={profile.wins} />
        <Stat label="Mağlubiyet" value={profile.losses} />
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
  const wins = matches.filter((m) => m.won).length;
  return (
    <div className="space-y-2">
      {matches.length > 0 && (
        <p className="text-xs text-white/40">
          Son {matches.length} maç · <span className="text-emerald-400">{wins}G</span>{' '}
          <span className="text-rose-400">{matches.length - wins}M</span>
        </p>
      )}
      <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
        {matches.length === 0 && <p className="text-sm text-white/40">Henüz maç yok.</p>}
        {matches.map((m, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span className={`shrink-0 font-bold ${m.won ? 'text-emerald-400' : 'text-rose-400'}`}>{m.won ? 'G' : 'M'}</span>
            <span className="w-10 shrink-0 text-xs text-white/40">{m.gameId === 'dama' ? 'Dama' : m.gameId === 'amiral' ? 'Amiral' : 'Tavla'}</span>
            <span className="min-w-0 flex-1 truncate">vs {m.opponentName}</span>
            <span className="shrink-0 tabular-nums text-white/60">{m.myScore}–{m.opponentScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FriendsTab({ authed }: { authed: boolean }) {
  const inviteFriend = useStore((s) => s.inviteFriend);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [handle, setHandle] = useState('');
  const [filter, setFilter] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [game, setGame] = useState<GameId>('tavla');

  const reload = () => {
    void fetchFriends().then(setFriends);
    void fetchFriendRequests().then(setRequests);
  };
  useEffect(() => {
    if (authed) reload();
  }, [authed]);

  if (!authed) return <p className="text-sm text-white/50">Arkadaş eklemek için giriş yap.</p>;

  // Online friends first, then alphabetical; filter by handle. Keeps a long list
  // usable — the people you can actually invite float to the top.
  const q = filter.trim().toLowerCase();
  const shown = friends
    .filter((f) => !q || f.handle.toLowerCase().includes(q))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.handle.localeCompare(b.handle));
  const onlineCount = friends.filter((f) => f.online).length;

  async function add() {
    setErr('');
    setSent(false);
    const res = await apiAddFriend(handle.trim());
    if (res.error) setErr(res.error === 'not_found' ? 'Bu adda oyuncu yok.' : res.error === 'self' ? 'Kendini ekleyemezsin.' : 'Eklenemedi.');
    else {
      setHandle('');
      if (res.requested) setSent(true);
      reload();
    }
  }

  async function respond(uid: string, accept: boolean) {
    await respondFriendRequest(uid, accept);
    reload();
  }

  return (
    <div className="space-y-3">
      {requests.length > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-glow/30 bg-amber-glow/[0.07] p-3">
          <p className="mb-1 text-xs font-semibold text-amber-glow">🔔 Arkadaşlık istekleri ({requests.length})</p>
          {requests.map((r) => (
            <div key={r.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <Avatar url={r.avatar} name={r.handle} className="h-7 w-7" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.handle}</span>
              <button
                className="shrink-0 rounded bg-emerald-500 px-2.5 py-1 text-xs font-bold text-ink-900 hover:brightness-110"
                onClick={() => respond(r.uid, true)}
              >
                ✓ Kabul
              </button>
              <button className="shrink-0 rounded bg-white/10 px-2.5 py-1 text-xs text-white/60 hover:text-rose-300" onClick={() => respond(r.uid, false)}>
                Reddet
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input className="input py-2" placeholder="oyuncu adı (handle)" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary px-3" onClick={add}>
          Ekle
        </button>
      </div>
      {err && <p className="text-xs text-rose-400">{err}</p>}
      {sent && <p className="text-xs text-emerald-400">✓ İstek gönderildi — kabul edince arkadaş listende görünecek.</p>}

      <div className="flex items-center gap-2 text-xs text-white/50">
        Davet oyunu:
        <button onClick={() => setGame('tavla')} className={`rounded px-2 py-0.5 ${game === 'tavla' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Tavla</button>
        <button onClick={() => setGame('dama')} className={`rounded px-2 py-0.5 ${game === 'dama' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Dama</button>
        <button onClick={() => setGame('amiral')} className={`rounded px-2 py-0.5 ${game === 'amiral' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Amiral</button>
      </div>

      {friends.length > 8 && (
        <input
          className="input py-2"
          placeholder="Arkadaş ara…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {friends.length > 0 && (
        <div className="flex items-center justify-between text-xs text-white/40">
          <span>
            {friends.length} arkadaş · <span className="text-emerald-400">{onlineCount} çevrimiçi</span>
          </span>
          {q && <span>{shown.length} sonuç</span>}
        </div>
      )}

      <div className="scroll-thin max-h-64 space-y-1 overflow-y-auto">
        {friends.length === 0 && <p className="text-sm text-white/40">Henüz arkadaş yok. Handle ile ekle.</p>}
        {friends.length > 0 && shown.length === 0 && <p className="text-sm text-white/40">Eşleşen arkadaş yok.</p>}
        {shown.map((f) => (
          <div key={f.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.online ? '#34d399' : '#6b7280' }} />
            <Avatar url={f.avatar} name={f.handle} className="h-7 w-7" />
            <span className="min-w-0 flex-1 truncate font-semibold">{f.handle}</span>
            <button className="shrink-0 rounded bg-amber-glow px-2 py-1 text-xs font-bold text-ink-900 disabled:opacity-40" disabled={!f.online} onClick={() => inviteFriend(f.uid, game)}>
              Çağır
            </button>
            <button className="shrink-0 text-white/40 hover:text-rose-400" onClick={async () => { await apiRemoveFriend(f.uid); reload(); }}>
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
  const [game, setGame] = useState<GameId>('tavla');
  const [data, setData] = useState<Tournament | null>(null);

  const reload = (g: GameId) => void fetchTournament(g).then(setData);
  useEffect(() => {
    reload(game);
  }, [game]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-white/50">
        <button onClick={() => setGame('tavla')} className={`rounded px-2 py-1 ${game === 'tavla' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Tavla</button>
        <button onClick={() => setGame('dama')} className={`rounded px-2 py-1 ${game === 'dama' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Dama</button>
        <button onClick={() => setGame('amiral')} className={`rounded px-2 py-1 ${game === 'amiral' ? 'bg-amber-glow text-ink-900' : 'bg-white/5'}`}>Amiral</button>
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
                <span className="w-7 shrink-0 text-center font-bold text-white/50">{MEDALS[i] ?? i + 1}</span>
                <Avatar url={s.avatar} name={s.handle} />
                <span className="min-w-0 flex-1 truncate font-semibold">{s.handle}</span>
                <span className="shrink-0 font-bold text-amber-glow">{s.points} puan</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Avatar({ url, name, className = 'h-7 w-7' }: { url: string | null; name: string; className?: string }) {
  if (url) return <img src={url} alt="" referrerPolicy="no-referrer" className={`${className} shrink-0 rounded-full object-cover`} />;
  return (
    <div className={`${className} grid shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/60`}>
      {([...name.trim()][0] ?? '?').toUpperCase()}
    </div>
  );
}

function LeaderRow({
  rank,
  entry,
  winRate,
  mine,
}: {
  rank: string;
  entry: LeaderboardEntry;
  winRate: (e: { wins: number; games: number }) => number;
  mine: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2 ${mine ? 'bg-amber-glow/15 ring-1 ring-amber-glow/40' : 'bg-white/5'}`}>
      <span className="w-7 shrink-0 text-center font-bold text-white/50">{rank}</span>
      <Avatar url={entry.avatar} name={entry.handle} />
      <span className="min-w-0 flex-1 truncate font-semibold">{entry.handle}</span>
      <span className="shrink-0 text-xs tabular-nums text-white/50">{entry.wins}G {entry.losses}M · %{winRate(entry)}</span>
      <span className="w-12 shrink-0 text-right font-bold text-amber-glow">{entry.rating}</span>
    </div>
  );
}

function Stat({ label, value, prefix }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="rounded-xl bg-white/5 py-3">
      <div className="text-2xl font-black text-amber-glow">
        {prefix}
        {value}
      </div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
