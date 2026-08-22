import { useEffect, useRef, useState } from 'react';
import type { GameId } from '@tavla/engine';
import { ArrowLeft, ArrowRight, Bell, Check, GraduationCap, Plus, Target, Trophy, Users } from 'lucide-react';
import { AccountModal } from '../components/AccountModalLazy';
import { GameGlyph } from '../components/GameGlyph';
import { Header } from '../components/Header';
import { fetchFriends, fetchTournament, joinTournament, type Friend, type Tournament } from '../lib/api';
import { cn } from '../lib/cn';
import { GAME_META } from '../lib/games';
import { navigate } from '../router';
import { useStore } from '../store';

// Last game + settings, so returning players get a one-tap "hemen oyna" row.
interface QuickStart {
  gameId: GameId;
  mode: 'classic' | 'backgammon';
  targetPoints: number;
  noTouch?: boolean;
}
const QUICK_KEY = 'tavla.quickstart';
function loadQuick(): QuickStart | null {
  try {
    const raw = localStorage.getItem(QUICK_KEY);
    return raw ? (JSON.parse(raw) as QuickStart) : null;
  } catch {
    return null;
  }
}

const TARGETS = [1, 3, 5, 7];

// The hub's game catalog — adding a game here (plus its GameModule and a mark
// in <GameGlyph>) is all the home screen needs. Title / subtitle / accent live
// in GAME_META so the room screen shows the same identity. `kind` splits the
// picker: head-to-head duels vs party games you gather a crew for.
const GAMES: { id: GameId; kind: 'duel' | 'party'; hero: string; desc: string; how: string }[] = [
  {
    id: 'tavla',
    kind: 'duel',
    hero: 'tavla',
    desc: 'Kahvehane klasiği: zar at, pullarını yürüt, önce toplayan kazanır.',
    how: 'Zarları at, taşlarını rakip yönünün tersine yürüt; önce toplayan kazanır. Mars 2 katı yazar.',
  },
  {
    id: 'dama',
    kind: 'duel',
    hero: 'dama',
    desc: '8x8 tahtada taş yeme oyunu; rakibin tüm taşlarını yiyen kazanır.',
    how: 'Taşlar ileri ve yana gider, yeme zorunludur. Son sıraya ulaşan taş dama olur (her yöne uçar).',
  },
  {
    id: 'amiral',
    kind: 'duel',
    hero: 'amiral battı',
    desc: 'Okul sıralarının kâğıt-kalem oyunu: gemileri sakla, tahmin et, batır.',
    how: 'Filonu gizlice yerleştir, sırayla koordinat söyleyip ateş et. İsabette bir atış daha kazanırsın; rakibin beş gemisini de ilk batıran kazanır.',
  },
  {
    id: 'mangala',
    kind: 'duel',
    hero: 'mangala',
    desc: 'Asırlık Türk strateji oyunu: kuyulardan taş dağıt, haznende biriktir.',
    how: 'Herkesin 6 kuyusu ve 1 haznesi var; kuyundaki taşları alıp sırayla dağıtırsın. Son taş haznene düşerse bir hamle daha oynarsın, rakip kuyusundaki taşları çift sayıya tamamlarsan hepsini kaparsın. Oyun sonunda haznesinde çok taş olan kazanır.',
  },
  {
    id: 'dortlu',
    kind: 'duel',
    hero: "4'ü bağla",
    desc: 'Connect Four: pulları sütunlara bırak, yan yana 4 yapan kazanır.',
    how: 'Sırayla bir sütun seçersin, pulun en alttaki boş göze düşer. Yatay, dikey veya çapraz fark etmez — kendi renginden 4 pulu ilk hizalayan kazanır. Basit görünür, iki dakikada öğrenilir.',
  },
  {
    id: 'satranc',
    kind: 'duel',
    hero: 'satranç',
    desc: 'Oyunların kralı: şah-mat edene kadar taşlarını kur, rakibini köşeye sıkıştır.',
    how: 'Beyaz başlar; her taş kendi kuralınca gider. Rok, geçerken alma ve piyon terfisi dâhil tüm kurallar geçerli. Rakip kralı kaçamayacak şekilde tehdit edilince (şah-mat) oyun biter; hamlesi kalmayan ama şah da olmayan taraf pata düşer (berabere).',
  },
  {
    id: 'secrethitler',
    kind: 'party',
    hero: 'Secret Hitler',
    desc: 'Sosyal blöf oyunu: liberaller Hitler’i arıyor, faşistler gizlice sızıyor.',
    how: 'Oda kur, linki ekibe gönder (5-10 kişi). Her tur bir başkan şansölye aday gösterir, herkes JA/NEIN oylar; seçilen hükûmet gizli politika kartı koyar. Liberaller 5 liberal politikayla ya da Hitler’i infazla kazanır; faşistler 6 faşist politikayla ya da Hitler’i şansölye seçtirerek.',
  },
];

