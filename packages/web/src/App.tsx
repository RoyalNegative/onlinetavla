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

  useEffect(() => {
    init();
  }, [init]);

  const path = useRoute();
  const roomId = roomIdFromPath(path);

  return (
    <>
      {roomId ? <Room roomId={roomId} /> : path === '/pratik' ? <Practice /> : <Home />}
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
