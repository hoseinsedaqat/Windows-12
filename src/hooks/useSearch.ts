import { useMemo } from 'react';
import type { AppDefinition, FSNode } from '../types';
import { searchApps } from '../core/ApplicationRegistry';
import { searchNodes } from '../core/FileSystem';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { ALL_SETTINGS_SECTIONS, type SettingsSection } from '../data/settingsNav';
import { translate } from '../i18n';
import { useDebounced } from './useUi';

export interface SearchResults {
  query: string;
  apps: AppDefinition[];
  files: FSNode[];
  settings: SettingsSection[];
  recent: FSNode[];
  isEmpty: boolean;
}

/** Unified search across apps, virtual files and settings pages. */
export function useSearchResults(rawQuery: string, limits = { apps: 6, files: 8, settings: 5 }): SearchResults {
  const query = useDebounced(rawQuery, 120);
  const nodes = useFileSystemStore((state) => state.nodes);
  const recentIds = useFileSystemStore((state) => state.recentIds);

  return useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) {
      const recent = recentIds
        .map((id) => nodes[id])
        .filter((node): node is FSNode => Boolean(node) && !node.deleted && node.kind !== 'folder')
        .slice(0, limits.files);
      return { query, apps: [], files: [], settings: [], recent, isEmpty: true };
    }

    const apps = searchApps(needle)
      .filter((hit) => hit.app.listed !== false)
      .slice(0, limits.apps)
      .map((hit) => hit.app);

    const files = searchNodes(nodes, needle, { limit: limits.files });

    const settings = ALL_SETTINGS_SECTIONS.filter((section) => {
      const labels = [translate('en', section.labelKey), translate('fa', section.labelKey)].join(' ').toLowerCase();
      return labels.includes(needle) || section.keywords.some((keyword) => keyword.toLowerCase().includes(needle));
    }).slice(0, limits.settings);

    return { query, apps, files, settings, recent: [], isEmpty: false };
  }, [query, nodes, recentIds, limits.apps, limits.files]);
}