const DUELS = GAMES.filter((g) => g.kind === 'duel');
const PARTY = GAMES.filter((g) => g.kind === 'party');

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
  const [quick] = useState<QuickStart | null>(loadQuick);
  const nameRef = useRef<HTMLInputElement>(null);
  const [nameFlash, setNameFlash] = useState(false);

  // Instead of a mysteriously-disabled button: jump to the name field and
  // flash it, so the "why can't I click" is answered by the UI itself.
  function requireName(): boolean {
    if (hasName) return true;
    setNameFlash(true);
    nameRef.current?.focus();
    nameRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setTimeout(() => setNameFlash(false), 1200);
    return false;
  }

  function saveQuick(opts: QuickStart) {
    localStorage.setItem(QUICK_KEY, JSON.stringify(opts));
  }

  async function create() {
    if (!requireName()) return;
    setBusy(true);
    const opts: QuickStart = {
      gameId: game,
      mode,
      targetPoints: target,
      noTouch: game === 'amiral' ? amiralKolay : undefined,
    };
    saveQuick(opts);
    await createRoom(opts);
    setBusy(false);
  }

  async function quickCreate() {
    if (!quick) return;
    setBusy(true);
    await createRoom(quick);
    setBusy(false);
  }

  function find() {
    if (!requireName()) return;
    saveQuick({
      gameId: game,
      mode,
      targetPoints: target,
      noTouch: game === 'amiral' ? amiralKolay : undefined,
    });
    void findMatch(game);
  }

  function join() {
    const code = joinCode.trim().split('/').pop()?.toLowerCase() ?? '';
    if (code) navigate(`/r/${code}`);
  }

  const heroTint = picked ? GAME_META[game].tint : '#e0603a';

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="relative mx-auto w-full max-w-6xl flex-1 px-5 pb-16 sm:px-8">
        {/* A single slow-drifting wash in the selected game's accent. It's the
            only thing behind the type, and it re-tints as you pick — the page
            reacts to your choice without any layout moving. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-[440px] animate-drift blur-[90px] transition-colors duration-700"
          style={{
            background: `radial-gradient(46% 52% at 22% 40%, ${heroTint}2e, transparent 70%)`,
          }}
        />

        {/* ---- Hero ---- */}
        <section className="relative pb-7 pt-8 sm:pb-10 sm:pt-12">
          <div className="mb-5 flex items-center gap-3">
            <span className="eyebrow">Ücretsiz · Üyeliksiz · Reklamsız</span>
            <span className="rule" />
          </div>

          <h1 className="font-display text-display-sm text-cream sm:text-display lg:text-display-lg">
            Arkadaşınla
            <br />
            <span
              key={picked ? game : 'default'}
              className="inline-block animate-swap-in text-accent"
              style={picked ? { color: GAME_META[game].tint } : undefined}
            >
              {picked ? meta.hero : 'oyna'}.
            </span>
          </h1>

          <p className="mt-5 max-w-[30ch] text-[15px] leading-relaxed text-cream/55">
            Oda kur, linki paylaş, saniyeler içinde başla. Kurulum yok, kayıt yok.
          </p>
        </section>

        <div
          className={cn(
            'relative grid gap-x-12 gap-y-8',
            accountsEnabled && 'lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start',
          )}
        >
          <div className="min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-3">
            {/* ---- Returning player: one tap back into your usual game ---- */}
            {!picked && quick && hasName && GAME_META[quick.gameId] && (
              <div
                className="mb-8 flex animate-rise-in flex-col gap-4 border-l-2 py-1 pl-4 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: GAME_META[quick.gameId].tint }}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <GameGlyph id={quick.gameId} size={28} className="shrink-0 text-cream/70" />
                  <div className="min-w-0">
                    <p className="eyebrow mb-1">Kaldığın yerden</p>
                    <p className="truncate text-[15px] font-semibold text-cream">
                      {GAME_META[quick.gameId].title}
                      {quick.gameId === 'tavla' && (
                        <span className="font-normal text-cream/40">
                          {' · '}
                          {quick.mode === 'backgammon' ? 'çift zarlı' : 'klasik'} · {quick.targetPoints} sayıya
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="btn-primary" onClick={quickCreate} disabled={busy}>
                    {busy ? 'Oluşturuluyor…' : 'Hemen oda kur'}
                    {!busy && <ArrowRight size={15} />}
                  </button>
                  {quick.gameId !== 'secrethitler' && (
                    <button className="btn-ghost" onClick={() => findMatch(quick.gameId)} disabled={matchmaking}>
                      <Target size={15} /> Rakip bul
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* `key` forces a remount when the step changes, which replays the
                entrance animation — the same read as a crossfade, no runtime. */}
            {!picked ? (
                <div key="pick" className="animate-rise-in">
                  <SectionRule label="İki kişilik" meta={`${DUELS.length} oyun`} />
                  <div className="grid grid-cols-1 border-t border-cream/[0.07] sm:grid-cols-2 sm:gap-x-10">
                    {DUELS.map((g, i) => (
                      <GamePick key={g.id} g={g} index={i} onPick={() => { setGame(g.id); setPicked(true); }} />
                    ))}
                  </div>

                  <SectionRule label="Toplu oyun" meta="ekibini topla" className="mt-12" />
                  <div className="grid grid-cols-1 border-t border-cream/[0.07] sm:grid-cols-2 sm:gap-x-10">
                    {PARTY.map((g, i) => (
                      <GamePick key={g.id} g={g} index={i} onPick={() => { setGame(g.id); setPicked(true); }} />
                    ))}
                  </div>
                </div>
              ) : (
                <div key="setup" className="max-w-2xl animate-rise-in space-y-8">
                  {/* Game header — the mark is big here; it's the confirmation
                      that you picked the right thing. */}
                  <div className="flex items-center justify-between gap-4 border-b border-cream/[0.07] pb-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <span
                        className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border text-cream"
                        style={{
                          borderColor: `${GAME_META[game].tint}40`,
                          background: `${GAME_META[game].tint}14`,
                        }}
                      >
                        <GameGlyph id={game} size={30} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-display text-[26px] font-semibold leading-none tracking-[-0.02em] text-cream">
                          {GAME_META[game].title}
                        </div>
                        <div className="mt-1.5 text-[13px] text-cream/40">{GAME_META[game].sub}</div>
                      </div>
                    </div>
                    <button className="btn-quiet shrink-0" onClick={() => setPicked(false)}>
                      <ArrowLeft size={15} /> <span className="hidden sm:inline">Oyun değiştir</span>
                    </button>
                  </div>

                  {/* Rules read as a pull-quote rather than a grey info box. */}
                  <div className="border-l border-cream/15 pl-5">
                    <p className="eyebrow mb-2">Nasıl oynanır</p>
                    <p className="max-w-xl text-[14px] leading-relaxed text-cream/55">{meta.how}</p>
                  </div>

                  {game === 'tavla' && (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Kurallar">
                        <div className="grid grid-cols-2 gap-2">
                          <Choice active={mode === 'classic'} onClick={() => setMode('classic')} title="Klasik" sub="çift zar yok" />
                          <Choice active={mode === 'backgammon'} onClick={() => setMode('backgammon')} title="Çift zarlı" sub="doubling cube" />
                        </div>
                      </Field>
                      <Field label="Kaç sayıya oynanacak?">
                        <div className="grid grid-cols-4 gap-2">
                          {TARGETS.map((t) => (
                            <Choice key={t} active={target === t} onClick={() => setTarget(t)} title={`${t}`} sub={t === 1 ? 'tek oyun' : 'sayı'} />
                          ))}
                        </div>
                      </Field>
                    </div>
                  )}

                  {game === 'amiral' && (
                    <Field label="Zorluk">
                      <div className="grid grid-cols-2 gap-2">
                        <Choice active={amiralKolay} onClick={() => setAmiralKolay(true)} title="Kolay" sub="batanın çevresi açılır" />
                        <Choice active={!amiralKolay} onClick={() => setAmiralKolay(false)} title="Zor" sub="gemiler bitişik olabilir" />
                      </div>
                    </Field>
                  )}

                  <Field label="Takma adın">
                    <input
                      ref={nameRef}
                      className={cn('input max-w-md', nameFlash && 'border-danger/80 ring-2 ring-danger/25')}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="ör. Kaan"
                      maxLength={20}
                    />
                    {!hasName && (
                      <p className="mt-2 text-[13px] text-cream/35">Bir takma ad yeter — üyelik gerekmez.</p>
                    )}
                  </Field>

                  {matchmaking ? (
                    <div className="flex max-w-md items-center justify-between gap-4 rounded-xl border border-accent/25 bg-accent/[0.06] px-5 py-4">
                      <p className="flex items-center gap-2.5 text-sm font-semibold text-accent">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                        </span>
                        Rakip aranıyor…
                      </p>
                      <button className="btn-quiet" onClick={cancelMatch}>
                        İptal
                      </button>
                    </div>
                  ) : game === 'secrethitler' ? (
                    // Lobby game: no 1v1 matchmaking — you gather your own crew.
                    <button className="btn-primary w-full max-w-md py-3.5" onClick={create} disabled={busy}>
                      {busy ? 'Oluşturuluyor…' : 'Lobi kur, ekibi topla (5-10 kişi)'}
                      {!busy && <ArrowRight size={16} />}
                    </button>
                  ) : (
                    <div className="flex max-w-md flex-col gap-2.5 sm:flex-row">
                      <button className="btn-primary flex-1 py-3.5" onClick={create} disabled={busy}>
                        {busy ? 'Oluşturuluyor…' : 'Oda kur ve başla'}
                        {!busy && <ArrowRight size={16} />}
                      </button>
                      <button className="btn-ghost py-3.5" onClick={find}>
                        <Target size={15} /> Rakip bul
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* ---- Secondary: got an invite? ---- */}
            <div className="mt-12 border-t border-cream/[0.07] pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <p className="shrink-0 text-[13px] text-cream/40 sm:w-44">Davet linkin mi var?</p>
                <input
                  className="input py-2.5"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="oda kodu veya link yapıştır"
                  onKeyDown={(e) => e.key === 'Enter' && join()}
                />
                <button className="btn-ghost shrink-0 px-6 py-2.5" onClick={join} disabled={!joinCode.trim()}>
                  Katıl
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
              <button
                className="group inline-flex items-center gap-2 text-[13px] text-cream/45 transition-colors hover:text-cream"
                onClick={() => navigate('/pratik')}
              >
                <GraduationCap size={15} />
                Yeni misin? Bota karşı pratik yap
                <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              {accountsEnabled && !authUser && (
                <p className="text-[13px] text-cream/30">
                  Giriş yaparsan Elo puanın ve istatistiklerin kaydedilir.
                </p>
              )}
            </div>
          </div>

          {/* Right rail on wide screens; stacks under the flow on phones. */}
          {accountsEnabled && authUser && (
            <div className="lg:col-start-2 lg:row-start-1">
              <FriendsStrip game={game} />
            </div>
          )}
          {accountsEnabled && (
            <div className="lg:col-start-2 lg:row-start-2">
              <TournamentCard game={game} authed={!!authUser} />
            </div>
          )}
        </div>

        <footer className="mt-16 border-t border-cream/[0.07] pt-8 text-[13px] text-cream/35">
          <ul className="flex flex-wrap gap-x-8 gap-y-2">
            <li>Zarları sunucu atar — hile yok</li>
            <li>Oyun içi sohbet &amp; emoji</li>
            <li>Tek tıkla rövanş</li>
          </ul>
          <nav className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            <a href="/nasil-oynanir" className="transition-colors hover:text-accent">
              Tavla nasıl oynanır?
            </a>
            <a href="/pratik" className="transition-colors hover:text-accent">
              Bota karşı pratik
            </a>
          </nav>
          <p className="mt-6 max-w-2xl leading-relaxed text-cream/20">
            Ücretsiz, üyeliksiz online tavla, dama, amiral battı, mangala, 4'ü bağla ve satranç — OnlineTavla
          </p>
        </footer>
      </main>
    </div>
  );
}

/** The small-caps label + hairline that opens a section. */
function SectionRule({ label, meta, className }: { label: string; meta?: string; className?: string }) {
  return (
    <div className={cn('mb-1 flex items-center gap-4', className)}>
      <span className="eyebrow">{label}</span>
      <span className="rule" />
      {meta && <span className="text-[11px] text-cream/25">{meta}</span>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-2.5">{label}</p>
      {children}
    </div>
  );
}

// A catalog row, not a filled tile: hairline-separated, with the game's accent
// arriving only on hover. Seven equal-weight boxes is what made the old picker
// read as a grid of buttons rather than a list of games.
function GamePick({ g, index, onPick }: { g: (typeof GAMES)[number]; index: number; onPick: () => void }) {
  const m = GAME_META[g.id];
  return (
    <button
      onClick={onPick}
      style={{ ['--tint' as string]: m.tint, animationDelay: `${index * 35}ms` }}
      className="group relative flex animate-rise-in items-start gap-4 border-b border-cream/[0.07] py-5 text-left transition-colors duration-200 hover:border-cream/20"
    >
      {/* Hover wash, clipped to the row — gives feedback without a border box. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-[-14px] inset-y-0 rounded-lg bg-[color:var(--tint)] opacity-0 transition-opacity duration-200 group-hover:opacity-[0.055]"
      />
      <span className="relative mt-0.5 shrink-0 text-cream/70 transition-all duration-200 group-hover:scale-105 group-hover:text-[color:var(--tint)]">
        <GameGlyph id={g.id} size={34} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[19px] font-semibold leading-tight tracking-[-0.015em] text-cream">
            {m.title}
          </span>
          <span className="truncate text-[12px] text-cream/30">{m.sub}</span>
        </span>
        <span className="mt-1.5 block text-[13px] leading-relaxed text-cream/50">{g.desc}</span>
      </span>
      <ArrowRight
        size={16}
        className="relative mt-1.5 shrink-0 -translate-x-1 text-cream/0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-[color:var(--tint)]"
      />
    </button>
  );
}

function Choice({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-[10px] border px-3 py-2.5 text-left transition-all duration-200 ease-out',
        active
          ? 'border-accent/70 bg-accent/[0.12] text-cream'
          : 'border-cream/12 bg-cream/[0.02] text-cream/70 hover:border-cream/25 hover:bg-cream/[0.05]',
      )}
    >
      <div className={cn('text-[14px] font-semibold leading-tight', active && 'text-accent')}>{title}</div>
      <div className={cn('mt-0.5 text-[11px] leading-tight', active ? 'text-accent/55' : 'text-cream/30')}>{sub}</div>
    </button>
  );
}

// Online friends, one tap from the home screen — no digging through the modal.
// Refreshes presence every 30s while visible.
function FriendsStrip({ game }: { game: GameId }) {
  const inviteFriend = useStore((s) => s.inviteFriend);
  const reqCount = useStore((s) => s.reqCount);
  const friendsVersion = useStore((s) => s.friendsVersion);
  const refreshRequests = useStore((s) => s.refreshRequests);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [modal, setModal] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);

  // friendsVersion bumps on a live friend:accepted push, so a fresh friend
  // appears here without waiting for the 30s presence poll.
  useEffect(() => {
    const load = () => {
      void fetchFriends().then(setFriends);
      void refreshRequests();
    };
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [modal, friendsVersion, refreshRequests]);

  const online = friends.filter((f) => f.online);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="eyebrow flex items-center gap-2">
          <Users size={13} /> Arkadaşların
        </span>
        <button
          className="text-[12px] text-cream/40 transition-colors hover:text-accent"
          onClick={() => setModal(true)}
        >
          {reqCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 font-semibold text-accent">
              <Bell size={11} /> {reqCount} istek
            </span>
          ) : friends.length === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Plus size={12} /> Ekle
            </span>
          ) : (
            'Tümü'
          )}
        </button>
      </div>

      {friends.length === 0 ? (
        <p className="border-t border-cream/[0.07] pt-3 text-[13px] leading-relaxed text-cream/35">
          Arkadaş ekle; çevrimiçi olduklarında buradan tek dokunuşla oyuna çağır.
        </p>
      ) : (
        <div className="space-y-px border-t border-cream/[0.07]">
          {[...online, ...friends.filter((f) => !f.online)].slice(0, 6).map((f) => (
            <div key={f.uid} className="flex items-center gap-2.5 border-b border-cream/[0.05] py-2.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: f.online ? '#5bc08a' : '#4a4a4e' }}
              />
              <span className={cn('min-w-0 flex-1 truncate text-[13px]', f.online ? 'text-cream/85' : 'text-cream/35')}>
                {f.handle}
              </span>
              {f.online && (
                <button
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-40"
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

// Daily tournament for the selected game, with its live top-5.
function TournamentCard({ game, authed }: { game: GameId; authed: boolean }) {
  const [t, setT] = useState<Tournament | null>(null);
  useEffect(() => {
    void fetchTournament(game).then(setT);
  }, [game]);
  if (!t) return null;
  const top = t.standings.slice(0, 5);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="eyebrow flex items-center gap-2">
          <Trophy size={13} /> Günün turnuvası
        </span>
        {t.joined ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ok">
            <Check size={12} /> Katıldın
          </span>
        ) : authed ? (
          <button
            className="text-[12px] font-semibold text-accent transition-colors hover:text-accent-soft"
            onClick={async () => {
              await joinTournament(game);
              void fetchTournament(game).then(setT);
            }}
          >
            Katıl →
          </button>
        ) : (
          <span className="text-[12px] text-cream/30">Giriş yap</span>
        )}
      </div>

      <div className="border-t border-cream/[0.07] pt-3">
        <p className="truncate text-[14px] font-semibold text-cream/85">{t.meta.name}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-cream/35">
          Kazandığın her maç +1 puan · {t.standings.length} katılımcı
        </p>

        <div className="mt-3.5 space-y-px">
          {top.length === 0 ? (
            <p className="text-[13px] text-cream/30">Henüz katılan yok — günün ilk şampiyonu sen ol.</p>
          ) : (
            top.map((s, i) => (
              <div key={s.uid} className="flex items-center gap-3 border-b border-cream/[0.05] py-2 text-[13px]">
                <span className={cn('w-4 tabular-nums', i === 0 ? 'font-bold text-accent' : 'text-cream/25')}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-cream/80">{s.handle}</span>
                <span className="shrink-0 tabular-nums text-cream/40">{s.points}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
