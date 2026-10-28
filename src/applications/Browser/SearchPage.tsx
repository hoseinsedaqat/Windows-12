import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Globe2, RefreshCw, Search } from 'lucide-react';
import { useT } from '../../i18n';
import { EXTERNAL_ENGINES, openExternalSearch, searchWeb, suggestWeb, type SearchResponse } from '../../services/websearch';
import { useBrowserStore, SEARCH_ENGINES } from '../../stores/browserStore';

/**
 * In-simulator search results. Real results come from the Wikipedia APIs
 * (CORS-enabled); engines that forbid framing are offered as honest
 * open-in-real-tab buttons instead of a blank iframe.
 */
export function SearchPage({ query, onNavigate }: { query: string; onNavigate: (url: string) => void }) {
  const { t, lang } = useT();
  const [input, setInput] = useState(query);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => setInput(query), [query]);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    searchWeb(query, lang, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setResponse(result);
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [query, lang, nonce]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (input.trim().length < 2 || input.trim() === query) {
        setSuggestions([]);
        return;
      }
      suggestWeb(input, lang).then(setSuggestions);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [input, lang, query]);

  const submit = (value: string) => {
    const term = value.trim();
    if (!term) return;
    setSuggestOpen(false);
    onNavigate(`win://search?q=${encodeURIComponent(term)}`);
  };

  const configured = useBrowserStore((state) => state.settings.searchEngine);
  const engines = useMemo(() => {
    const engine = SEARCH_ENGINES.find((item) => item.template === configured);
    const match = engine ? EXTERNAL_ENGINES.find((item) => item.label.toLowerCase() === engine.name.toLowerCase()) : undefined;
    if (!match) return EXTERNAL_ENGINES;
    return [match, ...EXTERNAL_ENGINES.filter((item) => item.id !== match.id)];
  }, [configured]);

  return (
    <div className="h-full overflow-auto bg-[var(--surface-solid)]">
      <div className="mx-auto max-w-[760px] px-5 py-5">
        <div className="relative">
          <form
            className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit(input);
            }}
          >
            <Search size={16} className="opacity-60" />
            <input
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestOpen(false), 160)}
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
              aria-label={t('browser.searchTitle')}
            />
            <button type="submit" className="win-button h-7 px-3 text-[12px]">
              {t('browser.searchTitle')}
            </button>
          </form>
          {suggestOpen && suggestions.length ? (
            <div className="panel absolute inset-x-0 top-full z-10 mt-1 overflow-hidden p-1">
              {suggestions.map((item) => (
                <button key={item} type="button" className="list-row w-full justify-start gap-2 text-[13px]" onMouseDown={() => submit(item)}>
                  <Search size={12} className="opacity-50" /> {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] opacity-75">
          <span>{t('browser.openExternally')}:</span>
          {engines.map((engine) => (
            <button
              key={engine.id}
              type="button"
              className="win-button h-7 gap-1 px-2 text-[11.5px]"
              onClick={() => openExternalSearch(engine.build, query)}
              title={engine.label}
            >
              <ExternalLink size={11} /> {engine.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="animate-pulse space-y-2">
                <div className="h-3 w-40 rounded bg-[var(--hover)]" />
                <div className="h-4 w-72 rounded bg-[var(--hover)]" />
                <div className="h-3 w-full rounded bg-[var(--hover)]" />
              </div>
            ))}
          </div>
        ) : response?.error === 'network' ? (
          <div className="panel mt-6 flex flex-col items-start gap-2 p-4 text-[13px]">
            <span className="font-semibold">{t('browser.searchNetworkError')}</span>
            <span className="opacity-70">{t('browser.searchNetworkHint')}</span>
            <button type="button" className="win-button h-8 gap-1 px-3 text-[12px]" onClick={() => setNonce((value) => value + 1)}>
              <RefreshCw size={12} /> {t('browser.tryAgain')}
            </button>
          </div>
        ) : response && response.results.length === 0 ? (
          <div className="mt-6 text-[13px] opacity-75">{t('browser.noResults', { query })}</div>
        ) : (
          <div className="mt-5 space-y-5">
            {response?.summary ? (
              <button
                type="button"
                className="panel flex w-full items-start gap-3 p-3 text-left"
                onClick={() => onNavigate(response.summary?.url ?? '')}
              >
                {response.summary.thumbnail ? (
                  <img src={response.summary.thumbnail} alt="" className="h-16 w-16 rounded-md object-cover ring-1 ring-[var(--border)]" />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-md bg-[var(--hover)]">
                    <Globe2 size={22} className="opacity-60" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{response.summary.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed opacity-80">{response.summary.extract.slice(0, 320)}</span>
                </span>
              </button>
            ) : null}

            {response?.results.map((result) => (
              <div key={result.url}>
                <button type="button" className="group text-left" onClick={() => onNavigate(result.url)}>
                  <span className="block text-[11.5px] opacity-60">{result.url.replace('https://', '')}</span>
                  <span className="block text-[15.5px] text-[var(--accent)] group-hover:underline">{result.title}</span>
                </button>
                <p className="mt-1 text-[12.5px] leading-relaxed opacity-80">{result.snippet}…</p>
              </div>
            ))}

            <div className="border-t border-[var(--border)] pt-3 text-[11px] opacity-60">{t('browser.resultsFrom')}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
