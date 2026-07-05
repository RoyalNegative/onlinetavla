import { useEffect, useState } from 'react';
import type { GameId } from '@tavla/engine';
import { AccountModal } from '../components/AccountModal';
import { Die } from '../components/Die';
import { Header } from '../components/Header';
import { fetchFriendRequests, fetchFriends, fetchTournament, joinTournament, type Friend, type Tournament } from '../lib/api';
import { navigate } from '../router';
import { useStore } from '../store';

const TARGETS = [1, 3, 5, 7];

// The hub's game catalog — adding a game here (plus its GameModule) is all the
// home screen needs. `kind` splits the picker: head-to-head duels vs party
// games you gather a crew for.
const GAMES: { id: GameId; kind: 'duel' | 'party'; icon: string; title: string; sub: string; hero: string; desc: string; how: string }[] = [
  {
    id: 'tavla',
    kind: 'duel',
    icon: '🎲',
    title: 'Tavla',
    sub: 'backgammon',
    hero: 'tavla',
    desc: 'Kahvehane klasiği: zar at, pullarını yürüt, önce toplayan kazanır.',
    how: 'Zarları at, taşlarını rakip yönünün tersine yürüt; önce toplayan kazanır. Mars 2 katı yazar.',
  },
  {
    id: 'dama',
    kind: 'duel',
    icon: '⛀',
    title: 'Dama',
    sub: 'Türk daması',
    hero: 'dama',
    desc: '8x8 tahtada taş yeme oyunu; rakibin tüm taşlarını yiyen kazanır.',
    how: 'Taşlar ileri ve yana gider, yeme zorunludur. Son sıraya ulaşan taş dama olur (her yöne uçar).',
  },
  {
    id: 'amiral',
    kind: 'duel',
    icon: '🚢',
    title: 'Amiral Battı',
    sub: 'deniz savaşı',
    hero: 'amiral battı',
    desc: 'Okul sıralarının kâğıt-kalem oyunu: gemileri sakla, tahmin et, batır.',
    how: 'Filonu gizlice yerleştir, sırayla koordinat söyleyip ateş et. İsabette bir atış daha kazanırsın; rakibin beş gemisini de ilk batıran kazanır.',
  },
  {
    id: 'mangala',
    kind: 'duel',
    icon: '🪨',
    title: 'Mangala',
    sub: 'Türk zekâ oyunu',
    hero: 'mangala',
    desc: 'Asırlık Türk strateji oyunu: kuyulardan taş dağıt, haznende biriktir.',
    how: 'Herkesin 6 kuyusu ve 1 haznesi var; kuyundaki taşları alıp sırayla dağıtırsın. Son taş haznene düşerse bir hamle daha oynarsın, rakip kuyusundaki taşları çift sayıya tamamlarsan hepsini kaparsın. Oyun sonunda haznesinde çok taş olan kazanır.',
  },
  {
    id: 'dortlu',
    kind: 'duel',
    icon: '🔴',
    title: "4'ü Bağla",
    sub: 'dörtlü sıra',
    hero: "4'ü bağla",
    desc: 'Connect Four: pulları sütunlara bırak, yan yana 4 yapan kazanır.',
    how: 'Sırayla bir sütun seçersin, pulun en alttaki boş göze düşer. Yatay, dikey veya çapraz fark etmez — kendi renginden 4 pulu ilk hizalayan kazanır. Basit görünür, iki dakikada öğrenilir.',
  },
  {
    id: 'secrethitler',
    kind: 'party',
    icon: '🕵️',
    title: 'Secret Hitler',
    sub: '5-10 kişi · ekipçe',
    hero: 'Secret Hitler',
    desc: 'Sosyal blöf oyunu: liberaller Hitler’i arıyor, faşistler gizlice sızıyor.',
    how: 'Oda kur, linki ekibe gönder (5-10 kişi). Her tur bir başkan şansölye aday gösterir, herkes JA/NEIN oylar; seçilen hükûmet gizli politika kartı koyar. Liberaller 5 liberal politikayla ya da Hitler’i infazla kazanır; faşistler 6 faşist politikayla ya da Hitler’i şansölye seçtirerek.',
  },
];

