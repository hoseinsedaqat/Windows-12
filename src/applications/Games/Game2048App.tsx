import { useCallback, useEffect, useState } from 'react';
import { RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import { useT } from '../../i18n';
import { create2048, move, canMove, highestTile, type Board2048, type Move2048 } from '../../core/games/game2048';
import { getKV, setKV } from '../../services/db';

const BEST_KEY = 'games.2048.best';

const TILE_STYLE: Record<number, string> = {
  0: 'bg-[var(--hover)] text-transparent',
  2: 'bg-[#eee4da] text-[#776e65]',
  4: 'bg-[#ede0c8] text-[#776e65]',
  8: 'bg-[#f2b179] text-white',
  16: 'bg-[#f59563] text-white',
  32: 'bg-[#f67c5f] text-white',
  64: 'bg-[#f65e3b] text-white',
  128: 'bg-[#edcf72] text-white',
  256: 'bg-[#edcc61] text-white',
  512: 'bg-[#edc850] text-white',
  1024: 'bg-[#edc53f] text-white',
  2048: 'bg-[#edc22e] text-white',
};

export function Game2048App(_props: AppWindowProps) {
  const { t } = useT();
  const [board, setBoard] = useState<Board2048>(() => create2048());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [won, setWon] = useState(false);

  useEffect(() => {
    getKV<number>(BEST_KEY).then((value) => setBest(value ?? 0)).catch(() => undefined);
  }, []);

  const apply = useCallback(
    (dir: Move2048) => {
      setBoard((current) => {
        const result = move(current, dir);
        if (!result.moved) return current;
        setScore((value) => {
          const next = value + result.score;
          setBest((currentBest) => {
            if (next > currentBest) {
              void setKV(BEST_KEY, next);
              return next;
            }
            return currentBest;
          });
          return next;
        });
        if (highestTile(result.board) >= 2048) setWon(true);
        return result.board;
      });
    },
    [],
  );

  const onKey = useCallback(
    (event: React.KeyboardEvent) => {
      const map: Record<string, Move2048> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
      const dir = map[event.key];
      if (!dir) return;
      event.preventDefault();
      event.stopPropagation();
      apply(dir);
    },
    [apply],
  );

  const over = !canMove(board);

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3 overflow-auto bg-[var(--surface-solid)] p-4" tabIndex={0} onKeyDown={onKey}>
      <div className="flex w-full max-w-[360px] items-center justify-between text-[13px] tabular-nums">
        <span>{t('games.score')}: <b>{score}</b></span>
        <span className="opacity-70">{t('games.best')}: {best}</span>
      </div>
      <div className="relative grid grid-cols-4 gap-2 rounded-lg bg-[#bbada0] p-2">
        {board.map((value, index) => (
          <div
            key={index}
            className={`flex h-[74px] w-[74px] items-center justify-center rounded-md text-[24px] font-bold transition-colors ${TILE_STYLE[value] ?? 'bg-[#3c3a32] text-white'}`}
          >
            {value > 0 ? value : ''}
          </div>
        ))}
        {over || won ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-black/55 text-white">
            <span className="text-[16px] font-semibold">{over ? t('games.gameOver') : t('games.youWin')}</span>
            {won && !over ? <span className="text-[11.5px] opacity-80">{t('games.continueHint')}</span> : null}
            <button type="button" className="win-button h-8 px-3 text-[12px]" onClick={() => { setBoard(create2048()); setScore(0); setWon(false); }}>
              <RotateCw size={13} /> {t('games.newGame')}
            </button>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <span />
        <button type="button" className="icon-button h-9 w-9" onClick={() => apply('up')} aria-label="up"><ArrowUp size={16} /></button>
        <span />
        <button type="button" className="icon-button h-9 w-9" onClick={() => apply('left')} aria-label="left"><ArrowLeft size={16} /></button>
        <button type="button" className="icon-button h-9 w-9" onClick={() => { setBoard(create2048()); setScore(0); setWon(false); }} aria-label="new"><RotateCw size={16} /></button>
        <button type="button" className="icon-button h-9 w-9" onClick={() => apply('right')} aria-label="right"><ArrowRight size={16} /></button>
        <span />
        <button type="button" className="icon-button h-9 w-9" onClick={() => apply('down')} aria-label="down"><ArrowDown size={16} /></button>
        <span />
      </div>
      <span className="text-[11.5px] opacity-65">{t('games.2048Hint')}</span>
    </div>
  );
}

export default Game2048App;
