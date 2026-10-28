/**
 * Real web search for the in-simulator browser.
 *
 * Search engines such as Google or Bing refuse to be embedded in iframes
 * (X-Frame-Options), so pretending to frame them would show a blank box.
 * Instead this service queries the Wikipedia APIs, which explicitly allow
 * cross-origin requests (`origin=*`), and renders genuine results inside the
 * simulator. Every result links to a real page, and one-click buttons open
 * the query in a real browser tab on the major engines for full web search.
 */

export interface WebResult {
  title: string;
  snippet: string;
  url: string;
  wordCount?: number;
}

export interface SearchSummary {
  title: string;
  extract: string;
  thumbnail?: string;
  url: string;
}

export interface SearchResponse {
  query: string;
  results: WebResult[];
  summary?: SearchSummary;
  /** Set when the network request could not complete. */
  error?: 'network' | 'empty';
}

export function wikiBase(lang: string): string {
  return lang === 'fa' ? 'https://fa.wikipedia.org' : 'https://en.wikipedia.org';
}

export function pageUrl(lang: string, title: string): string {
  return `${wikiBase(lang)}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function searchWeb(query: string, lang: string, signal?: AbortSignal): Promise<SearchResponse> {
  const term = query.trim();
  if (!term) return { query: term, results: [], error: 'empty' };
  try {
    const searchUrl =
      `${wikiBase(lang)}/w/api.php?action=query&list=search&format=json&origin=*&srlimit=8` +
      `&srsearch=${encodeURIComponent(term)}`;
    const payload = (await getJson(searchUrl, signal)) as {
      query?: { search?: { title: string; snippet: string; wordcount?: number }[] };
    };
    const raw = payload.query?.search ?? [];
    const results: WebResult[] = raw.map((item) => ({
      title: item.title,
      snippet: stripHtml(item.snippet),
      url: pageUrl(lang, item.title),
      wordCount: item.wordcount,
    }));
    if (results.length === 0) return { query: term, results, error: 'empty' };

    let summary: SearchSummary | undefined;
    try {
      const summaryUrl = `${wikiBase(lang)}/api/rest_v1/page/summary/${encodeURIComponent(results[0].title.replace(/ /g, '_'))}`;
      const data = (await getJson(summaryUrl, signal)) as {
        title?: string;
        extract?: string;
        thumbnail?: { source?: string };
      };
      if (data.extract) {
        summary = {
          title: data.title ?? results[0].title,
          extract: data.extract,
          thumbnail: data.thumbnail?.source,
          url: pageUrl(lang, data.title ?? results[0].title),
        };
      }
    } catch {
      summary = undefined; // summary is best-effort
    }
    return { query: term, results, summary };
  } catch {
    return { query: term, results: [], error: 'network' };
  }
}

export async function suggestWeb(query: string, lang: string, signal?: AbortSignal): Promise<string[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  try {
    const url =
      `${wikiBase(lang)}/w/api.php?action=opensearch&format=json&origin=*&limit=6` +
      `&search=${encodeURIComponent(term)}`;
    const payload = (await getJson(url, signal)) as [string, string[]];
    return Array.isArray(payload[1]) ? payload[1] : [];
  } catch {
    return [];
  }
}

/** Honest escape hatches: run the same query on the real web, in a real tab. */
export const EXTERNAL_ENGINES: { id: string; label: string; build: (q: string) => string }[] = [
  { id: 'google', label: 'Google', build: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  { id: 'bing', label: 'Bing', build: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  { id: 'duckduckgo', label: 'DuckDuckGo', build: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  { id: 'youtube', label: 'YouTube', build: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
];

export function openExternalSearch(build: (q: string) => string, query: string): void {
  window.open(build(query), '_blank', 'noopener,noreferrer');
}