export function Home() {
  const nickname = useStore((s) => s.nickname);
  const setNickname = useStore((s) => s.setNickname);
  const createRoom = useStore((s) => s.createRoom);
  const accountsEnabled = useStore((s) => s.accountsEnabled);
  const authUser = useStore((s) => s.authUser);
  const matchmaking = useStore((s) => s.matchmaking);
  const findMatch = useStore((s) => s.findMatch);
  const cancelMatch = useStore((s) => s.cancelMatch);
  const hasName = nickname.trim().length > 0;

  const [game, setGame] = useState<GameId>('tavla');
  const [picked, setPicked] = useState(false); // step 1: pick a game → step 2: set it up
  const [mode, setMode] = useState<'classic' | 'backgammon'>('classic');
  const [amiralKolay, setAmiralKolay] = useState(true);
  const meta = GAMES.find((g) => g.id === game)!;
  const [target, setTarget] = useState(5);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    await createRoom({
      gameId: game,
      mode,
      targetPoints: target,
      noTouch: game === 'amiral' ? amiralKolay : undefined,
    });
    setBusy(false);
  }

  function join() {
    const code = joinCode.trim().split('/').pop()?.toLowerCase() ?? '';
    if (code) navigate(`/r/${code}`);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col lg:max-w-6xl">
      <Header />

      <main className="flex-1 px-4 pb-12 sm:px-6">
        {/* ---- Hero: the game's own dice, then the claim ---- */}
        <section className="pb-6 pt-6 text-center sm:pt-10">
          <div className="mb-4 flex items-end justify-center gap-2" aria-hidden>
            <div className="-rotate-12"><Die value={5} size={40} /></div>
            <div className="translate-y-0.5 rotate-6"><Die value={3} size={32} /></div>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Arkadaşınla <span className="text-amber-glow">{picked ? meta.hero : 'oyna'}</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-white/60">
            Oyununu seç, oda kur, linki paylaş — saniyeler içinde oyna. Ücretsiz, reklamsız, üyelik gerekmez.
          </p>
        </section>

        {/* On wide screens friends + the daily tournament move to a right rail;
            the main column keeps the start flow. Phones stack as before. */}
        <div className={accountsEnabled ? 'grid gap-x-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start' : undefined}>
          {accountsEnabled && authUser && (
            <div className="mt-6 lg:col-start-2 lg:row-start-1 lg:mt-0">
              <FriendsStrip game={game} />
            </div>
          )}

          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-3">
            {/* ---- Signature: a sliver of the board itself ---- */}
            <BoardStrip />

        {/* ---- The one card that starts a game: pick → set up ---- */}
        {!picked ? (
          <div className="card mt-6 space-y-4 p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white/70">Oyununu seç</span>
              <span className="text-[11px] text-white/35">1/2</span>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/35">⚔️ İki kişilik</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GAMES.filter((g) => g.kind === 'duel').map((g) => (
                  <GamePick key={g.id} g={g} onPick={() => { setGame(g.id); setPicked(true); }} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/35">🎉 Toplu oyun — ekibini topla</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GAMES.filter((g) => g.kind === 'party').map((g) => (
                  <GamePick key={g.id} g={g} onPick={() => { setGame(g.id); setPicked(true); }} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card mt-6 space-y-5 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl leading-none">{meta.icon}</span>
                <div>
                  <div className="font-bold leading-tight">{meta.title}</div>
                  <div className="text-[11px] text-white/40">{meta.sub}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-white/35">2/2</span>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setPicked(false)}>
                  ← Oyun değiştir
                </button>
              </div>
            </div>

            {game === 'tavla' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-white/70">Kurallar</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle active={mode === 'classic'} onClick={() => setMode('classic')} title="Klasik" sub="çift zar yok" />
                    <Toggle active={mode === 'backgammon'} onClick={() => setMode('backgammon')} title="Çift zarlı" sub="doubling cube" />
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-white/70">Kaç sayıya? (raund)</span>
                  <div className="grid grid-cols-4 gap-2">
                    {TARGETS.map((t) => (
                      <Toggle key={t} active={target === t} onClick={() => setTarget(t)} title={`${t}`} sub={t === 1 ? 'tek oyun' : 'sayıya'} />
                    ))}
                  </div>
                </div>
              </div>
            ) : game === 'amiral' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-white/70">Zorluk</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle active={amiralKolay} onClick={() => setAmiralKolay(true)} title="Kolay" sub="batan geminin çevresi açılır" />
                    <Toggle active={!amiralKolay} onClick={() => setAmiralKolay(false)} title="Zor" sub="gemiler bitişik olabilir" />
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-white/70">Nasıl oynanır?</span>
                  <p className="rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/50">{meta.how}</p>
                </div>
              </div>
            ) : (
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-white/70">Nasıl oynanır?</span>
                <p className="rounded-xl bg-white/5 px-3 py-2.5 text-xs leading-relaxed text-white/50">{meta.how}</p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-white/70">Takma adın</label>
              <input
                className="input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="ör. Kaan"
                maxLength={20}
              />
            </div>

            {matchmaking ? (
              <div className="rounded-xl bg-white/5 p-4 text-center">
                <p className="animate-pulse text-sm font-semibold text-amber-glow">🎯 Rakip aranıyor…</p>
                <button className="btn-ghost mt-3 w-full" onClick={cancelMatch}>
                  İptal
                </button>
              </div>
            ) : game === 'secrethitler' ? (
              // Lobby game: no 1v1 matchmaking — you gather your own crew.
              <button className="btn-primary w-full py-3" onClick={create} disabled={busy || !hasName}>
                {busy ? 'Oluşturuluyor…' : '▸ Lobi kur, ekibi topla (5-10 kişi)'}
              </button>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="btn-primary py-3" onClick={create} disabled={busy || !hasName}>
                  {busy ? 'Oluşturuluyor…' : '▸ Oda kur ve başla'}
                </button>
                <button className="btn-ghost py-3" onClick={() => findMatch(game)} disabled={!hasName}>
                  🎯 Rakip bul
                </button>
              </div>
            )}
            {!hasName && <p className="text-center text-xs text-white/40">Başlamak için bir takma ad yeter — üyelik gerekmez.</p>}
          </div>
        )}

        {/* ---- Secondary: got an invite? ---- */}
        <div className="card mt-3 flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <p className="shrink-0 text-sm font-semibold text-white/70 sm:w-40">Davet linkin mi var?</p>
          <input
            className="input py-2.5"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="oda kodu veya link yapıştır"
            onKeyDown={(e) => e.key === 'Enter' && join()}
          />
          <button className="btn-ghost shrink-0 px-5 py-2.5" onClick={join} disabled={!joinCode.trim()}>
            Katıl
          </button>
        </div>

            <div className="mt-6 text-center">
              <button className="btn-ghost mx-auto text-sm" onClick={() => navigate('/pratik')}>
                🎓 Yeni misin? Bota karşı pratik yap & öğren
              </button>
              {accountsEnabled && !authUser && (
                <p className="mt-3 text-xs text-white/40">
                  İstersen <b className="text-amber-glow/80">giriş yap</b> — Elo puanın, istatistiklerin ve sıralaman kaydedilsin.
                </p>
              )}
            </div>
          </div>

          {accountsEnabled && (
            <div className="mt-3 lg:col-start-2 lg:row-start-2 lg:mt-4">
              <TournamentCard game={game} authed={!!authUser} />
            </div>
          )}
        </div>

        <footer className="mt-12 border-t border-white/10 pt-5 text-center text-xs leading-relaxed text-white/35">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            <li className="whitespace-nowrap">🎲 Zarları sunucu atar — hile yok</li>
            <li className="whitespace-nowrap">💬 Oyun içi sohbet & emoji</li>
            <li className="whitespace-nowrap">🔁 Tek tıkla rövanş</li>
          </ul>
          <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            <a href="/nasil-oynanir" className="whitespace-nowrap hover:text-amber-glow">
              Tavla nasıl oynanır?
            </a>
            <a href="/pratik" className="whitespace-nowrap hover:text-amber-glow">
              Bota karşı pratik
            </a>
          </nav>
          <p className="mt-3">Ücretsiz, üyeliksiz online tavla, dama, amiral battı, mangala ve 4'ü bağla — OnlineTavla</p>
        </footer>
      </main>
    </div>
  );
}

