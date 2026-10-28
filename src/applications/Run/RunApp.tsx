import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerDownLeft, History, Search, TerminalSquare, X } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import { useT } from '../../i18n';
import { runCommand } from '../../core/CommandManager';
import { searchApps, listedApps } from '../../core/ApplicationRegistry';
import { SHELL_FOLDERS } from '../../services/launcher';
import { AppIcon } from '../../components/icons/AppIcons';
import { getKV, setKV } from '../../services/db';
import { useWindowStore } from '../../stores/windowStore';

const RECENT_KEY = 'run.recent.v1';

const EXAMPLES = ['calc', 'notepad', 'explorer', 'documents', 'terminal', 'settings', 'word', 'excel', 'chrome', 'taskmgr', 'https://example.com'];

export function RunApp({ windowId }: AppWindowProps) {
  const { t } = useT();
  const [value, setValue] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  useEffect(() => {
    inputRef.current?.focus();
    void getKV<string[]>(RECENT_KEY).then((stored) => {
      if (Array.isArray(stored)) setRecent(stored);
    });
  }, []);

  const suggestions = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) return [];
    const apps = searchApps(needle).slice(0, 6).map((hit) => ({ kind: 'app' as const, id: hit.app.id, label: hit.app.name, hint: hit.app.category }));
    const folders = Object.keys(SHELL_FOLDERS)
      .filter((key) => key.includes(needle))
      .slice(0, 4)
      .map((key) => ({ kind: 'folder' as const, id: key, label: key, hint: SHELL_FOLDERS[key] }));
    return [...apps, ...folders].slice(0, 8);
  }, [value]);

  useEffect(() => setIndex(0), [suggestions.length]);

  const run = (raw: string) => {
    const input = raw.trim();
    if (!input) return;
    const result = runCommand(input);
    const next = [input, ...recent.filter((item) => item !== input)].slice(0, 12);
    setRecent(next);
    void setKV(RECENT_KEY, next);
    if (result.ok) {
      setError(null);
      closeWindow(windowId);
    } else {
      setError(t('run.notFound', { input }));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const suggestion = suggestions[index];
      run(suggestion && value.trim() ? suggestion.id : value);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIndex((current) => Math.min(suggestions.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeWindow(windowId);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] p-4 text-[var(--text)]">
      <p className="mb-1 text-[13px] font-semibold">{t('run.title')}</p>
      <p className="mb-3 text-[11.5px] opacity-60">{t('run.hint')}</p>

      <div className="relative">
        <Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 opacity-50" />
        <input
          ref={inputRef}
          className="win-input h-10 ps-9 text-[13px]"
          value={value}
          dir="ltr"
          placeholder="calc, documents, https://…"
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          aria-label={t('run.inputLabel')}
        />
      </div>

      {error ? <p className="mt-2 text-[11.5px] text-red-500">{error}</p> : null}

      {suggestions.length ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-[var(--border)]">
          {suggestions.map((suggestion, suggestionIndex) => (
            <button
              key={`${suggestion.kind}-${suggestion.id}`}
              type="button"
              className={`list-row w-full gap-2 ${suggestionIndex === index ? 'bg-[var(--accent-soft)]' : ''}`}
              onMouseEnter={() => setIndex(suggestionIndex)}
              onClick={() => run(suggestion.id)}
            >
              {suggestion.kind === 'app' ? <AppIcon appId={suggestion.id} size={16} /> : <TerminalSquare size={15} className="opacity-60" />}
              <span className="min-w-0 flex-1 text-start">
                <span className="block truncate text-[12.5px]">{suggestion.label}</span>
                <span className="block truncate text-[10.5px] opacity-55">{suggestion.hint}</span>
              </span>
              <CornerDownLeft size={12} className="opacity-40" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto">
        {recent.length ? (
          <>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-55">
              <History size={12} /> {t('run.recent')}
            </p>
            {recent.map((item) => (
              <button key={item} type="button" className="list-row w-full justify-between text-[12px]" onClick={() => run(item)}>
                <span className="truncate font-mono" dir="ltr">
                  {item}
                </span>
                <X
                  size={12}
                  className="opacity-40 hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    const next = recent.filter((entry) => entry !== item);
                    setRecent(next);
                    void setKV(RECENT_KEY, next);
                  }}
                />
              </button>
            ))}
          </>
        ) : null}

        <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('run.examples')}</p>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button key={example} type="button" className="rounded-full border border-[var(--border)] px-2 py-0.5 font-mono text-[11px] transition hover:bg-[var(--hover)]" onClick={() => run(example)} dir="ltr">
              {example}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[10.5px] leading-relaxed opacity-50">
          {t('run.simulatedNote')} · {listedApps().length} apps registered
        </p>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="win-button" onClick={() => closeWindow(windowId)}>
          {t('common.cancel')}
        </button>
        <button type="button" className="win-button win-button-accent" onClick={() => run(value)}>
          {t('run.run')}
        </button>
      </div>
    </div>
  );
}

export default RunApp;
