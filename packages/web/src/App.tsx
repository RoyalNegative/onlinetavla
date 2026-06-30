import { useEffect } from 'react';
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

  return (
    <>
      {roomId ? <Room roomId={roomId} /> : path === '/pratik' ? <Practice /> : <Home />}
      {invite && (
        <div className="fixed left-1/2 top-4 z-50 w-[min(92vw,360px)] -translate-x-1/2 animate-fade-up rounded-2xl border border-amber-glow/40 bg-ink-700 p-4 shadow-2xl">
          <p className="text-sm">
            🎮 <b>{invite.fromName}</b> seni {invite.gameId === 'dama' ? 'dama' : 'tavla'} oyununa çağırdı.
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

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-fade-up rounded-xl bg-ink-700 px-4 py-2.5 text-sm shadow-xl ring-1 ring-white/10">
      {text}
    </div>
  );
}
