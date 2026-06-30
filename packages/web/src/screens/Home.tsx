import { useState } from 'react';
import { Header } from '../components/Header';
import { navigate } from '../router';
import { useStore } from '../store';

const TARGETS = [1, 3, 5, 7];

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

  const [game, setGame] = useState<'tavla' | 'dama'>('tavla');
  const [mode, setMode] = useState<'classic' | 'backgammon'>('classic');
  const [target, setTarget] = useState(5);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    await createRoom({ gameId: game, mode, targetPoints: target });
    setBusy(false);
  }

  function join() {
    const code = joinCode.trim().split('/').pop()?.toLowerCase() ?? '';
    if (code) navigate(`/r/${code}`);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col">
      <Header />

      <main className="flex-1 px-4 pb-12 sm:px-6">
        <section className="py-8 text-center sm:py-12">
          <h1 className="text-4xl font-black sm:text-5xl">
            Arkadaşınla <span className="text-amber-glow">tavla</span>
          </h1>
          <p className="mx-auto mt-3 max-w-md text-white/60">
            Oda kur, linki paylaş, hemen oynamaya başla. Ücretsiz, reklamsız, üyelik gerekmez.
          </p>
          <button className="btn-ghost mx-auto mt-4" onClick={() => navigate('/pratik')}>
            🎓 Yeni misin? Bota karşı pratik yap & öğren
          </button>
        </section>

        {accountsEnabled && !authUser && (
          <div className="mb-6 rounded-2xl border border-amber-glow/30 bg-amber-glow/10 px-4 py-3 text-sm text-amber-glow/90">
            💡 İstersen <b>giriş yap</b> — istatistiklerin, Elo puanın ve sıralaman kaydedilsin. Oynamak için şart değil.
          </div>
        )}

        <div className="mb-5">
          <label className="mb-1 block text-sm text-white/60">Takma adın</label>
          <input
            className="input"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="ör. Kaan"
            maxLength={20}
          />
          {!hasName && <p className="mt-1 text-xs text-amber-glow/80">Oynamak için bir takma ad gir.</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Create */}
          <div className="card space-y-4 p-5">
            <h2 className="text-lg font-bold">Yeni oda</h2>

            <div>
              <span className="mb-1 block text-xs text-white/50">Oyun</span>
              <div className="grid grid-cols-2 gap-2">
                <Toggle active={game === 'tavla'} onClick={() => setGame('tavla')} title="🎲 Tavla" sub="backgammon" />
                <Toggle active={game === 'dama'} onClick={() => setGame('dama')} title="⛀ Dama" sub="Türk daması" />
              </div>
            </div>

            {game === 'tavla' ? (
              <>
                <div>
                  <span className="mb-1 block text-xs text-white/50">Kurallar</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Toggle active={mode === 'classic'} onClick={() => setMode('classic')} title="Klasik" sub="çift zar yok" />
                    <Toggle active={mode === 'backgammon'} onClick={() => setMode('backgammon')} title="Çift zarlı" sub="doubling cube" />
                  </div>
                </div>
                <div>
                  <span className="mb-1 block text-xs text-white/50">Maç hedefi (sayı)</span>
                  <div className="grid grid-cols-4 gap-2">
                    {TARGETS.map((t) => (
                      <Toggle key={t} active={target === t} onClick={() => setTarget(t)} title={`${t}`} sub={t === 1 ? 'tek' : 'sayı'} />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="rounded-xl bg-white/5 p-3 text-xs text-white/50">
                Türk daması: taşlar ileri ve yana hareket eder, geriye yiyemez. Son sıraya ulaşan
                taş <b>dama</b> olur (uzaktan oynar). Yeme zorunludur, en çok yiyeni oynamalısın.
              </p>
            )}

            <button className="btn-primary w-full" onClick={create} disabled={busy || !hasName}>
              {busy ? 'Oluşturuluyor…' : 'Oda kur ve başla'}
            </button>

            <div className="flex items-center gap-2 text-xs text-white/30">
              <span className="h-px flex-1 bg-white/10" /> ya da <span className="h-px flex-1 bg-white/10" />
            </div>

            {matchmaking ? (
              <div className="text-center">
                <p className="animate-pulse text-sm text-amber-glow">🎯 Rakip aranıyor…</p>
                <button className="btn-ghost mt-2 w-full" onClick={cancelMatch}>
                  İptal
                </button>
              </div>
            ) : (
              <button className="btn-ghost w-full" onClick={() => findMatch(game)} disabled={!hasName}>
                🎯 Rakip bul (rastgele online)
              </button>
            )}
          </div>

          {/* Join */}
          <div className="card flex flex-col space-y-4 p-5">
            <h2 className="text-lg font-bold">Odaya katıl</h2>
            <p className="text-sm text-white/50">Sana gelen oda kodunu ya da linki yapıştır.</p>
            <input
              className="input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="oda kodu veya link"
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            <button className="btn-ghost w-full" onClick={join} disabled={!joinCode.trim()}>
              Katıl
            </button>
            <div className="mt-auto rounded-xl bg-white/5 p-3 text-xs text-white/40">
              Oyunu sen kur, çıkan linki arkadaşına gönder. İki kişi bağlanınca oyun başlar.
            </div>
          </div>
        </div>

        <FeatureRow />
      </main>
    </div>
  );
}

function Toggle({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-2 py-2 text-center transition ${active ? 'bg-amber-glow text-ink-900' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
    >
      <div className="font-bold leading-tight">{title}</div>
      <div className={`text-[10px] ${active ? 'text-ink-900/70' : 'text-white/40'}`}>{sub}</div>
    </button>
  );
}

function FeatureRow() {
  const items = [
    ['🎲', 'Sunucu zar atar', 'Zarlar ve hamleler sunucuda doğrulanır — hile yok.'],
    ['💬', 'Sohbet & emoji', 'Oyun sırasında lafla, emoji at.'],
    ['🔁', 'Rövanş & maç', 'İlk N sayıya kadar oyna, tek tıkla rövanş.'],
  ];
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {items.map(([icon, t, d]) => (
        <div key={t} className="rounded-2xl bg-white/5 p-4">
          <div className="text-2xl">{icon}</div>
          <div className="mt-1 font-semibold">{t}</div>
          <div className="text-xs text-white/50">{d}</div>
        </div>
      ))}
    </div>
  );
}
