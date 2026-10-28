import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Save,
  SaveAll,
  Undo2,
  Redo2,
  Table2,
  Link2,
  Image as ImageIcon,
  Search,
  Printer,
  FileDown,
  FileType2,
  FileCode2,
  Palette,
  Highlighter,
  Pilcrow,
  FileText,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { WordDocument } from '../../types';
import { useDocument } from '../../hooks/useDocument';
import { isWordDocument, createWordDocument } from '../../core/Documents';
import { useT } from '../../i18n';
import { Toolbar, ToolButton, Segmented, Modal, Field, Select, Badge } from '../../components/ui/Controls';
import { sanitizeHtml, htmlToText, countWords } from '../../services/sanitize';
import { exportDocx } from '../../services/office/docx';
import { downloadText } from '../../services/files';
import { useShellStore } from '../../stores/shellStore';
import { pickFiles, readFileAsDataUrl } from '../../services/files';
import { DOCUMENTS_ID } from '../../core/FileSystem';

const FONTS = ['Segoe UI', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Tahoma', 'Vazirmatn', 'Times New Roman', 'Courier New', 'Verdana'];
const SIZES = ['10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '40', '48'];
const COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ffffff'];
const HIGHLIGHTS = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'];

type ViewMode = 'page' | 'web' | 'print';

export function WordApp({ props }: AppWindowProps) {
  const { t, isRTL } = useT();
  const openDialog = useShellStore((state) => state.openDialog);
  const fileId = props.fileId as string | undefined;

  const document$ = useDocument<WordDocument>({
    fileId,
    kind: 'doc',
    appId: 'word',
    factory: () => createWordDocument('', t('word.untitled')),
    validate: isWordDocument,
    titleOf: (doc, node) => node?.name?.replace(/\.docx$/i, '') ?? doc.title ?? t('word.untitled'),
    defaultFolder: DOCUMENTS_ID,
    defaultName: t('word.untitled'),
    autosaveDelay: 1400,
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ViewMode>('page');
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ url: '', text: '' });
  const [exportOpen, setExportOpen] = useState(false);
  const [dir, setDir] = useState<'ltr' | 'rtl'>(isRTL ? 'rtl' : 'ltr');
  const [lineSpacing, setLineSpacing] = useState('1.5');
  const [paraFormat, setParaFormat] = useState('p');
  const [fontName, setFontName] = useState('Segoe UI');
  const [fontSize, setFontSize] = useState('12');
  const [status, setStatus] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);

  const doc = document$.doc;
  const words = useMemo(() => countWords(doc.html), [doc.html]);

  /* Load document HTML into the editor when the file changes. */
  useEffect(() => {
    const key = document$.fileId ?? 'new';
    if (loadedFrom === key && editorRef.current) return;
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(doc.html);
    setLoadedFrom(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document$.fileId, document$.node?.updatedAt]);

  const flush = useCallback(() => {
    if (!editorRef.current) return;
    const html = sanitizeHtml(editorRef.current.innerHTML);
    document$.setDoc((previous) => ({ ...previous, html, wordCount: countWords(html), updatedAt: Date.now() }));
  }, [document$]);

  useEffect(() => {
    const element = editorRef.current;
    if (!element) return undefined;
    const onInput = () => flush();
    element.addEventListener('input', onInput);
    return () => element.removeEventListener('input', onInput);
  }, [flush]);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      try {
        document.execCommand(command, false, value);
      } catch (error) {
        console.warn('[Word] execCommand failed', command, error);
      }
      flush();
    },
    [flush],
  );

  const keepSelection = (event: React.MouseEvent) => event.preventDefault();

  const save = async () => {
    flush();
    await document$.save();
    setStatus({ text: t('word.saved'), tone: 'ok' });
    window.setTimeout(() => setStatus(null), 2200);
  };

  const saveAs = () => {
    flush();
    openDialog({
      kind: 'prompt',
      title: t('common.saveAs'),
      message: 'File name',
      defaultValue: `${document$.node?.name?.replace(/\.docx$/i, '') ?? doc.title ?? t('word.untitled')}.docx`,
      confirmLabel: t('common.save'),
      onConfirm: async (value) => {
        await document$.saveAs(value.endsWith('.docx') ? value : `${value}.docx`, DOCUMENTS_ID);
      },
    });
  };

  const insertTable = () => {
    openDialog({
      kind: 'prompt',
      title: t('word.insertTable'),
      message: 'Columns x Rows (e.g. 3x3)',
      defaultValue: '3x3',
      onConfirm: (value) => {
        const [colsRaw, rowsRaw] = value.toLowerCase().split('x');
        const cols = Math.max(1, Math.min(8, Number(colsRaw) || 3));
        const rows = Math.max(1, Math.min(20, Number(rowsRaw) || 3));
        const head = `<tr>${Array.from({ length: cols }, () => '<th><br></th>').join('')}</tr>`;
        const body = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td><br></td>').join('')}</tr>`).join('');
        exec('insertHTML', `<table border="1" style="border-collapse:collapse;width:100%">${head}${body}</table><p><br></p>`);
      },
    });
  };

  const insertImage = async () => {
    const files = await pickFiles('image/*', false);
    if (!files.length) return;
    const dataUrl = await readFileAsDataUrl(files[0]);
    exec('insertHTML', `<img src="${dataUrl}" alt="${files[0].name}" style="max-width:100%" />`);
  };

  const applyLink = () => {
    if (!linkForm.url) return;
    const text = linkForm.text || linkForm.url;
    exec('insertHTML', `<a href="${sanitizeUrl(linkForm.url)}" target="_blank" rel="noopener noreferrer">${escapeText(text)}</a>`);
    setLinkOpen(false);
    setLinkForm({ url: '', text: '' });
  };

  const exportTxt = () => {
    flush();
    downloadText(htmlToText(editorRef.current?.innerHTML ?? doc.html), `${fileName(document$.node?.name, doc.title)}.txt`);
    setExportOpen(false);
  };

  const exportHtml = () => {
    flush();
    const html = `<!doctype html><html dir="${dir}" lang="${isRTL ? 'fa' : 'en'}"><head><meta charset="utf-8"><title>${escapeText(doc.title)}</title>
<style>body{font-family:${fontName},sans-serif;max-width:800px;margin:40px auto;padding:0 24px;line-height:${lineSpacing};color:#111}
h1,h2,h3{line-height:1.25}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 9px}img{max-width:100%}</style></head>
<body>${sanitizeHtml(editorRef.current?.innerHTML ?? doc.html)}</body></html>`;
    downloadText(html, `${fileName(document$.node?.name, doc.title)}.html`, 'text/html;charset=utf-8');
    setExportOpen(false);
  };

  const exportWord = async () => {
    flush();
    const payload: WordDocument = { ...doc, html: sanitizeHtml(editorRef.current?.innerHTML ?? doc.html) };
    await exportDocx(payload, `${fileName(document$.node?.name, doc.title)}.docx`);
    setExportOpen(false);
  };

  const printDoc = () => {
    flush();
    setView('print');
    window.setTimeout(() => window.print(), 120);
  };

  const renameFile = () => {
    openDialog({
      kind: 'prompt',
      title: t('common.rename'),
      defaultValue: document$.node?.name ?? '',
      onConfirm: (value) => document$.renameFile(value),
    });
  };

  const pageWidth = doc.pageSize === 'A4' ? 794 : 816;
  const pageHeight = doc.pageSize === 'A4' ? 1123 : 1056;
  const mmToPx = (value: number) => value * 3.7795;

  /* Find */
  const findNext = useCallback(() => {
    const root = editorRef.current;
    if (!root || !findText) return;
    const selection = window.getSelection();
    if (!selection) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const matches: { node: Text; index: number }[] = [];
    let current = walker.nextNode() as Text | null;
    while (current) {
      const text = current.textContent ?? '';
      let from = 0;
      for (;;) {
        const found = text.toLowerCase().indexOf(findText.toLowerCase(), from);
        if (found < 0) break;
        matches.push({ node: current, index: found });
        from = found + findText.length;
      }
      current = walker.nextNode() as Text | null;
    }
    if (!matches.length) return;
    const anchor = selection.anchorNode;
    const startIndex = matches.findIndex((match) => match.node === anchor);
    const next = matches[(startIndex + 1) % matches.length];
    const range = document.createRange();
    range.setStart(next.node, next.index);
    range.setEnd(next.node, next.index + findText.length);
    selection.removeAllRanges();
    selection.addRange(range);
    (range.startContainer as Text).parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [findText]);

  const matchCount = useMemo(() => {
    if (!findText || !editorRef.current) return 0;
    return (editorRef.current.textContent ?? '').toLowerCase().split(findText.toLowerCase()).length - 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findText, doc.html]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      {/* File row */}
      <Toolbar>
        <ToolButton icon={<Save size={15} />} label={t('common.save')} onClick={() => void save()} />
        <ToolButton icon={<SaveAll size={15} />} label={t('common.saveAs')} onClick={saveAs} />
        <ToolButton icon={<FileText size={15} />} label={t('common.rename')} onClick={renameFile} disabled={!document$.fileId} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Undo2 size={15} />} title={t('word.undo')} onClick={() => exec('undo')} onMouseDown={keepSelection} />
        <ToolButton icon={<Redo2 size={15} />} title={t('word.redo')} onClick={() => exec('redo')} onMouseDown={keepSelection} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Search size={15} />} label={t('word.find')} active={findOpen} onClick={() => setFindOpen((value) => !value)} />
        <ToolButton icon={<Printer size={15} />} label={t('word.printPreview')} onClick={printDoc} />
        <div className="ms-auto flex items-center gap-2 pe-1">
          {document$.dirty ? <Badge tone="warning">{t('common.unsaved')}</Badge> : <Badge tone="success">{t('common.saved')}</Badge>}
          {document$.externalChange ? <Badge tone="danger">changed elsewhere</Badge> : null}
          <Segmented
            size="sm"
            value={view}
            onChange={(value) => setView(value)}
            options={[
              { value: 'page', label: t('word.pageView') },
              { value: 'web', label: t('word.webView') },
            ]}
          />
        </div>
      </Toolbar>

      {/* Formatting row */}
      <Toolbar className="gap-1">
        <Select
          value={paraFormat}
          ariaLabel={t('word.heading')}
          onChange={(value) => {
            setParaFormat(value);
            exec('formatBlock', value);
          }}
          className="w-28"
          options={[
            { value: 'p', label: t('word.normal') },
            { value: 'h1', label: `${t('word.heading')} 1` },
            { value: 'h2', label: `${t('word.heading')} 2` },
            { value: 'h3', label: `${t('word.heading')} 3` },
            { value: 'blockquote', label: 'Quote' },
          ]}
        />
        <Select
          value={fontName}
          ariaLabel={t('word.font')}
          onChange={(value) => {
            setFontName(value);
            exec('fontName', value);
          }}
          className="w-32"
          options={FONTS.map((font) => ({ value: font, label: font }))}
        />
        <Select
          value={fontSize}
          ariaLabel={t('word.size')}
          onChange={(value) => {
            setFontSize(value);
            applyFontSize(value);
          }}
          className="w-16"
          options={SIZES.map((size) => ({ value: size, label: size }))}
        />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Bold size={15} />} title={t('word.bold')} onClick={() => exec('bold')} onMouseDown={keepSelection} />
        <ToolButton icon={<Italic size={15} />} title={t('word.italic')} onClick={() => exec('italic')} onMouseDown={keepSelection} />
        <ToolButton icon={<Underline size={15} />} title={t('word.underline')} onClick={() => exec('underline')} onMouseDown={keepSelection} />
        <ToolButton icon={<Strikethrough size={15} />} title={t('word.strike')} onClick={() => exec('strikeThrough')} onMouseDown={keepSelection} />
        <ColorPicker icon={<Palette size={15} />} title={t('word.textColor')} colors={COLORS} onPick={(color) => exec('foreColor', color)} />
        <ColorPicker icon={<Highlighter size={15} />} title={t('word.highlight')} colors={HIGHLIGHTS} onPick={(color) => exec('hiliteColor', color)} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<AlignLeft size={15} />} title={t('word.alignLeft')} onClick={() => exec('justifyLeft')} onMouseDown={keepSelection} />
        <ToolButton icon={<AlignCenter size={15} />} title={t('word.alignCenter')} onClick={() => exec('justifyCenter')} onMouseDown={keepSelection} />
        <ToolButton icon={<AlignRight size={15} />} title={t('word.alignRight')} onClick={() => exec('justifyRight')} onMouseDown={keepSelection} />
        <ToolButton icon={<AlignJustify size={15} />} title={t('word.alignJustify')} onClick={() => exec('justifyFull')} onMouseDown={keepSelection} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<List size={15} />} title={t('word.bullets')} onClick={() => exec('insertUnorderedList')} onMouseDown={keepSelection} />
        <ToolButton icon={<ListOrdered size={15} />} title={t('word.numbers')} onClick={() => exec('insertOrderedList')} onMouseDown={keepSelection} />
        <Select
          value={lineSpacing}
          ariaLabel={t('word.lineSpacing')}
          onChange={(value) => {
            setLineSpacing(value);
            if (editorRef.current) editorRef.current.style.lineHeight = value;
          }}
          className="w-20"
          options={['1', '1.15', '1.5', '2', '2.5'].map((value) => ({ value, label: value }))}
        />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Table2 size={15} />} title={t('word.insertTable')} onClick={insertTable} />
        <ToolButton icon={<Link2 size={15} />} title={t('word.insertLink')} onClick={() => setLinkOpen(true)} />
        <ToolButton icon={<ImageIcon size={15} />} title={t('word.insertImage')} onClick={() => void insertImage()} />
        <ToolButton
          icon={<Pilcrow size={15} />}
          title={dir === 'rtl' ? t('word.ltr') : t('word.rtl')}
          active={dir === 'rtl'}
          onClick={() => {
            const next = dir === 'rtl' ? 'ltr' : 'rtl';
            setDir(next);
            if (editorRef.current) {
              editorRef.current.dir = next;
              exec(next === 'rtl' ? 'justifyRight' : 'justifyLeft');
            }
          }}
        />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<FileDown size={15} />} label={t('common.export')} onClick={() => setExportOpen(true)} />
      </Toolbar>

      {findOpen ? (
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5">
          <Search size={14} className="opacity-55" />
          <input
            value={findText}
            onChange={(event) => setFindText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') findNext();
              if (event.key === 'Escape') setFindOpen(false);
            }}
            placeholder={t('word.find')}
            className="win-input h-7 w-56 py-0"
            autoFocus
          />
          <span className="text-[11px] opacity-60">{matchCount ? `${matchCount} matches` : 'No matches'}</span>
          <button type="button" className="win-button px-2 py-0.5 text-[11px]" onClick={findNext}>
            Next
          </button>
          <button type="button" className="icon-button ms-auto h-6 w-6" onClick={() => setFindOpen(false)} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
      ) : null}

      {document$.externalChange ? (
        <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11.5px]">
          <AlertTriangle size={14} className="text-amber-500" />
          <span>This file changed in another window. Reload it or keep your version.</span>
          <button type="button" className="win-button ms-auto px-2 py-0.5 text-[11px]" onClick={document$.reloadFromDisk}>
            Reload
          </button>
          <button type="button" className="win-button px-2 py-0.5 text-[11px]" onClick={document$.keepMine}>
            Keep mine
          </button>
        </div>
      ) : null}

      {/* Editor */}
      <div className="scroll-thin min-h-0 flex-1 overflow-auto bg-[#5b6472] p-6 dark:bg-[#14161a]">
        <div
          className={view === 'print' ? 'print-area' : ''}
          style={{
            width: view === 'web' ? '100%' : pageWidth,
            maxWidth: '100%',
            margin: '0 auto',
          }}
        >
          <div
            className="doc-page relative"
            style={{
              minHeight: view === 'web' ? '100%' : pageHeight,
              padding:
                view === 'web'
                  ? 24
                  : `${mmToPx(doc.margins.top)}px ${mmToPx(doc.margins.right)}px ${mmToPx(doc.margins.bottom)}px ${mmToPx(doc.margins.left)}px`,
            }}
          >
            <div
              ref={editorRef}
              className="doc-editor"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label={t('app.word')}
              dir={dir}
              data-placeholder="Start typing…"
              style={{ lineHeight: lineSpacing, fontFamily: `${fontName}, sans-serif`, fontSize: `${fontSize}pt` }}
              onBlur={flush}
              onPaste={(event) => {
                event.preventDefault();
                const text = event.clipboardData.getData('text/plain');
                exec('insertText', text);
              }}
            />
          </div>
        </div>
      </div>

      {/* Status bar */}
      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[11px]">
        <span>{t('word.words', { n: words })}</span>
        <span>{doc.pageSize}</span>
        <span>
          {t('word.page')} {view === 'web' ? '—' : '1'}
        </span>
        <span className="ms-auto flex items-center gap-2">
          {status ? (
            <span className={`flex items-center gap-1 ${status.tone === 'ok' ? 'text-emerald-500' : 'text-amber-500'}`}>
              <Check size={12} /> {status.text}
            </span>
          ) : null}
          {document$.saving ? t('common.saving') : document$.savedAt ? `${t('word.autosave')} ✓` : ''}
          <button type="button" className="win-button px-2 py-0.5 text-[11px]" onClick={() => setPageSetupOpen(true)}>
            {t('word.pageSetup')}
          </button>
        </span>
      </footer>

      {/* Page setup */}
      <Modal
        open={pageSetupOpen}
        title={t('word.pageSetup')}
        onClose={() => setPageSetupOpen(false)}
        footer={
          <button type="button" className="win-button win-button-accent" onClick={() => setPageSetupOpen(false)}>
            {t('common.ok')}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('word.pageSize')}>
            <Select
              value={doc.pageSize}
              onChange={(value) => document$.setDoc((previous) => ({ ...previous, pageSize: value as WordDocument['pageSize'] }))}
              options={[
                { value: 'A4', label: 'A4 (210 × 297 mm)' },
                { value: 'Letter', label: 'Letter (8.5 × 11 in)' },
              ]}
            />
          </Field>
          <div />
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Field key={side} label={`${t('word.margins')} — ${side}`}>
              <input
                type="number"
                min={0}
                max={80}
                value={doc.margins[side]}
                onChange={(event) =>
                  document$.setDoc((previous) => ({
                    ...previous,
                    margins: { ...previous.margins, [side]: Number(event.target.value) },
                  }))
                }
                className="win-input"
              />
            </Field>
          ))}
        </div>
      </Modal>

      {/* Insert link */}
      <Modal
        open={linkOpen}
        title={t('word.insertLink')}
        onClose={() => setLinkOpen(false)}
        footer={
          <>
            <button type="button" className="win-button" onClick={() => setLinkOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="win-button win-button-accent" onClick={applyLink}>
              {t('common.add')}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('word.linkUrl')}>
            <input
              className="win-input"
              value={linkForm.url}
              onChange={(event) => setLinkForm((form) => ({ ...form, url: event.target.value }))}
              placeholder="https://example.com"
              dir="ltr"
            />
          </Field>
          <Field label={t('word.linkText')}>
            <input className="win-input" value={linkForm.text} onChange={(event) => setLinkForm((form) => ({ ...form, text: event.target.value }))} />
          </Field>
        </div>
      </Modal>

      {/* Export */}
      <Modal open={exportOpen} title={t('common.export')} onClose={() => setExportOpen(false)}>
        <div className="space-y-2">
          <ExportRow icon={<FileType2 size={16} />} label={t('word.exportTxt')} hint="Plain text, formatting removed" onClick={exportTxt} />
          <ExportRow icon={<FileCode2 size={16} />} label={t('word.exportHtml')} hint="Standalone .html with inline CSS" onClick={exportHtml} />
          <ExportRow icon={<FileText size={16} />} label={t('word.exportDocx')} hint={t('word.docxNote')} onClick={() => void exportWord()} />
          <ExportRow icon={<Printer size={16} />} label={t('word.exportPdf')} hint="Uses the browser print dialog — choose “Save as PDF”" onClick={printDoc} />
        </div>
      </Modal>
    </div>
  );

  function applyFontSize(size: string) {
    // execCommand fontSize only supports 1-7, so set the style on the selection.
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      if (editorRef.current) editorRef.current.style.fontSize = `${size}pt`;
      return;
    }
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${size}pt`;
    try {
      range.surroundContents(span);
    } catch {
      const fragment = range.extractContents();
      span.appendChild(fragment);
      range.insertNode(span);
    }
    flush();
  }
}

function ExportRow({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button type="button" className="list-row w-full items-start gap-3 py-2" onClick={onClick}>
      <span className="mt-0.5 shrink-0 opacity-75">{icon}</span>
      <span className="min-w-0 text-start">
        <span className="block text-[12.5px] font-medium">{label}</span>
        <span className="block text-[11px] leading-snug opacity-60">{hint}</span>
      </span>
    </button>
  );
}

function ColorPicker({ icon, title, colors, onPick }: { icon: React.ReactNode; title: string; colors: string[]; onPick: (color: string) => void }) {
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
      <ToolButton icon={icon} title={title} active={open} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 grid grid-cols-6 gap-1 p-2" style={{ width: 168 }}>
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              className="h-6 w-6 rounded border border-[var(--border-strong)]"
              style={{ background: color === 'transparent' ? 'repeating-conic-gradient(#fff 0% 25%, #ddd 0% 50%) 50% / 8px 8px' : color }}
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

function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return '#';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fileName(nodeName: string | undefined, fallback: string): string {
  const base = (nodeName ?? fallback).replace(/\.docx$/i, '');
  return base || fallback;
}

export default WordApp;
