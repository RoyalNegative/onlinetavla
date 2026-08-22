import { useEffect } from 'react';
import { trackPageView } from './lib/analytics';
import { roomIdFromPath, useRoute } from './router';
import { Home } from './screens/Home';
import { Practice } from './screens/Practice';
import { Room } from './screens/Room';
import { useStore } from './store';

export function App() {
  const init = useStore((s) => s.init);
  const toast = useStore((s) => s.toast);
  const setToast = useStore((s) => s.setToast);
  const invite = useStore((s) => s.invite);
  const acceptInvite = useStore((s) => s.acceptInvite);
  const dismissInvite = useStore((s) => s.dismissInvite);

  useEffect(() => {
    init();
  }, [init]);

  const path = useRoute();
  const roomId = roomIdFromPath(path);
  useDocumentTitle(path, roomId);

  return (
    <>
      {roomId ? <Room roomId={roomId} /> : path === '/pratik' ? <Practice /> : <Home />}
      {invite && (
        <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,360px)] -translate-x-1/2 animate-fade-up rounded-2xl border border-accent/40 bg-ink-700 p-4 shadow-2xl">
          <p className="text-sm">
            🎮 <b>{invite.fromName}</b> seni{' '}
            {{ dama: 'dama', amiral: 'amiral battı', mangala: 'mangala', dortlu: "4'ü bağla" }[invite.gameId] ?? 'tavla'} oyununa çağırdı.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary flex-1 py-2" onClick={acceptInvite}>
              Katıl
            </button>
            <button className="btn-ghost px-3 py-2" onClick={dismissInvite}>
              Kapat
            </button>
          </div>
        </div>
      )}
      {toast && <Toast text={toast} onDone={() => setToast(null)} />}
    </>
  );
}

// Per-route <title> + meta description. SPAs share one HTML shell, so we update
// these on navigation for better browser UX, link sharing and SEO signals.
function useDocumentTitle(path: string, roomId: string | null): void {
  useEffect(() => {
    let title: string;
    let desc: string;
    if (roomId) {
      title = 'Tavla Odası — arkadaşınla oyna | OnlineTavla';
      desc = 'Bu odaya katıl ve arkadaşınla ücretsiz online tavla oyna. Üyelik gerekmez.';
    } else if (path === '/pratik') {
      title = 'Tavla Pratik — bota karşı alıştırma | OnlineTavla';
      desc = 'Bota karşı ücretsiz tavla pratiği yap, kuralları öğren. Sunucusuz, üyeliksiz.';
    } else {
      title = 'Online Tavla Oyna — Ücretsiz, Üyeliksiz, Arkadaşınla Anında | OnlineTavla';
      desc =
        'Ücretsiz online tavla oyna. Üyelik yok, reklam yok — oda kur, linki paylaş, arkadaşınla saniyeler içinde başla.';
    }
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
    trackPageView(path, title);
  }, [path, roomId]);
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-xl bg-ink-700 px-4 py-2.5 text-sm shadow-xl ring-1 ring-cream/10">
      {text}
    </div>
  );
}
