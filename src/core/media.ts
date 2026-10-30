import type { FSNode } from '../types';

/** Pure playlist helpers for the Media Player app. */
export interface PlaylistEntry {
  id: string;
  name: string;
  kind: 'audio' | 'video';
  dataUrl?: string;
}

export function buildPlaylist(nodes: Record<string, FSNode | undefined>): PlaylistEntry[] {
  return Object.values(nodes)
    .filter((node): node is FSNode => node != null && !node.deleted && (node.kind === 'audio' || node.kind === 'video'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((node) => ({
      id: node.id,
      name: node.name,
      kind: node.kind as 'audio' | 'video',
      dataUrl: (node.metadata?.dataUrl as string | undefined) ?? undefined,
    }));
}

export function stepIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0;
  return (current + delta + length) % length;
}

export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
