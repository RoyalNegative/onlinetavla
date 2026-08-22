// The two players, the match score, whose turn it is, and the cube.

import type { TavlaView } from '@tavla/engine';
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

function Row({
  color,
  player,
  score,
  pip,
  active,
  isYou,
}: {
  color: 'white' | 'black';
  player: PlayerInfo | undefined;
  score: number;
  pip: number;
  active: boolean;
  isYou: boolean;
}) {
  return (
    // Whose turn it is reads as a lit left edge, not a filled tint block —
    // two stacked tinted pills is what made the old panel look like a form.
    <div
      className={`flex items-center gap-3 rounded-lg border-l-2 py-2 pl-3 pr-3 transition-all duration-300 ${
        active ? 'border-accent bg-accent/[0.08]' : 'border-cream/10 bg-cream/[0.02]'
      }`}
    >
      <Avatar name={player?.name ?? '—'} url={player?.avatar ?? null} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{player?.name ?? 'Bekleniyor…'}</span>
          {isYou && (
            <span className="rounded border border-cream/15 px-1.5 py-px text-[9px] font-bold tracking-[0.1em] text-cream/50">
              SEN
            </span>
          )}
          <span
            className="h-2.5 w-2.5 rounded-full"
            title={player?.connected ? 'çevrimiçi' : 'bağlantı kesik'}
            style={{ background: player ? (player.connected ? '#34d399' : '#f87171') : '#6b7280' }}
          />
        </div>
        <span className="text-[11px] text-cream/40">{color === 'white' ? 'Beyaz' : 'Siyah'} · {pip} pul yolu</span>
      </div>
      <div className="text-2xl font-black tabular-nums">{score}</div>
    </div>
  );
}

export function PlayerPanel({
  view,
  players,
  youSeat,
}: {
  view: TavlaView;
  players: PlayerInfo[];
  youSeat: number | null;
}) {
  const white = players.find((p) => p.color === 'white');
  const black = players.find((p) => p.color === 'black');
  const turn = view.matchWinner ? null : view.game.turn;
  const cube = view.game.cube;

  return (
    <div className="card p-3">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <span className="eyebrow">
          İlk {view.config.targetPoints} sayı · {view.config.mode === 'backgammon' ? 'Çift zarlı' : 'Klasik'}
        </span>
        <span className="text-[11px] tabular-nums text-cream/25">#{view.gameNumber}</span>
      </div>
      <div className="space-y-2">
        <Row color="black" player={black} score={view.score.black} pip={view.pip.black} active={turn === 'black'} isYou={youSeat === 1} />
        <Row color="white" player={white} score={view.score.white} pip={view.pip.white} active={turn === 'white'} isYou={youSeat === 0} />
      </div>
      {cube && (
        <div className="mt-3 flex items-center justify-center gap-2 border-t border-cream/[0.07] pt-3 text-[11px] text-cream/45">
          <span className="grid h-7 w-7 place-items-center rounded-md border border-cream/20 font-bold">×{cube.value}</span>
          <span>{cube.owner ? `${cube.owner === 'white' ? 'Beyaz' : 'Siyah'} elinde` : 'Ortada'}</span>
        </div>
      )}
    </div>
  );
}
