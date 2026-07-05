// Header auth control: Google sign-in (optional), leaderboard access and the
// friend-request notification bell.

import { useEffect, useState } from 'react';
import { firebaseConfigured, signInWithGoogle, signOut } from '../lib/firebase';
import { useStore } from '../store';
import { AccountModal } from './AccountModal';

export function Auth() {
  const authUser = useStore((s) => s.authUser);
  const accountsEnabled = useStore((s) => s.accountsEnabled);
  const setToast = useStore((s) => s.setToast);
  const reqCount = useStore((s) => s.reqCount);
  const refreshRequests = useStore((s) => s.refreshRequests);
  const [modal, setModal] = useState<null | 'leaderboard' | 'profile' | 'friends'>(null);
  const [menu, setMenu] = useState(false);

  // The badge updates live via the friend:request socket push; this 45s poll
  // is the fallback (missed push, request arrived while offline) and also
  // refreshes when the modal closes (you may have just accepted them all).
  useEffect(() => {
    if (!authUser) return;
    void refreshRequests();
    const t = setInterval(() => void refreshRequests(), 45_000);
    return () => clearInterval(t);
  }, [authUser, modal, refreshRequests]);

  async function signIn() {
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      setToast(
        code === 'auth/unauthorized-domain'
          ? 'Giriş şu an bu adresten yapılamıyor (domain izni eksik).'
          : 'Giriş yapılamadı, tekrar dene.',
      );
    }
  }

  if (!accountsEnabled) return null;

  return (
    <div className="flex items-center gap-2">
      {authUser && reqCount > 0 && (
        <button
          className="relative rounded-xl bg-white/5 px-2.5 py-2 text-sm hover:bg-white/10"
          title={`${reqCount} arkadaşlık isteği`}
          onClick={() => setModal('friends')}
        >
          🔔
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {reqCount}
          </span>
        </button>
      )}
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
            onClick={() => void signIn()}
          >
            Giriş yap
          </button>
        ))}

      {modal && (
        <AccountModal
          initialTab={modal === 'profile' ? 'profile' : modal === 'friends' ? 'friends' : 'leaderboard'}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
