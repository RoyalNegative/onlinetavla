import { useEffect, useState } from 'react';
import type { BattleshipView, DamaView, TavlaView } from '@tavla/engine';
import { BattleshipBoard } from '../components/BattleshipBoard';
import { BattleshipPanel } from '../components/BattleshipPanel';
import { Board } from '../components/Board';
import { Chat } from '../components/Chat';
import { Controls } from '../components/Controls';
import { DamaBoard } from '../components/DamaBoard';
import { DamaPanel } from '../components/DamaPanel';
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
  const nickname = useStore((s) => s.nickname);
  const setNickname = useStore((s) => s.setNickname);
  const hasName = nickname.trim().length > 0;

  useEffect(() => {
    if (connected && hasName) void joinRoom(roomId);
  }, [roomId, connected, hasName, joinRoom]);

  useGameEffects(update);

  const inThisRoom = update?.room.roomId === roomId;
  const yourTurn = !!update?.view.yourTurn;
  const isDama = update?.room.gameId === 'dama';
  const isAmiral = update?.room.gameId === 'amiral';
  // Only read inside the inThisRoom branch, where `update` is non-null.
  const tview = update?.view as TavlaView;
  const dview = update?.view as DamaView;
  const bview = update?.view as BattleshipView;

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

      {!hasName ? (
        <NameGate onSubmit={setNickname} />
      ) : !inThisRoom ? (
        <div className="grid flex-1 place-items-center text-white/50">Odaya bağlanılıyor…</div>
      ) : (
        <main className="grid flex-1 items-start gap-3 px-2 pb-6 sm:gap-4 sm:px-6 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_340px]">
          <div
            className={`relative mx-auto w-full rounded-2xl transition-shadow ${yourTurn ? 'ring-2 ring-amber-glow/70 shadow-[0_0_30px_rgba(245,177,76,0.25)]' : ''}`}
            // Cap the board so it fits the viewport on landscape phones.
            style={{ maxWidth: isAmiral ? '900px' : isDama ? 'calc(100dvh - 150px)' : 'calc((100dvh - 150px) * 5 / 3)' }}
          >
            {isAmiral ? (
              <BattleshipBoard view={bview} onAction={sendAction} />
            ) : isDama ? (
              <DamaBoard view={dview} interactive={dview.yourTurn && dview.legalMoves.length > 0} onAction={sendAction} />
            ) : (
              <Board
                view={tview}
                interactive={tview.yourTurn && tview.game.phase === 'moving' && tview.legalMoves.length > 0}
                onAction={sendAction}
              />
            )}
            {update.room.status === 'waiting' && <WaitingOverlay roomId={roomId} />}
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            {isAmiral ? (
              <BattleshipPanel
                view={bview}
                players={update.room.players}
                youSeat={update.you.seat}
                onResign={() => sendAction({ type: 'resign' })}
                onRematch={voteRematch}
                rematch={update.room.rematch}
              />
            ) : isDama ? (
              <DamaPanel
                view={dview}
                players={update.room.players}
                youSeat={update.you.seat}
                onResign={() => sendAction({ type: 'resign' })}
                onRematch={voteRematch}
                rematch={update.room.rematch}
              />
            ) : (
              <>
                <PlayerPanel view={tview} players={update.room.players} youSeat={update.you.seat} />
                {/* On phones the action bar jumps above the player panel — it's what you reach for. */}
                <div className="card -order-1 p-4 md:order-none">
                  <Controls view={tview} onAction={sendAction} onRematch={voteRematch} rematch={update.room.rematch} />
                </div>
              </>
            )}
            {update.room.status === 'waiting' && <InvitePanel roomId={roomId} />}
            <Chat messages={update.room.chat} onSend={sendChat} />
          </aside>
        </main>
      )}
    </div>
  );
}

function NameGate({ onSubmit }: { onSubmit: (n: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="grid flex-1 place-items-center px-4">
      <div className="card w-full max-w-sm space-y-3 p-6 text-center">
        <div className="text-3xl">👋</div>
        <p className="text-lg font-bold">Oyuna katıl</p>
        <p className="text-sm text-white/50">Bir takma ad gir, hemen başlayalım.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = name.trim();
            if (v) onSubmit(v);
          }}
          className="space-y-3"
        >
          <input autoFocus className="input text-center" value={name} onChange={(e) => setName(e.target.value)} placeholder="ör. Kaan" maxLength={20} />
          <button type="submit" className="btn-primary w-full" disabled={!name.trim()}>
            Katıl
          </button>
        </form>
      </div>
    </div>
  );
}

// Native share sheet on phones (WhatsApp/Telegram in one tap), clipboard elsewhere.
// Returns true when the link was copied (caller shows "copied" feedback).
async function shareInviteLink(url: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'OnlineTavla', text: 'Gel tavla oynayalım! 🎲', url });
      return false;
    } catch {
      return false; // user closed the sheet — nothing to confirm
    }
  }
  await navigator.clipboard.writeText(url);
  return true;
}

function InvitePanel({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/r/${roomId}`;
  const [copied, setCopied] = useState(false);

  function share() {
    void shareInviteLink(url).then((didCopy) => {
      if (!didCopy) return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="card space-y-2 p-4">
      <p className="text-sm font-semibold">Arkadaşını davet et</p>
      <div className="flex gap-2">
        <input readOnly value={url} className="input py-2 text-base sm:text-sm" onFocus={(e) => e.target.select()} />
        <button className="btn-primary px-3" onClick={share}>
          {copied ? '✓' : 'Paylaş'}
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
    <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-black/55 backdrop-blur-sm">
      <div className="card max-w-xs p-6 text-center">
        <div className="mb-2 text-3xl">⏳</div>
        <p className="font-semibold">Rakip bekleniyor…</p>
        <p className="mt-1 text-xs text-white/50">Linki paylaş, karşı taraf bağlanınca başlıyoruz.</p>
        <button
          className="btn-primary mt-3 w-full"
          onClick={() =>
            void shareInviteLink(url).then((didCopy) => {
              if (!didCopy) return;
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? '✓ Kopyalandı' : 'Davet linkini paylaş'}
        </button>
      </div>
    </div>
  );
}
