// One-tap "add friend" while you're already playing someone. Shows only when
// both sides are signed in and you aren't friends yet; adding flips it to a
// confirmation and unlocks future one-tap invites from the home screen.

import { useEffect, useState } from 'react';
import { addFriendByUid, fetchFriends } from '../lib/api';
import { useStore } from '../store';
import type { PlayerInfo } from '../protocol';

export function AddFriendChip({ players, youSeat }: { players: PlayerInfo[]; youSeat: number | null }) {
  const authUser = useStore((s) => s.authUser);
  const accountsEnabled = useStore((s) => s.accountsEnabled);
  const [state, setState] = useState<'hidden' | 'idle' | 'busy' | 'added'>('hidden');

  const opponent = youSeat === null ? undefined : players.find((p) => p.seat !== youSeat);
  const oppUid = opponent?.uid ?? null;

  useEffect(() => {
    setState('hidden');
    if (!accountsEnabled || !authUser || !oppUid || oppUid === authUser.uid) return;
    let alive = true;
    void fetchFriends().then((friends) => {
      if (alive && !friends.some((f) => f.uid === oppUid)) setState('idle');
    });
    return () => {
      alive = false;
    };
  }, [accountsEnabled, authUser, oppUid]);

  if (state === 'hidden' || !opponent) return null;

  if (state === 'added') {
    return (
      <div className="card flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400">
        ✓ <b>{opponent.name}</b> artık arkadaşın — bir dahakine ana sayfadan tek dokunuşla çağır.
      </div>
    );
  }

  return (
    <button
      className="card flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-white/10 disabled:opacity-50"
      disabled={state === 'busy'}
      onClick={() => {
        setState('busy');
        void addFriendByUid(oppUid!).then((r) => setState(r.friend ? 'added' : 'idle'));
      }}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-glow/15 text-amber-glow">+</span>
      <span>
        {state === 'busy' ? 'Ekleniyor…' : <>Arkadaş ekle: <b>{opponent.name}</b></>}
      </span>
    </button>
  );
}
