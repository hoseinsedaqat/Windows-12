import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, Pin, PinOff, Trash2, RotateCcw, Tag, Palette, StickyNote, Check, X } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { FSNode, NoteDocument } from '../../types';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { createNoteDocument, isNote } from '../../core/Documents';
import { NOTES_ID, sortNodes } from '../../core/FileSystem';
import { useT } from '../../i18n';
import { EmptyState, Badge } from '../../components/ui/Controls';
import { useShellStore } from '../../stores/shellStore';
import { formatDate } from '../../services/format';
import { notify } from '../../stores/notificationStore';

const NOTE_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#f1f5f9', '#cbd5e1'];

export function NotesApp({ props }: AppWindowProps) {
  const { t } = useT();
  const nodes = useFileSystemStore((state) => state.nodes);
  const createFile = useFileSystemStore((state) => state.createFile);
  const updateContent = useFileSystemStore((state) => state.updateContent);
  const rename = useFileSystemStore((state) => state.rename);
  const softDelete = useFileSystemStore((state) => state.softDelete);
  const restore = useFileSystemStore((state) => state.restore);
  const openContextMenu = useShellStore((state) => state.openContextMenu);
  const openDialog = useShellStore((state) => state.openDialog);

  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>((props.noteId as string | undefined) ?? null);
  const [draft, setDraft] = useState<{ title: string; body: string; tags: string[] } | null>(null);
  const saveTimer = useRef<number | null>(null);

  const notes = useMemo(() => {
    const list = Object.values(nodes).filter((node) => node.kind === 'note' && (showDeleted ? Boolean(node.deleted) : !node.deleted));
    return sortNodes(list, { key: 'updatedAt', direction: 'desc' });
  }, [nodes, showDeleted]);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const node of notes) {
      const content = node.content as NoteDocument | null;
      if (isNote(content)) content.tags.forEach((tag) => set.add(tag));
    }
    return [...set].sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return notes.filter((node) => {
      const content = node.content as NoteDocument | null;
      if (!isNote(content)) return false;
      if (tagFilter && !content.tags.includes(tagFilter)) return false;
      if (!needle) return true;
      return (
        node.name.toLowerCase().includes(needle) ||
        content.title.toLowerCase().includes(needle) ||
        content.body.toLowerCase().includes(needle) ||
        content.tags.some((tag) => tag.toLowerCase().includes(needle))
      );
    });
  }, [notes, query, tagFilter]);

  const selected = selectedId ? nodes[selectedId] : undefined;
  const selectedDoc: NoteDocument | null = selected && isNote(selected.content) ? selected.content : null;

  /* Keep the editor draft in sync when another note is selected. */
  useEffect(() => {
    setDraft(selectedDoc ? { title: selectedDoc.title, body: selectedDoc.body, tags: selectedDoc.tags } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedDoc?.updatedAt]);

  /* Autosave the draft a moment after typing stops. */
  useEffect(() => {
    if (!selectedId || !draft || !selectedDoc) return undefined;
    const unchanged = draft.title === selectedDoc.title && draft.body === selectedDoc.body && draft.tags.join() === selectedDoc.tags.join();
    if (unchanged) return undefined;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const next: NoteDocument = { ...selectedDoc, ...draft, updatedAt: Date.now() };
      updateContent(selectedId, next);
      if (draft.title && draft.title !== selectedDoc.title) rename(selectedId, `${draft.title.replace(/\.note$/i, '')}.note`);
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [draft, selectedId, selectedDoc, updateContent, rename]);

  const createNote = () => {
    const title = t('notes.newNote');
    const id = createFile('note', NOTES_ID, `${title}.note`, createNoteDocument(title, '', NOTE_COLORS[0]));
    setSelectedId(id);
    setQuery('');
    setTagFilter(null);
  };

  const togglePin = (node: FSNode, content: NoteDocument) => {
    updateContent(node.id, { ...content, pinned: !content.pinned, updatedAt: Date.now() });
  };

  const setColor = (node: FSNode, content: NoteDocument, color: string) => {
    updateContent(node.id, { ...content, color, updatedAt: Date.now() });
  };

  const noteMenu = (event: React.MouseEvent, node: FSNode, content: NoteDocument) => {
    event.preventDefault();
    openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: content.title || node.name,
      items: [
        {
          id: 'pin',
          label: content.pinned ? t('notes.unpin') : t('notes.pin'),
          icon: content.pinned ? 'PinOff' : 'Pin',
          action: () => togglePin(node, content),
        },
        {
          id: 'color',
          label: t('notes.color'),
          icon: 'Palette',
          submenu: NOTE_COLORS.map((color, index) => ({
            id: `color-${index}`,
            label: color,
            checked: content.color === color,
            action: () => setColor(node, content, color),
          })),
        },
        { id: 'tags', label: t('notes.editTags'), icon: 'Tag', action: () => editTags(node, content) },
        { id: 'rename', label: t('common.rename'), icon: 'Pencil', action: () => renameNote(node) },
        { id: 'sep', label: '', separator: true },
        { id: 'delete', label: t('common.delete'), icon: 'Trash2', danger: true, action: () => softDelete([node.id]) },
      ],
    });
  };

  const editTags = (node: FSNode, content: NoteDocument) => {
    openDialog({
      kind: 'prompt',
      title: t('notes.editTags'),
      message: t('notes.tagsHint'),
      defaultValue: content.tags.join(', '),
      onConfirm: (value) => {
        const next = value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        updateContent(node.id, { ...content, tags: next, updatedAt: Date.now() });
      },
    });
  };

  const renameNote = (node: FSNode) => {
    openDialog({
      kind: 'prompt',
      title: t('common.rename'),
      defaultValue: node.name.replace(/\.note$/i, ''),
      onConfirm: (value) => {
        void rename(node.id, `${value.replace(/\.note$/i, '')}.note`);
      },
    });
  };

  return (
    <div className="flex h-full bg-[var(--surface-solid)] text-[var(--text)]">
      {/* List */}
      <aside className="flex w-72 shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-2">
          <div className="relative flex-1">
            <Search size={13} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              className="win-input h-8 ps-7 text-[12px]"
              placeholder={t('notes.searchPlaceholder')}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button type="button" className="win-button win-button-accent flex h-8 items-center gap-1 px-2 text-[12px]" onClick={createNote}>
            <Plus size={14} /> {t('common.new')}
          </button>
        </div>

        {tags.length ? (
          <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-[var(--border)] px-2 py-1.5">
            <button
              type="button"
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] transition ${tagFilter === null ? 'bg-[var(--accent)] text-white' : 'bg-[var(--hover)]'}`}
              onClick={() => setTagFilter(null)}
            >
              {t('notes.allNotes')}
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] transition ${tagFilter === tag ? 'bg-[var(--accent)] text-white' : 'bg-[var(--hover)]'}`}
                onClick={() => setTagFilter(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}

        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <EmptyState icon={<StickyNote size={32} />} title={t('notes.empty')} message={query ? t('notes.emptySearch') : t('notes.emptyHint')} />
          ) : null}
          {filtered.map((node) => {
            const content = node.content as NoteDocument;
            return (
              <button
                key={node.id}
                type="button"
                className={`mb-1.5 block w-full rounded-lg border p-2 text-start transition ${
                  node.id === selectedId ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-[var(--hover)]'
                }`}
                style={{ borderInlineStart: `4px solid ${content.color ?? 'var(--accent)'}` }}
                onClick={() => setSelectedId(node.id)}
                onContextMenu={(event) => noteMenu(event, node, content)}
              >
                <span className="flex items-center gap-1.5">
                  {content.pinned ? <Pin size={11} className="shrink-0 text-[var(--accent)]" /> : null}
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{content.title || node.name.replace(/\.note$/i, '')}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] opacity-60">{content.body.split('\n')[0] || t('notes.noContent')}</span>
                <span className="mt-1 flex items-center gap-1.5 text-[10px] opacity-50">
                  <span>{formatDate(node.updatedAt)}</span>
                  {content.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded bg-[var(--hover)] px-1">
                      #{tag}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--border)] px-2 py-1.5 text-[11px]">
          <span className="opacity-60">
            {filtered.length} / {notes.length}
          </span>
          <button type="button" className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition ${showDeleted ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--hover)]'}`} onClick={() => setShowDeleted((value) => !value)}>
            <Trash2 size={12} /> {t('notes.deleted')}
          </button>
        </footer>
      </aside>

      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col">
        {selected && selectedDoc && draft ? (
          <>
            <header className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <span className="h-6 w-6 shrink-0 rounded-full border border-[var(--border-strong)]" style={{ background: selectedDoc.color }} />
              <input
                className="min-w-0 flex-1 border-none bg-transparent text-[15px] font-semibold outline-none"
                value={draft.title}
                placeholder={t('notes.titlePlaceholder')}
                onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
              />
              {selected.deleted ? <Badge tone="danger">{t('notes.inTrash')}</Badge> : null}
              <div className="flex items-center gap-1">
                <button type="button" className="icon-button h-7 w-7" title={selectedDoc.pinned ? t('notes.unpin') : t('notes.pin')} onClick={() => togglePin(selected, selectedDoc)}>
                  {selectedDoc.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <ColorDots value={selectedDoc.color} onPick={(color) => setColor(selected, selectedDoc, color)} />
                <button type="button" className="icon-button h-7 w-7" title={t('notes.editTags')} onClick={() => editTags(selected, selectedDoc)}>
                  <Tag size={14} />
                </button>
                {selected.deleted ? (
                  <button
                    type="button"
                    className="icon-button h-7 w-7"
                    title={t('explorer.restoreItem')}
                    onClick={() => {
                      restore([selected.id]);
                      notify(t('notes.restored'), selectedDoc.title, 'success', 'notes');
                    }}
                  >
                    <RotateCcw size={14} />
                  </button>
                ) : (
                  <button type="button" className="icon-button h-7 w-7 text-red-500" title={t('common.delete')} onClick={() => softDelete([selected.id])}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </header>

            {draft.tags.length ? (
              <div className="flex flex-wrap gap-1 border-b border-[var(--border)] px-3 py-1.5">
                {draft.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--hover)] px-2 py-0.5 text-[11px]">
                    #{tag}
                    <button
                      type="button"
                      className="opacity-60 hover:opacity-100"
                      onClick={() => setDraft((current) => (current ? { ...current, tags: current.tags.filter((item) => item !== tag) } : current))}
                      aria-label={`${t('common.remove')} ${tag}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <textarea
              className="min-h-0 flex-1 resize-none bg-[var(--surface-solid)] p-4 text-[13.5px] leading-relaxed outline-none"
              value={draft.body}
              placeholder={t('notes.bodyPlaceholder')}
              onChange={(event) => setDraft((current) => (current ? { ...current, body: event.target.value } : current))}
              style={{ background: `linear-gradient(180deg, ${selectedDoc.color}14, transparent 220px)` }}
            />

            <footer className="flex items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px] opacity-70">
              <span className="flex items-center gap-1 text-emerald-500">
                <Check size={12} /> {t('notes.autosaved')}
              </span>
              <span>{draft.body.length} characters</span>
              <span>{draft.body.split(/\s+/).filter(Boolean).length} words</span>
              <span className="ms-auto">{t('explorer.location')}: {selected.parentId}</span>
            </footer>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState
              icon={<StickyNote size={40} />}
              title={t('notes.selectTitle')}
              message={t('notes.selectHint')}
              action={
                <button type="button" className="win-button win-button-accent" onClick={createNote}>
                  <Plus size={14} /> {t('notes.newNote')}
                </button>
              }
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ColorDots({ value, onPick }: { value: string; onPick: (color: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="icon-button h-7 w-7" title="Colour" onClick={() => setOpen((state) => !state)}>
        <Palette size={14} />
      </button>
      {open ? (
        <div className="panel absolute end-0 top-full z-40 mt-1 grid grid-cols-4 gap-1 p-2" style={{ width: 120 }}>
          {NOTE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`h-5 w-5 rounded-full border ${value === color ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]' : 'border-[var(--border-strong)]'}`}
              style={{ background: color }}
              onClick={() => {
                onPick(color);
                setOpen(false);
              }}
              aria-label={color}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default NotesApp;
