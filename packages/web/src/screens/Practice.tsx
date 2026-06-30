// Local practice vs a simple bot — the beginner "tutorial" mode. No server.

import { useState } from 'react';
import type { DamaView, TavlaView } from '@tavla/engine';
import { Board } from '../components/Board';
import { Controls } from '../components/Controls';
import { DamaBoard } from '../components/DamaBoard';
import { DamaPanel } from '../components/DamaPanel';
import { Header } from '../components/Header';
import { PlayerPanel } from '../components/PlayerPanel';
import type { PlayerInfo } from '../protocol';
import { navigate } from '../router';
import { usePractice } from '../usePractice';

const PLAYERS: PlayerInfo[] = [
  { seat: 0, color: 'white', name: 'Sen', uid: null, avatar: null, connected: true },
  { seat: 1, color: 'black', name: 'Bot', uid: null, avatar: null, connected: true },
];

export function Practice() {
  const [game, setGame] = useState<'tavla' | 'dama'>('tavla');
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <Header
        right={
          <button className="btn-ghost px-3 py-2 text-sm" onClick={() => navigate('/')}>
            Çık
          </button>
        }
      />
      <PracticeGame key={game} gameId={game} game={game} setGame={setGame} />
    </div>
  );
}

function PracticeGame({
  gameId,
  game,
  setGame,
}: {
  gameId: 'tavla' | 'dama';
  game: 'tavla' | 'dama';
  setGame: (g: 'tavla' | 'dama') => void;
}) {
  const { view, act, restart } = usePractice(gameId);
  const isDama = gameId === 'dama';
  const tview = view as TavlaView;
  const dview = view as DamaView;
  const yourTurn = view.yourTurn;

  return (
    <main className="grid flex-1 items-start gap-3 px-2 pb-6 sm:gap-4 sm:px-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px]">
      <div className={`relative rounded-2xl transition-shadow ${yourTurn ? 'ring-2 ring-amber-glow/70 shadow-[0_0_30px_rgba(245,177,76,0.25)]' : ''}`}>
        {isDama ? (
          <DamaBoard view={dview} interactive={dview.yourTurn && dview.legalMoves.length > 0} onAction={act} />
        ) : (
          <Board view={tview} interactive={tview.yourTurn && tview.game.phase === 'moving' && tview.legalMoves.length > 0} onAction={act} />
        )}
      </div>

      <aside className="flex min-h-0 flex-col gap-4">
        <div className="rounded-2xl border border-amber-glow/30 bg-amber-glow/10 px-4 py-3 text-sm text-amber-glow/90">
          🎓 Pratik modu — bota karşı oyna ve öğren. Oynayabileceğin yerler vurgulanır.
        </div>

        <div className="card p-3">
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Toggle active={game === 'tavla'} onClick={() => setGame('tavla')} label="🎲 Tavla" />
            <Toggle active={game === 'dama'} onClick={() => setGame('dama')} label="⛀ Dama" />
          </div>
          <button className="btn-ghost w-full" onClick={restart}>
            ↻ Yeniden başlat
          </button>
        </div>

        {isDama ? (
          <DamaPanel view={dview} players={PLAYERS} youSeat={0} onResign={() => act({ type: 'resign' })} onRematch={restart} rematch={{ votes: 0, needed: 1 }} />
        ) : (
          <>
            <PlayerPanel view={tview} players={PLAYERS} youSeat={0} />
            <div className="card p-4">
              <Controls view={tview} onAction={act} onRematch={restart} rematch={{ votes: 0, needed: 1 }} />
            </div>
          </>
        )}

        <Rules gameId={gameId} />
      </aside>
    </main>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl px-2 py-2 font-bold transition ${active ? 'bg-amber-glow text-ink-900' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}>
      {label}
    </button>
  );
}

function Rules({ gameId }: { gameId: 'tavla' | 'dama' }) {
  const items =
    gameId === 'tavla'
      ? [
          'İki zar at; her zar bir taşı o kadar ilerletir. Çift gelirse 4 hamle.',
          'Tek rakip taşının olduğu noktaya gelirsen onu kırarsın (bar’a gider).',
          'Bar’da taşın varsa önce onu içeri sokmalısın.',
          'Tüm taşların kendi evine girince toplamaya başlarsın; ilk bitiren kazanır.',
        ]
      : [
          'Taşlar ileri ve yana birer kare gider — geriye gidemez.',
          'Rakip taşın üstünden boş kareye atlayarak yersin. Yeme zorunlu, en çok yiyeni seç.',
          'Son sıraya ulaşan taş DAMA olur ve uzaktan (çok kare) oynar.',
          'Rakibin taşı ya da hamlesi kalmazsa kazanırsın.',
        ];
  return (
    <div className="card p-4">
      <p className="mb-2 font-semibold">Nasıl oynanır?</p>
      <ul className="space-y-1.5 text-sm text-white/70">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-amber-glow">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
