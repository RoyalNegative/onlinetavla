// Header auth control: Google sign-in (optional) + leaderboard access.

import { useState } from 'react';
import { firebaseConfigured, signInWithGoogle, signOut } from '../lib/firebase';
import { useStore } from '../store';
import { AccountModal } from './AccountModal';

export function Auth() {
  const authUser = useStore((s) => s.authUser);
  const accountsEnabled = useStore((s) => s.accountsEnabled);
  const [modal, setModal] = useState<null | 'leaderboard' | 'profile'>(null);
  const [menu, setMenu] = useState(false);

  if (!accountsEnabled) return null;

  return (
    <div className="flex items-center gap-2">
      <button className="btn-ghost px-2.5 py-2 text-sm" onClick={() => setModal('leaderboard')}>
        🏆<span className="ml-1 hidden sm:inline">Sıralama</span>
      </button>

      {firebaseConfigured &&
        (authUser ? (
          <div className="relative">
            <button className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 hover:bg-white/10" onClick={() => setMenu((m) => !m)}>
              {authUser.avatar ? (
                <img src={authUser.avatar} alt="" className="h-7 w-7 rounded-full" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-glow text-sm font-bold text-ink-900">
                  {authUser.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="max-w-[90px] truncate text-sm">{authUser.name}</span>
            </button>
            {menu && (
              <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-xl border border-white/10 bg-ink-700 shadow-xl">
                <button
                  className="block w-full px-4 py-2.5 text-left text-sm hover:bg-white/5"
                  onClick={() => {
                    setMenu(false);
                    setModal('profile');
                  }}
                >
                  Profilim
                </button>
                <button
                  className="block w-full px-4 py-2.5 text-left text-sm text-rose-300 hover:bg-white/5"
                  onClick={() => {
                    setMenu(false);
                    void signOut();
                  }}
                >
                  Çıkış yap
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className="btn-primary px-3 py-2 text-sm"
            title="İstatistik, sıralama ve profil için"
            onClick={() => void signInWithGoogle()}
          >
            Giriş yap
          </button>
        ))}

      {modal && <AccountModal initialTab={modal === 'profile' ? 'profile' : 'leaderboard'} onClose={() => setModal(null)} />}
    </div>
  );
}
