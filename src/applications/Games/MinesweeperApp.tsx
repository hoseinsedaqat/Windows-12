import { useCallback, useEffect, useMemo, useState } from 'react';
import { Smile, Frown, Laugh, Flag, RotateCw } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import { useT } from '../../i18n';
import {
  createBoard,
  reveal,
  toggleFlag,
  chord,
  flagsLeft,
  DIFFICULTIES,
  type MineBoard,
  type Difficulty,
} from '../../core/games/minesweeper';
import { getKV, setKV } from '../../services/db';

const BEST_KEY = 'games.mines.best';

const CELL_COLORS = ['', '#3b82f6', '#16a34a', '#dc2626', '#7c3aed', '#b45309', '#0d9488', '#111827', '#64748b'];

export function MinesweeperApp(_props: AppWindowProps) {
  const { t } = useT();
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[0]);
  const [board, setBoard] = useState<MineBoard>(() => createBoard(DIFFICULTIES[0].rows, DIFFICULTIES[0].cols, DIFFICULTIES[0].mines));
  const [elapsed, setElapsed] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});

  useEffect(() => {
    getKV<Record<string, number>>(BEST_KEY).then((value) => setBest(value ?? {})).catch(() => setBest({}));
  }, []);

  useEffect(() => {
    if (board.status !== 'playing' || !board.startedAt) return undefined;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - (board.startedAt ?? Date.now())) / 1000)), 500);
    return () => window.clearInterval(timer);
  }, [board.status, board.startedAt]);

  useEffect(() => {
    if (board.status === 'won' && board.startedAt) {
      const seconds = Math.max(1, Math.round((Date.now() - board.startedAt) / 1000));
      const previous = best[difficulty.id];
      if (previous === undefined || seconds < previous) {
        const next = { ...best, [difficulty.id]: seconds };
        setBest(next);
        void setKV(BEST_KEY, next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.status]);

  const reset = useCallback((next: Difficulty = difficulty) => {
    setDifficulty(next);
    setBoard(createBoard(next.rows, next.cols, next.mines));
    setElapsed(0);
  }, [difficulty]);

  const cellSize = difficulty.cols > 20 ? 22 : difficulty.cols > 12 ? 26 : 30;

  const face = board.status === 'lost' ? <Frown size={20} /> : board.status === 'won' ? <Laugh size={20} /> : <Smile size={20} />;

  const grid = useMemo(() => board.cells, [board.cells]);

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3 overflow-auto bg-[var(--surface-solid)] p-4">
      <div className="flex w-full max-w-[520px] items-center justify-between gap-2">
        <select
          className="win-button h-8 px-2 text-[12px]"
          value={difficulty.id}
          onChange={(event) => {
            const next = DIFFICULTIES.find((item) => item.id === event.target.value);
            if (next) reset(next);
          }}
          aria-label={t('games.difficulty')}
        >
          {DIFFICULTIES.map((item) => (
            <option key={item.id} value={item.id}>
              {t(`games.${item.id}`)}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-[13px] tabular-nums">
          <span className="flex items-center gap-1" title={t('games.flagsLeft')}>
            <Flag size={13} className="text-red-500" /> {flagsLeft(board)}
          </span>
          <button type="button" className="icon-button h-8 w-8" onClick={() => reset()} title={t('games.newGame')} aria-label={t('games.newGame')}>
            {face}
          </button>
          <span title={t('games.time')}>⏱ {elapsed}s</span>
        </div>
      </div>

      <div
        className="grid gap-[2px] rounded-md bg-[var(--surface-2)] p-2"
        style={{ gridTemplateColumns: `repeat(${difficulty.cols}, ${cellSize}px)` }}
        onContextMenu={(event) => event.preventDefault()}
      >
        {grid.map((cell, index) => (
          <button
            type="button"
            key={index}
            className={`flex items-center justify-center rounded-[3px] text-[12px] font-bold ${
              cell.revealed ? 'bg-[var(--hover)]' : 'bg-[var(--accent-soft)] hover:brightness-110'
            }`}
            style={{ width: cellSize, height: cellSize, color: CELL_COLORS[cell.adjacent] }}
            onClick={() => setBoard((current) => reveal(current, index))}
            onDoubleClick={() => setBoard((current) => chord(current, index))}
            onContextMenu={(event) => {
              event.preventDefault();
              setBoard((current) => toggleFlag(current, index));
            }}
            aria-label={`cell ${index}`}
          >
            {cell.revealed ? (cell.mine ? '💥' : cell.adjacent > 0 ? cell.adjacent : '') : cell.flagged ? '🚩' : ''}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[12px] opacity-75">
        <RotateCw size={12} />
        <span>{t('games.minesHint')}</span>
      </div>

      {board.status === 'won' || board.status === 'lost' ? (
        <div className="panel flex items-center gap-3 px-4 py-2 text-[13px]">
          <span className="font-semibold">{board.status === 'won' ? t('games.youWin') : t('games.gameOver')}</span>
          {board.status === 'won' ? <span className="tabular-nums opacity-70">{elapsed}s</span> : null}
          {best[difficulty.id] !== undefined ? (
            <span className="opacity-70">{t('games.best')}: {best[difficulty.id]}s</span>
          ) : null}
          <button type="button" className="win-button h-7 px-2 text-[12px]" onClick={() => reset()}>
            {t('games.newGame')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default MinesweeperApp;
