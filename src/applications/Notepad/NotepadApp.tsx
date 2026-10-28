import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Save, FolderOpen, FilePlus2, Search, Replace, WrapText, ZoomIn, ZoomOut, Check, Printer } from 'lucide-react';
import type { AppWindowProps } from '../registry';
import { useDocument } from '../../hooks/useDocument';
import { useT } from '../../i18n';
import { Toolbar, ToolButton, Badge, Toggle } from '../../components/ui/Controls';
import { useShellStore } from '../../stores/shellStore';
import { openNode, SHELL_FOLDERS } from '../../services/launcher';
import { useFileSystemStore } from '../../stores/fileSystemStore';
import { DOCUMENTS_ID } from '../../core/FileSystem';

export function NotepadApp({ props }: AppWindowProps) {
  const { t } = useT();
  const fileId = props.fileId as string | undefined;
  const openDialog = useShellStore((state) => state.openDialog);

  const document$ = useDocument<string>({
    fileId,
    kind: 'text',
    appId: 'notepad',
    factory: () => '',
    validate: (value): value is string => typeof value === 'string',
    titleOf: (_doc, node) => node?.name?.replace(/\.txt$/i, '') ?? t('notepad.untitled'),
    defaultFolder: DOCUMENTS_ID,
    defaultName: t('notepad.untitled'),
    autosaveDelay: 1000,
  });

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [autoSave, setAutoSave] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const text = document$.doc;
  const stats = useMemo(() => {
    const lines = text.split('\n').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return { lines, words, chars: text.length };
  }, [text]);

  const matches = useMemo(() => {
    if (!find) return 0;
    return text.split(find).length - 1;
  }, [find, text]);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2000);
  };

  const save = useCallback(async () => {
    await document$.save();
    flash(t('notepad.saved'));
  }, [document$, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      } else if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setFindOpen(true);
      } else if (meta && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  const replaceAll = () => {
    if (!find) return;
    const next = text.split(find).join(replace);
    document$.setDoc(next);
    flash(`Replaced ${matches} occurrence(s)`);
  };

  const replaceOne = () => {
    if (!find) return;
    const index = text.indexOf(find);
    if (index < 0) {
      flash('No matches');
      return;
    }
    const next = text.slice(0, index) + replace + text.slice(index + find.length);
    document$.setDoc(next);
  };

  const openFile = () => {
    openDialog({
      kind: 'confirm',
      title: t('common.open'),
      message: t('notepad.openHint'),
      confirmLabel: t('explorer.documents'),
      cancelLabel: t('explorer.desktop'),
      onConfirm: () => openNode(useFileSystemStore.getState().nodes[SHELL_FOLDERS.documents]),
      onCancel: () => openNode(useFileSystemStore.getState().nodes[SHELL_FOLDERS.desktop]),
    });
  };

  const newFile = () => {
    openDialog({
      kind: 'confirm',
      title: t('notepad.newTitle'),
      message: t('notepad.newQuestion'),
      confirmLabel: t('common.new'),
      onConfirm: () => {
        document$.setDoc('');
        document$.setFileId(undefined);
      },
    });
  };

  const print = () => window.print();

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <Toolbar>
        <ToolButton icon={<FilePlus2 size={15} />} label={t('common.new')} onClick={newFile} />
        <ToolButton icon={<FolderOpen size={15} />} label={t('common.open')} onClick={openFile} />
        <ToolButton icon={<Save size={15} />} label={t('common.save')} onClick={() => void save()} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Search size={15} />} label={t('word.find')} active={findOpen} onClick={() => setFindOpen((value) => !value)} />
        <ToolButton icon={<Replace size={15} />} label={t('notepad.replace')} onClick={() => setFindOpen(true)} />
        <ToolButton icon={<WrapText size={15} />} label={t('notepad.wordWrap')} active={wrap} onClick={() => setWrap((value) => !value)} />
        <ToolButton icon={<Printer size={15} />} label={t('word.print')} onClick={print} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<ZoomOut size={15} />} title={t('notepad.zoomOut')} onClick={() => setFontSize((size) => Math.max(9, size - 1))} />
        <span className="w-8 text-center text-[11.5px] tabular-nums">{fontSize}</span>
        <ToolButton icon={<ZoomIn size={15} />} title={t('notepad.zoomIn')} onClick={() => setFontSize((size) => Math.min(32, size + 1))} />
        <span className="ms-auto flex items-center gap-2 pe-1">
          <label className="flex items-center gap-2 text-[11.5px]">
            <Toggle checked={autoSave} onChange={setAutoSave} size="sm" label={t('notepad.autosave')} />
          </label>
          {document$.dirty ? <Badge tone="warning">{t('common.unsaved')}</Badge> : <Badge tone="success">{t('common.saved')}</Badge>}
        </span>
      </Toolbar>

      {findOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
          <input
            className="win-input h-7 w-40 py-0 text-[12px]"
            value={find}
            placeholder={t('word.find')}
            onChange={(event) => setFind(event.target.value)}
            autoFocus
          />
          <input className="win-input h-7 w-40 py-0 text-[12px]" value={replace} placeholder={t('notepad.replaceWith')} onChange={(event) => setReplace(event.target.value)} />
          <span className="text-[11px] opacity-60">{find ? `${matches} match(es)` : ''}</span>
          <button type="button" className="win-button px-2 py-0.5 text-[11px]" onClick={replaceOne} disabled={!find}>
            {t('notepad.replace')}
          </button>
          <button type="button" className="win-button px-2 py-0.5 text-[11px]" onClick={replaceAll} disabled={!matches}>
            {t('notepad.replaceAll')}
          </button>
          <button type="button" className="icon-button ms-auto h-6 w-6" onClick={() => setFindOpen(false)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      ) : null}

      <textarea
        ref={areaRef}
        className="print-area min-h-0 flex-1 resize-none bg-[var(--surface-solid)] p-3 font-mono text-[var(--np-size)] leading-relaxed outline-none"
        style={{ ['--np-size' as string]: `${fontSize}px`, whiteSpace: wrap ? 'pre-wrap' : 'pre' }}
        value={text}
        spellCheck={false}
        placeholder={t('notepad.placeholder')}
        aria-label={t('app.notepad')}
        onChange={(event) => document$.setDoc(event.target.value)}
        onBlur={() => {
          if (autoSave) void document$.save();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Tab') {
            event.preventDefault();
            const element = event.currentTarget;
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const next = `${text.slice(0, start)}\t${text.slice(end)}`;
            document$.setDoc(next);
            window.setTimeout(() => element.setSelectionRange(start + 1, start + 1), 0);
          }
        }}
      />

      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px]">
        <span>
          Ln {lineOf(text, areaRef.current?.selectionStart ?? 0)}, Col {colOf(text, areaRef.current?.selectionStart ?? 0)}
        </span>
        <span>{stats.lines} lines</span>
        <span>{stats.words} words</span>
        <span>{stats.chars} characters</span>
        <span className="ms-auto flex items-center gap-2">
          {status ? (
            <span className="flex items-center gap-1 text-emerald-500">
              <Check size={12} /> {status}
            </span>
          ) : null}
          {document$.saving ? t('common.saving') : autoSave ? t('notepad.autosave') : ''}
          <span className="opacity-60">{document$.node ? `${t('explorer.location')}: ${document$.node.parentId}` : t('common.unsaved')}</span>
        </span>
      </footer>
    </div>
  );
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function colOf(text: string, index: number): number {
  const slice = text.slice(0, index);
  const lastBreak = slice.lastIndexOf('\n');
  return index - lastBreak;
}

export default NotepadApp;
