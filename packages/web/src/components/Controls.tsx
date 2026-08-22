// Action bar — shows exactly the moves available in the current phase.

import { useState } from 'react';
import { ArrowRight, Dices, Eye, Trophy, Undo2 } from 'lucide-react';
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
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-cream/45">
        <Eye size={15} /> İzleyici modundasın
      </p>
    );
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
        <p className="flex items-center justify-center gap-2 font-display text-[22px] font-semibold tracking-[-0.02em]">
          {won && <Trophy size={19} className="text-accent" />}
          {won ? 'Maçı kazandın' : 'Maç bitti'}
        </p>
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
          Sıradaki oyun <ArrowRight size={15} />
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
              <Dices size={16} /> Açılış zarını at
            </button>
          ) : (
            <p className="text-center text-sm text-cream/60">Rakibin zarı bekleniyor…</p>
          )}
          {game.openingRolls.white !== null &&
            game.openingRolls.black !== null &&
            game.openingRolls.white === game.openingRolls.black && (
              <p className="text-center text-xs text-accent">Berabere! Tekrar atın.</p>
            )}
        </>
      )}

      {game.phase === 'toRoll' && (
        <>
          {yourTurn ? (
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={() => onAction({ type: 'roll' })}>
                <Dices size={16} /> Zar at
              </button>
              {canDouble && (
                <button className="btn-ghost" onClick={() => onAction({ type: 'double' })}>
                  ×2
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-cream/60">Rakip zar atıyor…</p>
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
            <p className="text-center text-sm text-cream/60">Çift teklif ettin, yanıt bekleniyor…</p>
          )}
        </>
      )}

      {game.phase === 'moving' && (
        <>
          {yourTurn ? (
            <div className="space-y-2">
              {view.mustPass ? (
                <p className="text-center text-sm text-accent">Oynanacak hamle yok — sıra geçiyor…</p>
              ) : (
                <p className="text-center text-sm text-cream/70">Taşını seç ve oyna</p>
              )}
              {game.movesThisTurn.length > 0 && !view.mustPass && (
                <button className="btn-ghost w-full" onClick={() => onAction({ type: 'undo' })}>
                  <Undo2 size={15} /> Geri al
                </button>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-cream/60">Rakip oynuyor…</p>
          )}
        </>
      )}

      {/* resign */}
      <div className="pt-1 text-center">
        {confirmResign ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-cream/60">Emin misin?</span>
            <button className="text-rose-400 hover:underline" onClick={() => onAction({ type: 'resign' })}>
              Evet, pes et
            </button>
            <button className="text-cream/60 hover:underline" onClick={() => setConfirmResign(false)}>
              Vazgeç
            </button>
          </div>
        ) : (
          <button className="text-[11px] text-cream/30 transition-colors hover:text-danger" onClick={() => setConfirmResign(true)}>
            Pes et
          </button>
        )}
      </div>
    </div>
  );
}
