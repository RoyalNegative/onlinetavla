// Dama side panel: the two players with piece counts, turn indicator, and the
// resign / rematch controls.

import { useState } from 'react';
import type { DamaView } from '@tavla/engine';
import type { PlayerInfo } from '../protocol';

function Avatar({ name, url, color }: { name: string; url: string | null; color: 'white' | 'black' }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  return (
    <div
      className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold"
      style={{ background: color === 'white' ? '#efe2c0' : '#2c2017', color: color === 'white' ? '#2c2017' : '#efe2c0' }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Row({ color, player, count, active, isYou }: { color: 'white' | 'black'; player: PlayerInfo | undefined; count: number; active: boolean; isYou: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${active ? 'bg-accent/15 ring-1 ring-accent/50' : 'bg-cream/5'}`}>
      <Avatar name={player?.name ?? '—'} url={player?.avatar ?? null} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{player?.name ?? 'Bekleniyor…'}</span>
          {isYou && <span className="rounded bg-cream/10 px-1.5 text-[10px] font-bold text-cream/70">SEN</span>}
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: player ? (player.connected ? '#34d399' : '#f87171') : '#6b7280' }} />
        </div>
        <span className="text-xs text-cream/50">{color === 'white' ? 'Beyaz' : 'Siyah'} · {count} taş</span>
      </div>
    </div>
  );
}

export function DamaPanel({
  view,
  players,
  youSeat,
  onResign,
  onRematch,
  rematch,
}: {
  view: DamaView;
  players: PlayerInfo[];
  youSeat: number | null;
  onResign: () => void;
  onRematch: () => void;
  rematch: { votes: number; needed: number };
}) {
  const [confirm, setConfirm] = useState(false);
  const white = players.find((p) => p.color === 'white');
  const black = players.find((p) => p.color === 'black');
  const turn = view.winner ? null : view.turn;
  const spectator = view.youAre === null;

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <div className="mb-2 px-1 text-xs text-cream/50">Dama · Türk daması</div>
        <div className="space-y-2">
          <Row color="black" player={black} count={view.counts.black} active={turn === 'black'} isYou={youSeat === 1} />
          <Row color="white" player={white} count={view.counts.white} active={turn === 'white'} isYou={youSeat === 0} />
        </div>
      </div>

      <div className="card space-y-3 p-4">
        {view.winner ? (
          <div className="space-y-3 text-center">
            <p className="text-lg font-bold">{view.winner === view.youAre ? '🏆 Kazandın!' : spectator ? `${view.winner === 'white' ? 'Beyaz' : 'Siyah'} kazandı` : 'Kaybettin'}</p>
            {!spectator && (
              <button className="btn-primary w-full" onClick={onRematch}>
                Rövanş ({rematch.votes}/{rematch.needed})
              </button>
            )}
          </div>
        ) : spectator ? (
          <p className="text-center text-sm text-cream/50">İzleyici modundasın 👀</p>
        ) : (
          <>
            <p className="text-center text-sm text-cream/70">{view.yourTurn ? 'Sıra sende — taşını oyna' : 'Rakip oynuyor…'}</p>
            <div className="text-center">
              {confirm ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-cream/60">Emin misin?</span>
                  <button className="text-rose-400 hover:underline" onClick={onResign}>Evet</button>
                  <button className="text-cream/60 hover:underline" onClick={() => setConfirm(false)}>Vazgeç</button>
                </div>
              ) : (
                <button className="text-xs text-cream/40 hover:text-rose-400" onClick={() => setConfirm(true)}>Pes et</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