// A sliver of the real board — felt, wood and cream points, straight from the
// game's palette. The one decorative element on the page.
function BoardStrip() {
  const W = 720;
  const H = 36;
  const n = 18;
  const cw = W / n;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-6 w-full rounded-lg opacity-80 ring-1 ring-white/10 sm:h-7"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect width={W} height={H} fill="#155b44" />
      {Array.from({ length: n }, (_, i) => {
        const x = i * cw;
        const down = i % 2 === 0;
        const fill = down ? '#e9dcc0' : '#9c5a32';
        const points = down
          ? `${x + 4},0 ${x + cw - 4},0 ${x + cw / 2},${H - 5}`
          : `${x + 4},${H} ${x + cw - 4},${H} ${x + cw / 2},5`;
        return <polygon key={i} points={points} fill={fill} opacity="0.85" />;
      })}
    </svg>
  );
}

function GamePick({ g, onPick }: { g: (typeof GAMES)[number]; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="group flex items-start gap-3 rounded-xl bg-white/5 px-3.5 py-3 text-left transition hover:bg-amber-glow hover:text-ink-900"
    >
      <div className="mt-0.5 text-3xl leading-none">{g.icon}</div>
      <div className="min-w-0">
        <div className="font-bold leading-tight">
          {g.title} <span className="text-[11px] font-normal text-white/40 group-hover:text-ink-900/60">· {g.sub}</span>
        </div>
        <div className="mt-1 text-xs leading-snug text-white/45 group-hover:text-ink-900/75">{g.desc}</div>
      </div>
    </button>
  );
}

