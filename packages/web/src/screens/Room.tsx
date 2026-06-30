import { useEffect, useState } from 'react';
import { Board } from '../components/Board';
import { Chat } from '../components/Chat';
import { Controls } from '../components/Controls';
import { Header } from '../components/Header';
import { PlayerPanel } from '../components/PlayerPanel';
import { navigate } from '../router';
import { useStore } from '../store';
import { useGameEffects } from '../useGameEffects';

export function Room({ roomId }: { roomId: string }) {
  const update = useStore((s) => s.update);
  const connected = useStore((s) => s.connected);
  const joinRoom = useStore((s) => s.joinRoom);
  const sendAction = useStore((s) => s.sendAction);
  const sendChat = useStore((s) => s.sendChat);
  const voteRematch = useStore((s) => s.voteRematch);

  useEffect(() => {
    if (connected) void joinRoom(roomId);
  }, [roomId, connected, joinRoom]);

  useGameEffects(update);

  const inThisRoom = update?.room.roomId === roomId;
  const yourTurn = !!update?.view.yourTurn;

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <Header
        right={
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-white/50">
              <span className="h-2 w-2 rounded-full" style={{ background: connected ? '#34d399' : '#f87171' }} />
              <span className="hidden sm:inline">{connected ? 'bağlı' : 'bağlanıyor'}</span>
            </span>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => navigate('/')}>
              Çık
            </button>
          </div>
        }
      />

      {!inThisRoom ? (
        <div className="grid flex-1 place-items-center text-white/50">Odaya bağlanılıyor…</div>
      ) : (
        <main className="grid flex-1 items-start gap-3 px-2 pb-6 sm:gap-4 sm:px-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px]">
          <div className={`relative rounded-2xl transition-shadow ${yourTurn ? 'ring-2 ring-amber-glow/70 shadow-[0_0_30px_rgba(245,177,76,0.25)]' : ''}`}>
            <Board
              view={update.view}
              interactive={
                update.view.yourTurn &&
                update.view.game.phase === 'moving' &&
                update.view.legalMoves.length > 0
              }
              onAction={sendAction}
            />
            {update.room.status === 'waiting' && <WaitingOverlay roomId={roomId} />}
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            <PlayerPanel view={update.view} players={update.room.players} youSeat={update.you.seat} />
            <div className="card p-4">
              <Controls view={update.view} onAction={sendAction} onRematch={voteRematch} rematch={update.room.rematch} />
            </div>
            {update.room.status === 'waiting' && <InvitePanel roomId={roomId} />}
            <Chat messages={update.room.chat} onSend={sendChat} />
          </aside>
        </main>
      )}
    </div>
  );
}

function InvitePanel({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/r/${roomId}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="card space-y-2 p-4">
      <p className="text-sm font-semibold">Arkadaşını davet et</p>
      <div className="flex gap-2">
        <input readOnly value={url} className="input py-2 text-xs" onFocus={(e) => e.target.select()} />
        <button className="btn-primary px-3" onClick={copy}>
          {copied ? '✓' : 'Kopyala'}
        </button>
      </div>
      <p className="text-xs text-white/40">Bu linki gönder; karşı taraf açınca oyun başlar.</p>
    </div>
  );
}

function WaitingOverlay({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/r/${roomId}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="absolute inset-0 grid place-items-center rounded-2xl bg-black/55 backdrop-blur-sm">
      <div className="card max-w-xs p-6 text-center">
        <div className="mb-2 text-3xl">⏳</div>
        <p className="font-semibold">Rakip bekleniyor…</p>
        <p className="mt-1 text-xs text-white/50">Linki paylaş, karşı taraf bağlanınca başlıyoruz.</p>
        <button
          className="btn-primary mt-3 w-full"
          onClick={() =>
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? '✓ Kopyalandı' : 'Davet linkini kopyala'}
        </button>
      </div>
    </div>
  );
}
