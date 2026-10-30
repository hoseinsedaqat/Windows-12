import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCw, ArrowDown, ChevronsDown, RotateCcw } from 'lucide-react';
import {
  createTetris,
  ghostPiece,
  hardDrop,
  movePiece,
  rotatePiece,
  shapeOf,
  startTetris,
  TETRO_COLORS,
  tickInterval,
  tickTetris,
  type TetrisState,
  type Tetromino,
} from '../../core/games/tetris';
import { getKV, setKV } from '../../services/db';
import { playSound } from '../../services/sound';
import { useT } from '../../i18n';

const BEST_KEY = 'games.tetris.best';

export default function TetrisApp() {
  const { t } = useT();
  const [state, setState] = useState<TetrisState>(() => createTetris());
  const [best, setBest] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    getKV<number>(BEST_KEY).then((value) => setBest(value ?? 0)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (state.score > best) {
      setBest(state.score);
      void setKV(BEST_KEY, state.score).catch(() => undefined);
    }
  }, [state.score, best]);

  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const id = window.setInterval(() => {
      setState((current) => tickTetris(current));
    }, tickInterval(state.level));
    return () => window.clearInterval(id);
  }, [state.status, state.level]);

  const handleKey = useCallback((event: KeyboardEvent) => {
    const current = stateRef.current;
    if (current.status !== 'running') {
      if (event.code === 'Space' || event.key === 'Enter') setState((value) => (value.status === 'over' || value.status === 'idle' ? startTetris(value) : value));
      return;
    }
    switch (event.key) {
      case 'ArrowLeft': event.preventDefault(); setState((value) => movePiece(value, -1, 0)); break;
      case 'ArrowRight': event.preventDefault(); setState((value) => movePiece(value, 1, 0)); break;
      case 'ArrowDown': event.preventDefault(); setState((value) => movePiece(value, 0, 1)); break;
      case 'ArrowUp': event.preventDefault(); setState((value) => rotatePiece(value, 1)); break;
      case 'z': case 'Z': setState((value) => rotatePiece(value, -1)); break;
      case ' ': event.preventDefault(); setState((value) => { const next = hardDrop(value); if (next !== value) playSound('snap'); return next; }); break;
      case 'p': case 'P': setState((value) => ({ ...value, status: 'paused' })); break;
      default: break;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // board + active piece + ghost merged for rendering
  const render: (Tetromino | 'ghost' | null)[][] = state.board.map((row) => [...row]);
  const ghost = ghostPiece(state);
  if (ghost && ghost !== state.current) {
    const shape = shapeOf(ghost);
    for (let row = 0; row < shape.length; row += 1) {
      for (let col = 0; col < shape[row].length; col += 1) {
        if (!shape[row][col]) continue;
        const y = ghost.y + row;
        const x = ghost.x + col;
        if (y >= 0 && y < render.length && x >= 0 && x < state.cols && !render[y][x]) render[y][x] = 'ghost';
      }
    }
  }
  if (state.current) {
    const shape = shapeOf(state.current);
    for (let row = 0; row < shape.length; row += 1) {
      for (let col = 0; col < shape[row].length; col += 1) {
        if (!shape[row][col]) continue;
        const y = state.current.y + row;
        const x = state.current.x + col;
        if (y >= 0 && y < render.length && x >= 0 && x < state.cols) render[y][x] = state.current.type;
      }
    }
  }

  const nextShape = shapeOf({ type: state.next, x: 0, y: 0, rot: 0 });

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-4 p-4">
      <div className="flex flex-col items-center gap-2">
        <div
          className="grid gap-px rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1"
          style={{ gridTemplateColumns: `repeat(${state.cols}, 22px)` }}
          role="img"
          aria-label={t('tetris.board')}
        >
          {render.flatMap((row, y) =>
            row.map((cell, x) => (
              <div
                key={`${x}-${y}`}
                className="h-[22px] w-[22px] rounded-[3px]"
                style={{
                  background:
                    cell === null
                      ? 'rgba(148,163,184,0.08)'
                      : cell === 'ghost'
                        ? 'rgba(148,163,184,0.22)'
                        : TETRO_COLORS[cell],
                  boxShadow: cell && cell !== 'ghost' ? 'inset 0 -2px 0 rgba(0,0,0,0.25)' : undefined,
                }}
              />
            )),
          )}
        </div>
        {state.status === 'over' ? <p className="text-[12px] font-semibold text-rose-500">{t('tetris.gameOver')}</p> : null}
        {state.status === 'paused' ? <p className="text-[12px] font-semibold opacity-70">{t('tetris.paused')}</p> : null}
      </div>

      <div className="flex w-44 shrink-0 flex-col gap-3">
        <div className="panel p-2.5">
          <p className="text-[10px] uppercase opacity-55">{t('tetris.next')}</p>
          <div className="mt-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${nextShape[0]?.length ?? 2}, 14px)` }}>
            {nextShape.flatMap((row, y) =>
              row.map((cell, x) => (
                <div key={`${x}-${y}`} className="h-[14px] w-[14px] rounded-[2px]" style={{ background: cell ? TETRO_COLORS[state.next] : 'transparent' }} />
              )),
            )}
          </div>
        </div>
        <div className="panel space-y-1 p-2.5 text-[12px] tabular-nums">
          <p className="flex justify-between"><span className="opacity-55">{t('tetris.score')}</span><span className="font-semibold">{state.score}</span></p>
          <p className="flex justify-between"><span className="opacity-55">{t('tetris.best')}</span><span className="font-semibold">{best}</span></p>
          <p className="flex justify-between"><span className="opacity-55">{t('tetris.lines')}</span><span>{state.lines}</span></p>
          <p className="flex justify-between"><span className="opacity-55">{t('tetris.level')}</span><span>{state.level}</span></p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="win-button win-button-accent text-[11.5px]"
            onClick={() => setState((value) => (value.status === 'running' ? { ...value, status: 'paused' } : startTetris(value)))}
          >
            {state.status === 'running' ? <Pause size={13} /> : <Play size={13} />}
            {state.status === 'running' ? t('tetris.pause') : t('tetris.start')}
          </button>
          <button type="button" className="win-button text-[11.5px]" onClick={() => setState((value) => rotatePiece(value, 1))} title={t('tetris.rotate')}>
            <RotateCw size={13} />
          </button>
          <button type="button" className="win-button text-[11.5px]" onClick={() => setState((value) => rotatePiece(value, -1))} title={t('tetris.rotateBack')}>
            <RotateCcw size={13} />
          </button>
          <button type="button" className="win-button text-[11.5px]" onClick={() => setState((value) => movePiece(value, 0, 1))} title={t('tetris.softDrop')}>
            <ArrowDown size={13} />
          </button>
          <button type="button" className="win-button col-span-2 text-[11.5px]" onClick={() => setState((value) => hardDrop(value))} title={t('tetris.hardDrop')}>
            <ChevronsDown size={13} /> {t('tetris.hardDrop')}
          </button>
        </div>
        <p className="text-[10px] leading-relaxed opacity-50">{t('tetris.hint')}</p>
      </div>
    </div>
  );
}
