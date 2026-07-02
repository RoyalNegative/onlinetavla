import type { ReactNode } from 'react';
import { navigate } from '../router';
import { useStore } from '../store';
import { Auth } from './Auth';

export function Header({ right }: { right?: ReactNode }) {
  const soundOn = useStore((s) => s.soundOn);
  const toggleSound = useStore((s) => s.toggleSound);
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 sm:px-6">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight sm:text-xl">
        <span className="text-2xl">🎲</span>
        <span>
          Tavla<span className="text-amber-glow">.</span>
        </span>
      </button>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {right}
        <button
          onClick={toggleSound}
          title={soundOn ? 'Sesi kapat' : 'Sesi aç'}
          className="rounded-xl bg-white/5 px-2.5 py-2 text-sm hover:bg-white/10"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
        <Auth />
      </div>
    </header>
  );
}
