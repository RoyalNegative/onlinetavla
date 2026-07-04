// Shared side panel for the simpler board games (mangala, 4'ü bağla): the two
// players with a per-color score line, turn highlight, winner / draw states and
// the resign / rematch controls. Game-specific panels (tavla, dama, amiral)
// keep their own richer layouts.

import { useState } from 'react';
import type { PlayerInfo } from '../protocol';

type Color = 'white' | 'black';

function Avatar({ name, url, color }: { name: string; url: string | null; color: Color }) {
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

function Row({ color, player, line, active, isYou }: { color: Color; player: PlayerInfo | undefined; line: string; active: boolean; isYou: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${active ? 'bg-amber-glow/15 ring-1 ring-amber-glow/50' : 'bg-white/5'}`}>
      <Avatar name={player?.name ?? '—'} url={player?.avatar ?? null} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{player?.name ?? 'Bekleniyor…'}</span>
          {isYou && <span className="rounded bg-white/10 px-1.5 text-[10px] font-bold text-white/70">SEN</span>}
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: player ? (player.connected ? '#34d399' : '#f87171') : '#6b7280' }} />
        </div>
        <span className="text-xs text-white/50">{line}</span>
      </div>
    </div>
  );
}

export function GenericPanel({
  heading,
  players,
  youSeat,
  youAre,
  turn,
  winner,
  over,
  lineFor,
  playingText,
  waitingText,
  onResign,
  onRematch,
  rematch,
}: {
  heading: string;
  players: PlayerInfo[];
  youSeat: number | null;
  youAre: Color | null;
  turn: Color;
  winner: Color | null;
  over: boolean;
  /** Score line under each player's name, e.g. 'Beyaz · 12 taş'. */
  lineFor: (color: Color) => string;
  playingText: string; // when it's your turn
  waitingText: string; // when it's the opponent's turn
  onResign: () => void;
  onRematch: () => void;
  rematch: { votes: number; needed: number };
}) {
  const [confirm, setConfirm] = useState(false);
  const white = players.find((p) => p.color === 'white');
  const black = players.find((p) => p.color === 'black');
  const activeTurn = over ? null : turn;
  const spectator = youAre === null;
  const draw = over && winner === null;

  return (
    <div className="space-y-4">
      <div className="card p-3">
        <div className="mb-2 px-1 text-xs text-white/50">{heading}</div>
        <div className="space-y-2">
          <Row color="black" player={black} line={lineFor('black')} active={activeTurn === 'black'} isYou={youSeat === 1} />
          <Row color="white" player={white} line={lineFor('white')} active={activeTurn === 'white'} isYou={youSeat === 0} />
        </div>
      </div>

      <div className="card space-y-3 p-4">
        {over ? (
          <div className="space-y-3 text-center">
            <p className="text-lg font-bold">
              {draw
                ? '🤝 Berabere!'
                : winner === youAre
                  ? '🏆 Kazandın!'
                  : spectator
                    ? `${winner === 'white' ? 'Beyaz' : 'Siyah'} kazandı`
                    : 'Kaybettin'}
            </p>
            {!spectator && (
              <button className="btn-primary w-full" onClick={onRematch}>
                Rövanş ({rematch.votes}/{rematch.needed})
              </button>
            )}
          </div>
        ) : spectator ? (
          <p className="text-center text-sm text-white/50">İzleyici modundasın 👀</p>
        ) : (
          <>
            <p className="text-center text-sm text-white/70">{turn === youAre ? playingText : waitingText}</p>
            <div className="text-center">
              {confirm ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <span className="text-white/60">Emin misin?</span>
                  <button className="text-rose-400 hover:underline" onClick={onResign}>Evet</button>
                  <button className="text-white/60 hover:underline" onClick={() => setConfirm(false)}>Vazgeç</button>
                </div>
              ) : (
                <button className="text-xs text-white/40 hover:text-rose-400" onClick={() => setConfirm(true)}>Pes et</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
