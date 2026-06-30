import type { ReactNode } from 'react';
import { navigate } from '../router';
import { Auth } from './Auth';

export function Header({ right }: { right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 sm:px-6">
      <button onClick={() => navigate('/')} className="flex items-center gap-2 text-xl font-black tracking-tight">
        <span className="text-2xl">🎲</span>
        <span>
          Tavla<span className="text-amber-glow">.</span>
        </span>
      </button>
      <div className="flex items-center gap-2">
        {right}
        <Auth />
      </div>
    </header>
  );
}
