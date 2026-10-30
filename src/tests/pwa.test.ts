import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** PWA assets ship correctly: manifest parses, icons referenced exist, sw handles fetch. */
describe('pwa', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));

  it('manifest is valid and standalone', () => {
    expect(manifest.name).toContain('Windows 12 Concept');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
  });

  it('service worker precaches the shell and answers navigations offline', () => {
    const sw = readFileSync('public/sw.js', 'utf8');
    expect(sw).toContain("addEventListener('fetch'");
    expect(sw).toContain("addEventListener('install'");
    expect(sw).toContain('./index.html');
    expect(sw).toContain('caches.match');
  });

  it('index.html links the manifest and icons exist', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('manifest.webmanifest');
    for (const icon of manifest.icons as { src: string }[]) {
      readFileSync(`public/${icon.src.replace('./', '')}`);
    }
  });
});
