// Local practice vs a simple bot — the beginner "tutorial" mode. No server.

import { useState } from 'react';
import type { BattleshipView, DamaView, DortluView, GameId, MangalaView, TavlaView } from '@tavla/engine';
import { treasuryOf } from '@tavla/engine';
import { BattleshipBoard, useBattleshipFx } from '../components/BattleshipBoard';
import { BattleshipPanel } from '../components/BattleshipPanel';
import { Board } from '../components/Board';
import { Controls } from '../components/Controls';
import { DamaBoard } from '../components/DamaBoard';
import { DamaPanel } from '../components/DamaPanel';
import { DortluBoard } from '../components/DortluBoard';
import { GenericPanel } from '../components/GenericPanel';
import { Header } from '../components/Header';
import { MangalaBoard } from '../components/MangalaBoard';
import { PlayerPanel } from '../components/PlayerPanel';
import type { PlayerInfo } from '../protocol';
import { navigate } from '../router';
import { usePractice } from '../usePractice';

const PLAYERS: PlayerInfo[] = [
  { seat: 0, color: 'white', name: 'Sen', uid: null, avatar: null, connected: true },
  { seat: 1, color: 'black', name: 'Bot', uid: null, avatar: null, connected: true },
];

export function Practice() {
  const [game, setGame] = useState<GameId>('tavla');
  const [amiralKolay, setAmiralKolay] = useState(true);
  const [botKolay, setBotKolay] = useState(true); // mangala & dörtlü bot strength
  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <Header
        right={
          <button className="btn-ghost px-3 py-2 text-sm" onClick={() => navigate('/')}>
            Çık
          </button>
        }
      />
      <PracticeGame
        key={`${game}:${amiralKolay ? 'k' : 'z'}:${botKolay ? 'k' : 'z'}`}
        gameId={game}
        game={game}
        setGame={setGame}
        amiralKolay={amiralKolay}
        setAmiralKolay={setAmiralKolay}
        botKolay={botKolay}
        setBotKolay={setBotKolay}
      />
    </div>
  );
}

