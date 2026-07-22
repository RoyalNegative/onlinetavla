import { useEffect, useMemo, useRef, useState } from 'react';
import type { BattleshipView, DamaView, DortluView, MangalaView, SHView, TavlaView } from '@tavla/engine';
import { treasuryOf } from '@tavla/engine';
import { AddFriendChip } from '../components/AddFriendChip';
import { BattleshipBoard, useBattleshipFx } from '../components/BattleshipBoard';
import { BattleshipPanel } from '../components/BattleshipPanel';
import { Board } from '../components/Board';
import { Chat } from '../components/Chat';
import { ChatBubbles } from '../components/ChatBubbles';
import { GAME_META } from '../lib/games';
import { Controls } from '../components/Controls';
import { DamaBoard } from '../components/DamaBoard';
import { DamaPanel } from '../components/DamaPanel';
import { DortluBoard } from '../components/DortluBoard';
import { GenericPanel } from '../components/GenericPanel';
import { Header } from '../components/Header';
import { MangalaBoard } from '../components/MangalaBoard';
import { PeerCursors } from '../components/PeerCursors';
import { PlayerPanel } from '../components/PlayerPanel';
import { SecretHitlerBoard, SecretRolePanel } from '../components/SecretHitlerBoard';
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

  const inThisRoom = update?.room.roomId === roomId;
  const roomStatus = update?.room.status;

  // Watchdog: exiting the connect/waiting screens hinges on a single pushed
  // room:update, and a lost push (reconnect race, stale seat socketId) has no
  // other recovery — amiral has no auto-step to re-broadcast, so the creator
  // stayed stuck until the opponent placed their fleet. Re-join every 3s while
  // unhealthy; room:join is idempotent and replies with a fresh snapshot.
  useEffect(() => {
    if (!connected || !hasName) return;
    if (inThisRoom && roomStatus !== 'waiting') return; // healthy
    const t = setInterval(() => void joinRoom(roomId), 3000);
    return () => clearInterval(t);
  }, [roomId, connected, hasName, inThisRoom, roomStatus, joinRoom]);
  const yourTurn = !!update?.view.yourTurn;
  const isDama = update?.room.gameId === 'dama';
  const isAmiral = update?.room.gameId === 'amiral';
  const isMangala = update?.room.gameId === 'mangala';
  const isDortlu = update?.room.gameId === 'dortlu';
  const isSH = update?.room.gameId === 'secrethitler';
  // Only read inside the inThisRoom branch, where `update` is non-null.
  const tview = update?.view as TavlaView;
  const dview = update?.view as DamaView;
  const mview = update?.view as MangalaView;
  const cview = update?.view as DortluView;
  const shview = update?.view as SHView;

  // Amiral: render (and sound) one bomb-flight behind the live view so the
  // result only appears when the bomb lands.
  const { shown: bshownRaw, fx: bfx } = useBattleshipFx(isAmiral && update ? (update.view as BattleshipView) : null);
  const bview = bshownRaw ?? (update?.view as BattleshipView);

  const effectsUpdate = useMemo(
    () => (isAmiral && update && bshownRaw ? { ...update, view: bshownRaw } : update),
    [isAmiral, update, bshownRaw],
  );
  useGameEffects(effectsUpdate);

  const gameMeta = update ? GAME_META[update.room.gameId] : undefined;
  const boardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col">
      <Header
        title={gameMeta?.title}
        right={
          <div className="flex items-center gap-2">
            {/* A word reads cleaner than a bare status dot; only the reconnecting
                state needs to grab attention. */}
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                connected ? 'bg-emerald-400/10 text-emerald-300/90' : 'animate-pulse bg-amber-glow/15 text-amber-glow'
              }`}
            >
              {connected ? 'Bağlı' : 'Bağlanıyor…'}
            </span>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => navigate('/')}>
              Oyundan çık
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
            ref={boardRef}
            className={`relative mx-auto w-full rounded-2xl transition-shadow ${yourTurn ? 'ring-2 ring-amber-glow/70 shadow-[0_0_30px_rgba(245,177,76,0.25)]' : ''}`}
            // Cap the board so it fits the viewport on landscape phones.
            style={{
              maxWidth: isAmiral
                ? '900px'
                : isSH
                  ? '860px'
                  : isMangala
                    ? '760px'
                    : isDortlu
                      ? '560px'
                      : isDama
                        ? 'calc(100dvh - 150px)'
                        : 'calc((100dvh - 150px) * 5 / 3)',
            }}
          >
            {/* Ambient glow in the game's accent color — the board sits in a
                pool of light instead of floating on flat black. */}
            {gameMeta && (
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 -z-10 blur-3xl"
                style={{ background: `radial-gradient(closest-side, ${gameMeta.tint}2b, transparent)` }}
              />
            )}
            {isSH ? (
              <SecretHitlerBoard
                view={shview}
                players={update.room.players}
                youSeat={update.you.seat}
                roomId={roomId}
                onAction={sendAction}
                onRematch={voteRematch}
                rematch={update.room.rematch}
              />
            ) : isAmiral ? (
              <BattleshipBoard view={bview} fx={bfx} onAction={sendAction} />
            ) : isMangala ? (
              <MangalaBoard view={mview} onAction={sendAction} />
            ) : isDortlu ? (
              <DortluBoard view={cview} onAction={sendAction} />
            ) : isDama ? (
              <DamaBoard view={dview} interactive={dview.yourTurn && dview.legalMoves.length > 0} onAction={sendAction} />
            ) : (
              <Board
                view={tview}
                interactive={tview.yourTurn && tview.game.phase === 'moving' && tview.legalMoves.length > 0}
                onAction={sendAction}
              />
            )}
            {/* SH's lobby is its own UI with the invite link built in. */}
            {update.room.status === 'waiting' && !isSH && <WaitingOverlay roomId={roomId} />}
            <PeerCursors containerRef={boardRef} gameId={update.room.gameId} youSeat={update.you.seat} roomId={roomId} />
            <ChatBubbles messages={update.room.chat} selfName={update.you.name} />
          </div>

          <aside className="flex min-h-0 flex-col gap-4">
            {isSH ? (
              <SecretRolePanel
                view={shview}
                nameOf={(seat) => update.room.players.find((p) => p.seat === seat)?.name ?? `Oyuncu ${seat + 1}`}
              />
            ) : isAmiral ? (
              <BattleshipPanel
                view={bview}
                players={update.room.players}
                youSeat={update.you.seat}
                onResign={() => sendAction({ type: 'resign' })}
                onRematch={voteRematch}
                rematch={update.room.rematch}
              />
            ) : isMangala ? (
              <GenericPanel
                heading="Mangala · taş toplama"
                players={update.room.players}
                youSeat={update.you.seat}
                youAre={mview.youAre}
                turn={mview.turn}
                winner={mview.winner}
                over={mview.phase === 'over'}
                lineFor={(c) => `${c === 'white' ? 'Beyaz' : 'Siyah'} · haznede ${mview.pits[treasuryOf(c === 'white' ? 0 : 1)]} taş`}
                playingText="Sıra sende — bir kuyunu seç"
                waitingText="Rakip oynuyor…"
                onResign={() => sendAction({ type: 'resign' })}
                onRematch={voteRematch}
                rematch={update.room.rematch}
              />
            ) : isDortlu ? (
              <GenericPanel
                heading="4'ü Bağla · dörtlü sıra"
                players={update.room.players}
                youSeat={update.you.seat}
                youAre={cview.youAre}
                turn={cview.turn}
                winner={cview.winner}
                over={cview.phase === 'over'}
                lineFor={(c) => `${c === 'white' ? 'Sarı pul' : 'Siyah pul'}`}
                playingText="Sıra sende — bir sütun seç"
                waitingText="Rakip oynuyor…"
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
            {update.room.status === 'waiting' && !isSH && <InvitePanel roomId={roomId} />}
            <AddFriendChip players={update.room.players} youSeat={update.you.seat} />
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

// Copy is the primary action everywhere — one click, no OS dialog in between.
// On phones we additionally offer the native share sheet (WhatsApp/Telegram in
// one tap), where it actually saves steps.
const canNativeShare =
  typeof navigator.share === 'function' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

function useCopy(url: string): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return { copied, copy };
}

function shareNative(url: string): void {
  void navigator.share({ title: 'OnlineTavla', text: 'Gel oynayalım! 🎲', url }).catch(() => {
    /* user closed the sheet */
  });
}

function InvitePanel({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/r/${roomId}`;
  const { copied, copy } = useCopy(url);

  return (
    <div className="card space-y-2 p-4">
      <p className="text-sm font-semibold">Arkadaşını davet et</p>
      <div className="flex gap-2">
        <input readOnly value={url} className="input py-2 text-base sm:text-sm" onFocus={(e) => e.target.select()} />
        <button className="btn-primary px-3" onClick={copy}>
          {copied ? '✓' : 'Kopyala'}
        </button>
        {canNativeShare && (
          <button className="btn-ghost px-3" onClick={() => shareNative(url)} title="Paylaş">
            ↗
          </button>
        )}
      </div>
      <p className="text-xs text-white/40">Bu linki gönder; karşı taraf açınca oyun başlar.</p>
    </div>
  );
}

function WaitingOverlay({ roomId }: { roomId: string }) {
  const url = `${window.location.origin}/r/${roomId}`;
  const { copied, copy } = useCopy(url);
  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-black/55 backdrop-blur-sm">
      <div className="card max-w-xs p-6 text-center">
        <div className="mb-2 text-3xl">⏳</div>
        <p className="font-semibold">Rakip bekleniyor…</p>
        <p className="mt-1 text-xs text-white/50">Linki gönder, karşı taraf bağlanınca başlıyoruz.</p>
        <button className="btn-primary mt-3 w-full" onClick={copy}>
          {copied ? '✓ Kopyalandı' : 'Davet linkini kopyala'}
        </button>
        {canNativeShare && (
          <button className="btn-ghost mt-2 w-full" onClick={() => shareNative(url)}>
            ↗ Uygulamayla paylaş
          </button>
        )}
      </div>
    </div>
  );
}
