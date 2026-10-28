import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import { useT } from '../../i18n';
import { createSnake, step, steer, togglePause, type Direction, type SnakeState } from '../../core/games/snake';
import { getKV, setKV } from '../../services/db';

const BEST_KEY = 'games.snake.best';
const GRID = 20;
const CELL = 20;

export function SnakeApp(_props: AppWindowProps) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<SnakeState>(createSnake(GRID));
  const [ui, setUi] = useState({ score: 0, status: 'idle' as SnakeState['status'], best: 0 });

  const sync = useCallback(() => {
    const state = stateRef.current;
    setUi((current) => ({ ...current, score: state.score, status: state.status }));
  }, []);

  useEffect(() => {
    getKV<number>(BEST_KEY).then((value) => setUi((current) => ({ ...current, best: value ?? 0 }))).catch(() => undefined);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const state = stateRef.current;
    ctx.fillStyle = '#06251c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
    if (state.food.x >= 0) {
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.arc(state.food.x * CELL + CELL / 2, state.food.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
      ctx.fill();
    }
    state.snake.forEach((point, index) => {
      ctx.fillStyle = index === 0 ? '#86efac' : '#4ade80';
      ctx.fillRect(point.x * CELL + 1, point.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  useEffect(() => {
    draw();
    let timer = 0;
    const loop = () => {
      const state = stateRef.current;
      if (state.status === 'running') {
        const next = step(state);
        stateRef.current = next;
        if (next.status === 'over') {
          setUi((current) => {
            const best = Math.max(current.best, next.score);
            void setKV(BEST_KEY, best);
            return { score: next.score, status: 'over', best };
          });
        } else {
          sync();
        }
        draw();
      }
      timer = window.setTimeout(loop, stateRef.current.speed);
    };
    timer = window.setTimeout(loop, stateRef.current.speed);
    return () => window.clearTimeout(timer);
  }, [draw, sync]);

  const onKey = useCallback(
    (event: React.KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        s: 'down',
        a: 'left',
        d: 'right',
      };
      const dir = map[event.key];
      if (dir) {
        event.preventDefault();
        event.stopPropagation();
        stateRef.current = steer(stateRef.current, dir);
        if (stateRef.current.status === 'idle') stateRef.current = togglePause(stateRef.current);
        sync();
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        stateRef.current = togglePause(stateRef.current);
        sync();
      }
    },
    [sync],
  );

  const restart = () => {
    stateRef.current = createSnake(GRID);
    sync();
    draw();
  };

  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-3 overflow-auto bg-[var(--surface-solid)] p-4" tabIndex={0} onKeyDown={onKey}>
      <div className="flex w-full max-w-[420px] items-center justify-between text-[13px] tabular-nums">
        <span>{t('games.score')}: <b>{ui.score}</b></span>
        <span className="opacity-70">{t('games.best')}: {ui.best}</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={GRID * CELL} height={GRID * CELL} className="rounded-md ring-1 ring-black/30" />
        {ui.status !== 'running' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md bg-black/60 text-white">
            <span className="text-[15px] font-semibold">{ui.status === 'over' ? t('games.gameOver') : ui.status === 'paused' ? t('games.paused') : t('snake.title')}</span>
            <span className="text-[11.5px] opacity-80">{t('games.snakeHint')}</span>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                className="win-button h-8 px-3 text-[12px]"
                onClick={() => {
                  stateRef.current = togglePause(stateRef.current);
                  sync();
                }}
              >
                {ui.status === 'over' ? '' : ui.status === 'paused' ? <><Play size={13} /> {t('games.resume')}</> : <><Pause size={13} /> {t('games.pause')}</>}
              </button>
              <button type="button" className="win-button h-8 px-3 text-[12px]" onClick={restart}>
                <RotateCw size={13} /> {t('games.newGame')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <span />
        <button type="button" className="icon-button h-9 w-9" onClick={() => { stateRef.current = steer(toggleIfIdle(stateRef.current), 'up'); sync(); }} aria-label="up"><ArrowUp size={16} /></button>
        <span />
        <button type="button" className="icon-button h-9 w-9" onClick={() => { stateRef.current = steer(toggleIfIdle(stateRef.current), 'left'); sync(); }} aria-label="left"><ArrowLeft size={16} /></button>
        <button type="button" className="icon-button h-9 w-9" onClick={() => { stateRef.current = togglePause(stateRef.current); sync(); }} aria-label="pause"><Pause size={16} /></button>
        <button type="button" className="icon-button h-9 w-9" onClick={() => { stateRef.current = steer(toggleIfIdle(stateRef.current), 'right'); sync(); }} aria-label="right"><ArrowRight size={16} /></button>
        <span />
        <button type="button" className="icon-button h-9 w-9" onClick={() => { stateRef.current = steer(toggleIfIdle(stateRef.current), 'down'); sync(); }} aria-label="down"><ArrowDown size={16} /></button>
        <span />
      </div>
    </div>
  );
}

function toggleIfIdle(state: SnakeState): SnakeState {
  return state.status === 'idle' ? togglePause(state) : state;
}

export default SnakeApp;
