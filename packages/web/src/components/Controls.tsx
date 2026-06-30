// Action bar — shows exactly the moves available in the current phase.

import { useState } from 'react';
import type { Action, TavlaView } from '@tavla/engine';

interface Props {
  view: TavlaView;
  onAction: (a: Action) => void;
  onRematch: () => void;
  rematch: { votes: number; needed: number };
}

export function Controls({ view, onAction, onRematch, rematch }: Props) {
  const [confirmResign, setConfirmResign] = useState(false);
  const { game, youAre } = view;
  const spectator = youAre === null;

  if (spectator) {
    return <p className="text-center text-sm text-white/50">İzleyici modundasın 👀</p>;
  }

  const you = youAre;
  const yourTurn = view.yourTurn;
  const cube = game.cube;
  const canDouble =
    !!cube && game.phase === 'toRoll' && yourTurn && (cube.owner === null || cube.owner === you);

  // Match finished
  if (view.matchWinner) {
    const won = view.matchWinner === you;
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-bold">{won ? '🏆 Maçı kazandın!' : 'Maç bitti'}</p>
        <button className="btn-primary w-full" onClick={onRematch}>
          Rövanş ({rematch.votes}/{rematch.needed})
        </button>
      </div>
    );
  }

  // Single game finished, match continues
  if (game.phase === 'gameOver') {
    const r = game.result;
    const label =
      r?.kind === 'backgammon' ? 'Mars + (üç kat)' : r?.kind === 'gammon' ? 'Mars (çift)' : 'Tek';
    return (
      <div className="space-y-3 text-center">
        <p className="font-semibold">
          {r?.winner === you ? 'Bu oyunu kazandın' : 'Bu oyunu rakip aldı'} · {label} · +{r?.points}
        </p>
        <button className="btn-primary w-full" onClick={() => onAction({ type: 'nextGame' })}>
          Sıradaki oyun ▸
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {game.phase === 'opening' && (
        <>
          {game.openingRolls[you] === null ? (
            <button className="btn-primary w-full" onClick={() => onAction({ type: 'roll' })}>
              🎲 Açılış zarını at
            </button>
          ) : (
            <p className="text-center text-sm text-white/60">Rakibin zarı bekleniyor…</p>
          )}
          {game.openingRolls.white !== null &&
            game.openingRolls.black !== null &&
            game.openingRolls.white === game.openingRolls.black && (
              <p className="text-center text-xs text-amber-glow">Berabere! Tekrar atın.</p>
            )}
        </>
      )}

      {game.phase === 'toRoll' && (
        <>
          {yourTurn ? (
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => onAction({ type: 'roll' })}>
                🎲 Zar at
              </button>
              {canDouble && (
                <button className="btn-ghost" onClick={() => onAction({ type: 'double' })}>
                  ×2
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-white/60">Rakip zar atıyor…</p>
          )}
        </>
      )}

      {game.phase === 'doubleOffered' && (
        <>
          {game.doubleOfferedBy !== you ? (
            <div className="space-y-2 text-center">
              <p className="text-sm">Rakip çiftledi (×{(cube?.value ?? 1) * 2}). Kabul?</p>
              <div className="flex gap-2">
                <button className="btn-primary flex-1" onClick={() => onAction({ type: 'takeDouble' })}>
                  Kabul
                </button>
                <button className="btn-danger flex-1" onClick={() => onAction({ type: 'dropDouble' })}>
                  Pas
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-white/60">Çift teklif ettin, yanıt bekleniyor…</p>
          )}
        </>
      )}

      {game.phase === 'moving' && (
        <>
          {yourTurn ? (
            <div className="space-y-2">
              {view.mustPass ? (
                <p className="text-center text-sm text-amber-glow">Oynanacak hamle yok — sıra geçiyor…</p>
              ) : (
                <p className="text-center text-sm text-white/70">Taşını seç ve oyna</p>
              )}
              {game.movesThisTurn.length > 0 && !view.mustPass && (
                <button className="btn-ghost w-full" onClick={() => onAction({ type: 'undo' })}>
                  ↶ Geri al
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-white/60">Rakip oynuyor…</p>
          )}
        </>
      )}

      {/* resign */}
      <div className="pt-1 text-center">
        {confirmResign ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-white/60">Emin misin?</span>
            <button className="text-rose-400 hover:underline" onClick={() => onAction({ type: 'resign' })}>
              Evet, pes et
            </button>
            <button className="text-white/60 hover:underline" onClick={() => setConfirmResign(false)}>
              Vazgeç
            </button>
          </div>
        ) : (
          <button className="text-xs text-white/40 hover:text-rose-400" onClick={() => setConfirmResign(true)}>
            Pes et
          </button>
        )}
      </div>
    </div>
  );
}