function Toggle({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-2.5 text-center transition ${active ? 'bg-amber-glow text-ink-900' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
    >
      <div className="font-bold leading-tight">{title}</div>
      <div className={`text-[11px] ${active ? 'text-ink-900/70' : 'text-white/40'}`}>{sub}</div>
    </button>
  );
}

// Online friends, one tap from the home screen — no digging through the modal.
// Refreshes presence every 30s while visible.
function FriendsStrip({ game }: { game: GameId }) {
  const inviteFriend = useStore((s) => s.inviteFriend);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [reqCount, setReqCount] = useState(0);
  const [modal, setModal] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  useEffect(() => {
    const load = () => {
      void fetchFriends().then(setFriends);
      void fetchFriendRequests().then((r) => setReqCount(r.length));
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [modal]);

  const online = friends.filter((f) => f.online);

  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">👥 Arkadaşların {online.length > 0 && <span className="text-emerald-400">· {online.length} çevrimiçi</span>}</p>
        <button className="text-xs text-amber-glow hover:underline" onClick={() => setModal(true)}>
          {reqCount > 0 ? (
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-bold text-rose-300">🔔 {reqCount} istek</span>
          ) : friends.length === 0 ? (
            '+ Arkadaş ekle'
          ) : (
            'Tümü / ekle'
          )}
        </button>
      </div>
      {friends.length === 0 ? (
        <p className="text-xs text-white/40">Arkadaş ekle; çevrimiçi olunca buradan tek dokunuşla oyuna çağır.</p>
      ) : (
        <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {[...online, ...friends.filter((f) => !f.online)].map((f) => (
            <div key={f.uid} className="flex shrink-0 items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.online ? '#34d399' : '#6b7280' }} />
              <span className="max-w-[110px] truncate text-sm font-semibold">{f.handle}</span>
              {f.online && (
                <button
                  className="rounded-lg bg-amber-glow px-2.5 py-1.5 text-xs font-bold text-ink-900 disabled:opacity-40"
                  disabled={inviting === f.uid}
                  onClick={async () => {
                    setInviting(f.uid);
                    await inviteFriend(f.uid, game);
                    setInviting(null);
                  }}
                >
                  {inviting === f.uid ? '…' : 'Çağır'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {modal && <AccountModal initialTab="friends" onClose={() => setModal(false)} />}
    </div>
  );
}

// Daily tournament for the selected game, with its live top-5 — a proper card
// so the wide-screen right rail has something worth looking at.
function TournamentCard({ game, authed }: { game: GameId; authed: boolean }) {
  const [t, setT] = useState<Tournament | null>(null);
  useEffect(() => {
    void fetchTournament(game).then(setT);
  }, [game]);
  if (!t) return null;
  const top = t.standings.slice(0, 5);
  return (
    <div className="rounded-2xl border border-amber-glow/25 bg-amber-glow/[0.07] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-amber-glow/90">🎪 {t.meta.name}</p>
        {t.joined ? (
          <span className="shrink-0 text-xs font-semibold text-emerald-400">✓ Katıldın</span>
        ) : authed ? (
          <button
            className="btn-primary shrink-0 px-3 py-1.5 text-xs"
            onClick={async () => {
              await joinTournament(game);
              void fetchTournament(game).then(setT);
            }}
          >
            Katıl
          </button>
        ) : (
          <span className="shrink-0 text-xs text-white/50">Giriş yap</span>
        )}
      </div>
      <p className="mt-1 text-xs text-white/50">Bugün kazandığın her maç +1 puan · {t.standings.length} katılımcı</p>

      <div className="mt-3 space-y-1">
        {top.length === 0 ? (
          <p className="text-xs text-white/40">Henüz katılan yok — günün ilk şampiyonu sen ol! 🏁</p>
        ) : (
          top.map((s, i) => (
            <div key={s.uid} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 text-sm">
              <span className="w-5 text-center text-xs font-bold text-white/40">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{s.handle}</span>
              <span className="shrink-0 text-xs font-bold text-amber-glow">{s.points} puan</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
