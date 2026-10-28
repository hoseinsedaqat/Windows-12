import { describe, expect, it, vi, afterEach } from 'vitest';
import { searchWeb, suggestWeb, stripHtml, pageUrl, EXTERNAL_ENGINES, openExternalSearch } from '../services/websearch';

function mockFetch(handler: (url: string) => unknown) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(handler(url)),
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('websearch', () => {
  it('queries the wikipedia api with origin=* and parses results', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.includes('list=search')) {
        return {
          query: {
            search: [
              { title: 'Operating system', snippet: '<span class="searchmatch">OS</span> software &amp; more', wordcount: 1200 },
            ],
          },
        };
      }
      return { title: 'Operating system', extract: 'An operating system is system software.', thumbnail: { source: 'https://example/x.png' } };
    });
    const response = await searchWeb('operating system', 'en');
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    expect(firstUrl).toContain('action=query');
    expect(firstUrl).toContain('origin=*');
    expect(firstUrl).toContain('srsearch=operating%20system');
    expect(response.error).toBeUndefined();
    expect(response.results).toHaveLength(1);
    expect(response.results[0].title).toBe('Operating system');
    expect(response.results[0].snippet).toContain('OS software & more');
    expect(response.results[0].url).toBe(pageUrl('en', 'Operating system'));
    expect(response.summary?.extract).toContain('system software');
  });

  it('uses the matching language subdomain', async () => {
    const fetchMock = mockFetch(() => ({ query: { search: [] } }));
    await searchWeb('هوش مصنوعی', 'fa');
    expect(fetchMock.mock.calls[0][0]).toContain('fa.wikipedia.org');
  });

  it('strips html entities from snippets', () => {
    expect(stripHtml('<span class="x">a &amp; b &#039;c&#039; &lt;d&gt;</span>')).toBe("a & b 'c' <d>");
  });

  it('reports a network error when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const response = await searchWeb('anything', 'en');
    expect(response.error).toBe('network');
    expect(response.results).toEqual([]);
  });

  it('survives a failing summary call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('rest_v1')) return Promise.reject(new Error('nope'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ query: { search: [{ title: 'T', snippet: 's' }] } }) });
      }),
    );
    const response = await searchWeb('t', 'en');
    expect(response.results).toHaveLength(1);
    expect(response.summary).toBeUndefined();
  });

  it('returns suggestions from opensearch', async () => {
    mockFetch(() => ['query', ['query one', 'query two'], [], []]);
    const suggestions = await suggestWeb('query', 'en');
    expect(suggestions).toEqual(['query one', 'query two']);
    expect(await suggestWeb('q', 'en')).toEqual([]);
  });

  it('builds honest external engine urls and opens them in a real tab', () => {
    const url = EXTERNAL_ENGINES[0].build('hello world');
    expect(url).toBe('https://www.google.com/search?q=hello%20world');
    const open = vi.fn();
    vi.stubGlobal('window', { ...window, open });
    openExternalSearch(EXTERNAL_ENGINES[2].build, 'x y');
    expect(open).toHaveBeenCalledWith('https://duckduckgo.com/?q=x%20y', '_blank', 'noopener,noreferrer');
  });
});
