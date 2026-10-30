import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Wand2, ArrowDownToLine } from 'lucide-react';
import {
  autoComplete,
  createKlondike,
  drawStock,
  moveCards,
  SUIT_RED,
  SUIT_SYMBOL,
  type CardSource,
  type KlondikeState,
  type PlayingCard,
} from '../../core/games/solitaire';
import { getKV, setKV } from '../../services/db';
import { useT } from '../../i18n';
import { playSound } from '../../services/sound';

const BEST_KEY = 'games.solitaire.bestMoves';
const DRAG_MIME = 'application/x-win12-solitaire';

const RANK_LABEL = (rank: number) => (rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank));

function CardFace({ card, faceUp, style, className, ...rest }: {
  card: PlayingCard;
  faceUp: boolean;
  style?: React.CSSProperties;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>) {
  return (
    <div
      {...rest}
      style={style}
      className={`absolute w-[62px] select-none rounded-md border shadow-sm ${className ?? ''} ${
        faceUp ? 'border-slate-300 bg-white' : 'border-slate-600 bg-gradient-to-br from-sky-800 to-indigo-900'
      }`}
    >
      {faceUp ? (
        <span
          className="flex h-[84px] flex-col justify-between p-1 text-[13px] font-bold leading-none"
          style={{ color: SUIT_RED[card.suit] ? '#dc2626' : '#0f172a' }}
        >
          <span>{RANK_LABEL(card.rank)}{SUIT_SYMBOL[card.suit]}</span>
          <span className="self-end text-[16px]">{SUIT_SYMBOL[card.suit]}</span>
        </span>
      ) : (
        <span className="flex h-[84px] items-center justify-center text-[18px] text-sky-300/70">✦</span>
      )}
    </div>
  );
}

export default function SolitaireApp() {
  const { t } = useT();
  const [state, setState] = useState<KlondikeState>(() => createKlondike());
  const [best, setBest] = useState<number | null>(null);

  useEffect(() => {
    getKV<number>(BEST_KEY).then((value) => setBest(value ?? null)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (state.won) {
      playSound('notify');
      setBest((current) => {
        const next = current === null ? state.moves : Math.min(current, state.moves);
        void setKV(BEST_KEY, next).catch(() => undefined);
        return next;
      });
    }
  }, [state.won, state.moves]);

  const tryMove = (source: CardSource, target: { type: 'tableau'; pile: number } | { type: 'foundation'; pile: number }) => {
    setState((current) => {
      const next = moveCards(current, source, target);
      if (next) playSound('snap');
      return next ?? current;
    });
  };

  const autoFoundation = (source: CardSource, card: PlayingCard) => {
    setState((current) => {
      for (let pile = 0; pile < 4; pile += 1) {
        const next = moveCards(current, source, { type: 'foundation', pile });
        if (next) {
          playSound('snap');
          return next;
        }
      }
      return current;
    });
    void card;
  };

  const foundationCounts = useMemo(() => state.foundations.map((pile) => pile.length), [state.foundations]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3" onDragOver={(event) => event.preventDefault()}>
      <div className="flex items-center gap-2">
        <button type="button" className="win-button text-[11.5px]" onClick={() => setState(createKlondike())}>
          <RefreshCw size={13} /> {t('solitaire.newGame')}
        </button>
        <button type="button" className="win-button text-[11.5px]" onClick={() => setState((current) => autoComplete(current))}>
          <Wand2 size={13} /> {t('solitaire.autoComplete')}
        </button>
        <span className="ms-auto text-[11.5px] tabular-nums opacity-60">
          {t('solitaire.moves')}: {state.moves}
          {best !== null ? ` · ${t('solitaire.best')}: ${best}` : ''}
        </span>
      </div>

      {/* Stock / waste / foundations */}
      <div className="flex items-start gap-2">
        <div
          className="relative h-[84px] w-[62px] cursor-pointer"
          onClick={() => setState((current) => drawStock(current))}
          role="button"
          aria-label={t('solitaire.draw')}
        >
          {state.stock.length > 0 ? (
            <CardFace card={state.stock[state.stock.length - 1]} faceUp={false} style={{ position: 'absolute', inset: 0 }} />
          ) : (
            <div className="flex h-[84px] w-[62px] items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] opacity-40">
              <RefreshCw size={16} />
            </div>
          )}
        </div>
        <div className="relative h-[84px] w-[62px]">
          {state.waste.length > 0 ? (
            <CardFace
              card={state.waste[state.waste.length - 1]}
              faceUp
              style={{ position: 'absolute', inset: 0 }}
              draggable
              onDragStart={(event) => event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: 'waste' }))}
              onDoubleClick={() => autoFoundation({ type: 'waste' }, state.waste[state.waste.length - 1])}
            />
          ) : null}
        </div>
        <div className="w-6" />
        {state.foundations.map((pile, index) => (
          <div
            key={index}
            className="relative h-[84px] w-[62px]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData(DRAG_MIME);
              if (!raw) return;
              tryMove(JSON.parse(raw) as CardSource, { type: 'foundation', pile: index });
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center rounded-md border border-dashed border-[var(--border-strong)] text-[20px] opacity-30">
              {SUIT_SYMBOL[(['S', 'H', 'D', 'C'] as const)[index]]}
            </div>
            {pile.length > 0 ? (
              <CardFace
                card={pile[pile.length - 1]}
                faceUp
                style={{ position: 'absolute', inset: 0 }}
                draggable
                onDragStart={(event) => event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: 'foundation', pile: index }))}
              />
            ) : null}
            <span className="absolute -bottom-4 w-full text-center text-[9px] tabular-nums opacity-50">{foundationCounts[index]}</span>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="flex min-h-0 flex-1 items-start gap-2 pt-3">
        {state.tableau.map((pile, pileIndex) => (
          <div
            key={pileIndex}
            className="relative w-[62px] flex-1 max-w-[62px]"
            style={{ minHeight: 84 }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const raw = event.dataTransfer.getData(DRAG_MIME);
              if (!raw) return;
              tryMove(JSON.parse(raw) as CardSource, { type: 'tableau', pile: pileIndex });
            }}
          >
            {pile.cards.length === 0 ? (
              <div className="absolute inset-x-0 top-0 h-[84px] rounded-md border border-dashed border-[var(--border-strong)] opacity-30" />
            ) : null}
            {pile.cards.map((card, cardIndex) => {
              const faceUp = cardIndex >= pile.faceUpFrom;
              const isTop = cardIndex === pile.cards.length - 1;
              return (
                <CardFace
                  key={`${card.rank}${card.suit}-${cardIndex}`}
                  card={card}
                  faceUp={faceUp}
                  className={faceUp ? 'cursor-grab' : ''}
                  style={{ top: cardIndex * 22, zIndex: cardIndex, position: 'absolute' }}
                  draggable={faceUp}
                  onDragStart={(event) =>
                    event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ type: 'tableau', pile: pileIndex, cardIndex }))
                  }
                  onDoubleClick={() => {
                    if (isTop && faceUp) autoFoundation({ type: 'tableau', pile: pileIndex, cardIndex }, card);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <button type="button" className="win-button absolute bottom-3 end-3 text-[11px] opacity-70" onClick={() => setState((current) => autoComplete(current))} title={t('solitaire.autoComplete')}>
        <ArrowDownToLine size={12} />
      </button>

      {state.won ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/45">
          <div className="panel p-6 text-center">
            <p className="text-lg font-bold">🎉 {t('solitaire.won')}</p>
            <p className="mt-1 text-[12px] opacity-70">{t('solitaire.moves')}: {state.moves}</p>
            <button type="button" className="win-button win-button-accent mt-4" onClick={() => setState(createKlondike())}>
              {t('solitaire.newGame')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
