import { useMemo } from 'react';
import { X } from 'lucide-react';
import { useShellStore } from '../../stores/shellStore';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { useT } from '../../i18n';
import { countDescendants, KIND_LABELS, nodeSize, resolvePath } from '../../core/FileSystem';
import { formatBytes, formatDate } from '../../services/format';
import { KindIcon, AppIcon } from '../icons/AppIcons';

/** Properties dialog — the same surface Explorer and the desktop both open. */
export function PropertiesDialog() {
  const { t } = useT();
  const nodeId = useShellStore((state) => state.propertiesNodeId);
  const setProperties = useShellStore((state) => state.setProperties);
  const nodes = useFileSystemStore((state) => state.nodes);
  const node = nodeId ? nodes[nodeId] : undefined;

  const stats = useMemo(() => (node && node.kind === 'folder' ? countDescendants(nodes, node.id) : null), [node, nodes]);
  const size = useMemo(() => (node ? nodeSize(nodes, node) : 0), [node, nodes]);

  if (!nodeId || !node) return null;

  const rows: { label: string; value: string }[] = [
    { label: t('common.type'), value: KIND_LABELS[node.kind] },
    { label: t('explorer.location'), value: resolvePath(nodes, node.parentId) },
    {
      label: t('common.size'),
      value: node.kind === 'folder' && stats ? `${formatBytes(size)} (${stats.files} files, ${stats.folders} folders)` : formatBytes(size),
    },
    { label: t('common.dateCreated'), value: formatDate(node.createdAt, true) },
    { label: t('common.dateModified'), value: formatDate(node.updatedAt, true) },
  ];
  if (node.metadata.mime) rows.push({ label: 'MIME', value: String(node.metadata.mime) });
  if (node.metadata.appId) rows.push({ label: t('common.openWith'), value: String(node.metadata.appId) });
  if (node.system) rows.push({ label: 'Attributes', value: 'System item (protected)' });
  if (node.deleted) rows.push({ label: 'Status', value: `In Recycle Bin since ${formatDate(node.deletedAt ?? node.updatedAt, true)}` });

  return (
    <div
      className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setProperties(null);
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('explorer.propertiesTitle')}
    >
      <div className="panel animate-scale-in w-full max-w-sm overflow-hidden">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">
            {node.name} — {t('explorer.propertiesTitle')}
          </h2>
          <button type="button" className="icon-button h-7 w-7 rounded" onClick={() => setProperties(null)} aria-label={t('common.close')}>
            <X size={15} />
          </button>
        </header>
        <div className="p-4">
          <div className="mb-4 flex items-center gap-3">
            {node.metadata.appId ? <AppIcon appId={String(node.metadata.appId)} size={44} /> : <KindIcon kind={node.kind} size={44} />}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium" dir="auto">{node.name}</p>
              <p className="text-[11px] opacity-60">{KIND_LABELS[node.kind]}</p>
            </div>
          </div>
          {typeof node.metadata.dataUrl === 'string' ? (
            <img src={node.metadata.dataUrl} alt="" className="mb-3 max-h-32 w-full rounded object-cover" />
          ) : null}
          <dl className="space-y-1.5 text-[12px]">
            {rows.map((row) => (
              <div key={row.label} className="flex gap-3">
                <dt className="w-28 shrink-0 opacity-60">{row.label}</dt>
                <dd className="min-w-0 flex-1 break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <footer className="flex justify-end border-t border-[var(--border)] px-4 py-2.5">
          <button type="button" className="win-button win-button-accent" onClick={() => setProperties(null)}>
            {t('common.ok')}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default PropertiesDialog;
