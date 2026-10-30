import { describe, expect, it } from 'vitest';
import { buildPlaylist, formatTimestamp, stepIndex } from '../core/media';
import type { FSNode } from '../types';

const node = (id: string, name: string, kind: FSNode['kind'], dataUrl?: string): FSNode =>
  ({
    id,
    name,
    kind,
    parentId: 'music',
    createdAt: 1,
    updatedAt: 1,
    size: 10,
    content: null,
    metadata: dataUrl ? { dataUrl } : {},
    deleted: false,
  }) as FSNode;

describe('media playlist', () => {
  it('builds a sorted playlist of audio/video nodes only', () => {
    const nodes = {
      a: node('a', 'b.wav', 'audio', 'data:audio/wav;base64,AA'),
      b: node('b', 'a.mp4', 'video'),
      c: node('c', 'note.txt', 'text'),
      d: { ...node('d', 'gone.wav', 'audio'), deleted: true },
    };
    const playlist = buildPlaylist(nodes);
    expect(playlist.map((entry) => entry.name)).toEqual(['a.mp4', 'b.wav']);
    expect(playlist[1]?.dataUrl).toContain('base64');
  });

  it('wraps around with stepIndex and formats timestamps', () => {
    expect(stepIndex(0, -1, 3)).toBe(2);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(formatTimestamp(75.4)).toBe('1:15');
    expect(formatTimestamp(Number.NaN)).toBe('0:00');
  });
});