function PracticeGame({
  gameId,
  game,
  setGame,
  amiralKolay,
  setAmiralKolay,
  botKolay,
  setBotKolay,
}: {
  gameId: GameId;
  game: GameId;
  setGame: (g: GameId) => void;
  amiralKolay: boolean;
  setAmiralKolay: (v: boolean) => void;
  botKolay: boolean;
  setBotKolay: (v: boolean) => void;
}) {
  const { view, act, restart } = usePractice(gameId, { noTouch: amiralKolay, easyBot: botKolay });
  const isDama = gameId === 'dama';
  const isAmiral = gameId === 'amiral';
  const isMangala = gameId === 'mangala';
  const isDortlu = gameId === 'dortlu';
  const tview = view as TavlaView;
  const dview = view as DamaView;
  const mview = view as MangalaView;
  const cview = view as DortluView;

  // Amiral: render one bomb-flight behind so shot results land with the bomb.
  const { shown: bshown, fx: bfx } = useBattleshipFx(isAmiral ? (view as BattleshipView) : null);
  const bview = bshown ?? (view as BattleshipView);

  const yourTurn = isAmiral ? bview.yourTurn : view.yourTurn;

  return (
    <main className="grid flex-1 items-start gap-3 px-2 pb-6 sm:gap-4 sm:px-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px]">
      <div
        className={`relative mx-auto w-full rounded-2xl transition-shadow ${yourTurn ? 'ring-2 ring-amber-glow/70 shadow-[0_0_30px_rgba(245,177,76,0.25)]' : ''}`}
        style={{
          maxWidth: isAmiral
            ? '900px'
            : isMangala
              ? '760px'
              : isDortlu
                ? '560px'
                : isDama
                  ? 'calc(100dvh - 150px)'
                  : 'calc((100dvh - 150px) * 5 / 3)',
        }}
      >
        {isAmiral ? (
          <BattleshipBoard view={bview} fx={bfx} onAction={act} />
        ) : isMangala ? (
          <MangalaBoard view={mview} onAction={act} />
        ) : isDortlu ? (
          <DortluBoard view={cview} onAction={act} />
        ) : isDama ? (
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
          <div className="mb-2 grid grid-cols-3 gap-2">
            <Toggle active={game === 'tavla'} onClick={() => setGame('tavla')} label="🎲 Tavla" />
            <Toggle active={game === 'dama'} onClick={() => setGame('dama')} label="⛀ Dama" />
            <Toggle active={game === 'amiral'} onClick={() => setGame('amiral')} label="🚢 Amiral" />
            <Toggle active={game === 'mangala'} onClick={() => setGame('mangala')} label="🪨 Mangala" />
            <Toggle active={game === 'dortlu'} onClick={() => setGame('dortlu')} label="🔴 4'ü Bağla" />
          </div>
          {isAmiral && (
            <div className="mb-2 grid grid-cols-2 gap-2">
              <Toggle active={amiralKolay} onClick={() => setAmiralKolay(true)} label="Kolay" />
              <Toggle active={!amiralKolay} onClick={() => setAmiralKolay(false)} label="Zor" />
            </div>
          )}
          {(isMangala || isDortlu) && (
            <div className="mb-2 grid grid-cols-2 gap-2">
              <Toggle active={botKolay} onClick={() => setBotKolay(true)} label="Kolay bot" />
              <Toggle active={!botKolay} onClick={() => setBotKolay(false)} label="Zor bot" />
            </div>
          )}
          <button className="btn-ghost w-full" onClick={restart}>
            ↻ Yeniden başlat
          </button>
        </div>

        {isAmiral ? (
          <BattleshipPanel view={bview} players={PLAYERS} youSeat={0} onResign={() => act({ type: 'resign' })} onRematch={restart} rematch={{ votes: 0, needed: 1 }} />
        ) : isMangala ? (
          <GenericPanel
            heading="Mangala · taş toplama"
            players={PLAYERS}
            youSeat={0}
            youAre={mview.youAre}
            turn={mview.turn}
            winner={mview.winner}
            over={mview.phase === 'over'}
            lineFor={(c) => `${c === 'white' ? 'Beyaz' : 'Siyah'} · haznede ${mview.pits[treasuryOf(c === 'white' ? 0 : 1)]} taş`}
            playingText="Sıra sende — bir kuyunu seç"
            waitingText="Bot oynuyor…"
            onResign={() => act({ type: 'resign' })}
            onRematch={restart}
            rematch={{ votes: 0, needed: 1 }}
          />
        ) : isDortlu ? (
          <GenericPanel
            heading="4'ü Bağla · dörtlü sıra"
            players={PLAYERS}
            youSeat={0}
            youAre={cview.youAre}
            turn={cview.turn}
            winner={cview.winner}
            over={cview.phase === 'over'}
            lineFor={(c) => `${c === 'white' ? 'Sarı pul' : 'Siyah pul'}`}
            playingText="Sıra sende — bir sütun seç"
            waitingText="Bot oynuyor…"
            onResign={() => act({ type: 'resign' })}
            onRematch={restart}
            rematch={{ votes: 0, needed: 1 }}
          />
        ) : isDama ? (
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

function Rules({ gameId }: { gameId: GameId }) {
  const items =
    gameId === 'tavla'
      ? [
          'İki zar at; her zar bir taşı o kadar ilerletir. Çift gelirse 4 hamle.',
          'Tek rakip taşının olduğu noktaya gelirsen onu kırarsın (bar’a gider).',
          'Bar’da taşın varsa önce onu içeri sokmalısın.',
          'Tüm taşların kendi evine girince toplamaya başlarsın; ilk bitiren kazanır.',
        ]
      : gameId === 'dama'
        ? [
            'Taşlar ileri ve yana birer kare gider — geriye gidemez.',
            'Rakip taşın üstünden boş kareye atlayarak yersin. Yeme zorunlu, en çok yiyeni seç.',
            'Son sıraya ulaşan taş DAMA olur ve uzaktan (çok kare) oynar.',
            'Rakibin taşı ya da hamlesi kalmazsa kazanırsın.',
          ]
        : gameId === 'mangala'
          ? [
              'Kendi kuyunu seç; taşları saat yönünün tersine birer birer dağıt.',
              'Son taş kendi hazneni doldurursa tekrar oynarsın.',
              'Son taş rakip kuyusunu çift sayı yaparsa o kuyuyu kaparsın.',
              'Son taş kendi boş kuyuna düşerse karşı kuyuyu da alırsın. En çok taş kazanır.',
            ]
          : gameId === 'dortlu'
            ? [
                'Sırayla bir sütun seç; pul en alttaki boş göze düşer.',
                'Yatay, dikey veya çapraz dört pulu arka arkaya diz.',
                'Dördü ilk bağlayan kazanır.',
                'Tahta dolar ve dizi yoksa berabere biter.',
              ]
            : [
                '5 gemini 10×10 alana gizlice yerleştir (5-4-3-3-2 uzunluk).',
                'Sırayla rakip alanına ateş et: 💥 isabet, 🌊 ıska.',
                'İsabet ettirirsen bir atış daha yaparsın.',
                'Bir geminin tüm kareleri vurulunca batar — tüm filoyu batıran kazanır.',
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
