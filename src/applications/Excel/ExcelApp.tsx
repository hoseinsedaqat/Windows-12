import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Palette,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  PaintBucket,
  Type,
  Grid3x3,
  Save,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  ArrowDownUp,
  Snowflake,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  FileDown,
  FileUp,
  HelpCircle,
  Grid3x3 as BorderAll,
  Hash,
  Percent,
  CalendarDays,
  Ban,
  X,
} from 'lucide-react';
import type { AppWindowProps } from '../registry';
import type { CellFormat, CellStyle, SheetChart, SpreadsheetDocument, SpreadsheetSheet } from '../../types';
import { useDocument } from '../../hooks/useDocument';
import { isSpreadsheet, createSpreadsheet, createSheet } from '../../core/Documents';
import { colToLetter, keyToRef, refToKey, expandRange, letterToCol, type CellRef } from '../../core/spreadsheet/cellref';
import { evaluateSheet, displayValue, isError, SUPPORTED_FUNCTIONS, type CellValue } from '../../core/spreadsheet/engine';
import { compileConditionalFormats } from '../../core/spreadsheet/conditional';
import type { ConditionalFormatRule, ConditionalFormatType } from '../../types';
import { formatCellValue, parseUserInput } from '../../core/spreadsheet/format';
import { useT } from '../../i18n';
import { Toolbar, ToolButton, Modal, Field, Select, Badge, BarChart, LineChart, PieChart, EmptyState } from '../../components/ui/Controls';
import { downloadText, pickFiles, readFileAsText, readFileAsArrayBuffer } from '../../services/files';
import { exportXlsx, importXlsx } from '../../services/office/xlsx';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShellStore } from '../../stores/shellStore';
import { DOCUMENTS_ID } from '../../core/FileSystem';
import { uid } from '../../services/id';

const ROW_HEIGHT = 24;
const HEADER_WIDTH = 46;
const FILL_COLORS = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#f1f5f9'];
const FONT_COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#ffffff'];
const FORMATS: { value: CellFormat; label: string; icon: React.ReactNode }[] = [
  { value: 'general', label: 'General', icon: <Hash size={14} /> },
  { value: 'number', label: 'Number', icon: <Hash size={14} /> },
  { value: 'currency', label: 'Currency', icon: <Type size={14} /> },
  { value: 'percent', label: 'Percent', icon: <Percent size={14} /> },
  { value: 'date', label: 'Date', icon: <CalendarDays size={14} /> },
  { value: 'text', label: 'Text', icon: <Type size={14} /> },
];

interface Selection {
  anchor: CellRef;
  focus: CellRef;
}

export function ExcelApp({ props }: AppWindowProps) {
  const { t } = useT();
  const fileId = props.fileId as string | undefined;
  const openDialog = useShellStore((state) => state.openDialog);
  const locale = useSettingsStore((state) => state.settings.locale);
  const currency = useSettingsStore((state) => state.settings.locale.currency);

  const document$ = useDocument<SpreadsheetDocument>({
    fileId,
    kind: 'sheet',
    appId: 'excel',
    factory: () => createSpreadsheet(),
    validate: isSpreadsheet,
    titleOf: (_doc, node) => node?.name?.replace(/\.xlsx$/i, '') ?? 'Workbook',
    defaultFolder: DOCUMENTS_ID,
    defaultName: 'Workbook',
    autosaveDelay: 1200,
  });

  const doc = document$.doc;
  const sheet: SpreadsheetSheet = useMemo(
    () => doc.sheets.find((item) => item.id === doc.activeSheetId) ?? doc.sheets[0],
    [doc],
  );

  const [selection, setSelection] = useState<Selection>({ anchor: { col: 1, row: 1 }, focus: { col: 1, row: 1 } });
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cfOpen, setCfOpen] = useState(false);
  const [cfType, setCfType] = useState<ConditionalFormatType>('greater');
  const [cfValue, setCfValue] = useState('');
  const [chartOpen, setChartOpen] = useState(false);
  const [chartForm, setChartForm] = useState<{ type: SheetChart['type']; title: string }>({ type: 'bar', title: 'Chart' });
  const [formatOpen, setFormatOpen] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<SpreadsheetSheet[]>([]);
  const redoStack = useRef<SpreadsheetSheet[]>([]);
  const internalClipboard = useRef<{ tsv: string; cells: Record<string, { v: string; s?: CellStyle }> } | null>(null);
  const dragSelect = useRef<{ active: boolean; origin: CellRef } | null>(null);

  /* ---------------- computed values ---------------- */
  const computed = useMemo(() => {
    const getRaw = (key: string) => sheet.cells[key]?.v;
    const keys = Object.keys(sheet.cells);
    // Include formula dependencies that live outside the stored cells map.
    return evaluateSheet(getRaw, keys).values;
  }, [sheet.cells]);

  const selectedKeys = useMemo(() => {
    const cells = expandRange(selection.anchor, selection.focus);
    return cells.map((cell) => refToKey(cell));
  }, [selection]);

  const activeKey = refToKey(selection.focus);

  const selectionStats = useMemo(() => {
    const numbers: number[] = [];
    let count = 0;
    for (const key of selectedKeys) {
      const value = computed[key];
      if (value === undefined || value === '') continue;
      count += 1;
      if (typeof value === 'number') numbers.push(value);
      else if (typeof value === 'string' && !isError(value as never)) {
        const parsed = Number(value);
        if (!Number.isNaN(parsed) && value.trim() !== '') numbers.push(parsed);
      }
    }
    const sum = numbers.reduce((total, value) => total + value, 0);
    return { count, sum, average: numbers.length ? sum / numbers.length : 0, numbers: numbers.length };
  }, [selectedKeys, computed]);

  /* ---------------- mutations ---------------- */
  const commitSheet = useCallback(
    (updater: (current: SpreadsheetSheet) => SpreadsheetSheet, record = true) => {
      if (record) {
        undoStack.current = [...undoStack.current.slice(-40), sheet];
        redoStack.current = [];
      }
      document$.setDoc((previous) => ({
        ...previous,
        sheets: previous.sheets.map((item) => (item.id === sheet.id ? updater(item) : item)),
        updatedAt: Date.now(),
      }));
    },
    [document$, sheet],
  );

  const undo = () => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(sheet);
    document$.setDoc((current) => ({
      ...current,
      sheets: current.sheets.map((item) => (item.id === previous.id ? previous : item)),
      updatedAt: Date.now(),
    }));
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(sheet);
    document$.setDoc((current) => ({
      ...current,
      sheets: current.sheets.map((item) => (item.id === next.id ? next : item)),
      updatedAt: Date.now(),
    }));
  };

  const setCellRaw = useCallback(
    (key: string, value: string, style?: CellStyle) => {
      commitSheet((current) => {
        const cells = { ...current.cells };
        if (value === '' && !style) delete cells[key];
        else cells[key] = { v: value, ...(style ? { s: style } : cells[key]?.s ? { s: cells[key].s } : {}) };
        return { ...current, cells };
      });
    },
    [commitSheet],
  );

  const applyStyle = useCallback(
    (patch: Partial<CellStyle>) => {
      commitSheet((current) => {
        const cells = { ...current.cells };
        for (const key of selectedKeys) {
          const existing = cells[key] ?? { v: '' };
          cells[key] = { ...existing, s: { ...existing.s, ...patch } };
        }
        return { ...current, cells };
      });
    },
    [commitSheet, selectedKeys],
  );

  const toggleStyle = (key: keyof CellStyle) => {
    const current = sheet.cells[activeKey]?.s?.[key];
    applyStyle({ [key]: !current } as Partial<CellStyle>);
  };

  const move = useCallback(
    (dRow: number, dCol: number, extend: boolean) => {
      setSelection((current) => {
        const focus: CellRef = {
          row: Math.min(sheet.rows, Math.max(1, (extend ? current.focus : current.anchor).row + dRow)),
          col: Math.min(sheet.cols, Math.max(1, (extend ? current.focus : current.anchor).col + dCol)),
        };
        return extend ? { anchor: current.anchor, focus } : { anchor: focus, focus };
      });
    },
    [sheet.cols, sheet.rows],
  );

  const startEditing = (key: string, initial?: string) => {
    setEditing({ key, value: initial ?? sheet.cells[key]?.v ?? '' });
    window.setTimeout(() => {
      editRef.current?.focus();
      if (initial === undefined) editRef.current?.select();
      else editRef.current?.setSelectionRange(editRef.current.value.length, editRef.current.value.length);
    }, 0);
  };

  const commitEdit = (direction: 'down' | 'right' | 'none' = 'down') => {
    if (!editing) return;
    const { raw, detectedFormat } = parseUserInput(editing.value);
    setCellRaw(editing.key, raw, detectedFormat ? { format: detectedFormat } : undefined);
    setEditing(null);
    if (direction !== 'none') move(direction === 'down' ? 1 : 0, direction === 'right' ? 1 : 0, false);
  };

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typingElsewhere = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) && target !== editRef.current;
      if (typingElsewhere) return;

      if (editing) return;

      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void document$.save();
        return;
      }
      if (meta && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleStyle('bold');
        return;
      }
      if (meta && event.key.toLowerCase() === 'i') {
        event.preventDefault();
        toggleStyle('italic');
        return;
      }
      if (meta && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        toggleStyle('underline');
        return;
      }
      if (meta && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copySelection();
        return;
      }
      if (meta && event.key.toLowerCase() === 'x') {
        event.preventDefault();
        void copySelection();
        clearSelection();
        return;
      }
      if (meta && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        void pasteSelection();
        return;
      }
      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection({ anchor: { col: 1, row: 1 }, focus: { col: sheet.cols, row: Math.min(sheet.rows, 200) } });
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        move(event.shiftKey ? 1 : 1, 0, event.shiftKey);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1, 0, event.shiftKey);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        move(0, 1, event.shiftKey);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        move(0, -1, event.shiftKey);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        move(0, event.shiftKey ? -1 : 1, false);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        startEditing(activeKey);
        return;
      }
      if (event.key === 'F2') {
        event.preventDefault();
        startEditing(activeKey);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        clearSelection();
        return;
      }
      if (event.key.length === 1 && !meta && !event.altKey) {
        event.preventDefault();
        startEditing(activeKey, event.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---------------- clipboard ---------------- */
  const selectionBounds = () => {
    const cells = expandRange(selection.anchor, selection.focus);
    const minCol = Math.min(...cells.map((cell) => cell.col));
    const maxCol = Math.max(...cells.map((cell) => cell.col));
    const minRow = Math.min(...cells.map((cell) => cell.row));
    const maxRow = Math.max(...cells.map((cell) => cell.row));
    return { minCol, maxCol, minRow, maxRow };
  };

  const copySelection = async () => {
    const { minCol, maxCol, minRow, maxRow } = selectionBounds();
    const rows: string[] = [];
    const cells: Record<string, { v: string; s?: CellStyle }> = {};
    for (let row = minRow; row <= maxRow; row += 1) {
      const line: string[] = [];
      for (let col = minCol; col <= maxCol; col += 1) {
        const key = refToKey({ col, row });
        const cell = sheet.cells[key];
        line.push(cell?.v ?? '');
        if (cell) cells[refToKey({ col: col - minCol + 1, row: row - minRow + 1 })] = cell;
      }
      rows.push(line.join('\t'));
    }
    const tsv = rows.join('\n');
    internalClipboard.current = { tsv, cells };
    try {
      await navigator.clipboard.writeText(tsv);
    } catch {
      /* clipboard permission denied — the internal buffer still works */
    }
  };

  const pasteSelection = async () => {
    let tsv = internalClipboard.current?.tsv ?? '';
    try {
      const text = await navigator.clipboard.readText();
      if (text) tsv = text;
    } catch {
      /* fall back to the internal clipboard */
    }
    if (!tsv) return;
    const lines = tsv.replace(/\r/g, '').split('\n');
    const start = selection.focus;
    commitSheet((current) => {
      const cells = { ...current.cells };
      lines.forEach((line, rowIndex) => {
        line.split('\t').forEach((value, colIndex) => {
          const col = start.col + colIndex;
          const row = start.row + rowIndex;
          if (col > current.cols || row > current.rows) return;
          const key = refToKey({ col, row });
          const parsed = parseUserInput(value);
          if (parsed.raw === '') delete cells[key];
          else cells[key] = { v: parsed.raw, ...(parsed.detectedFormat ? { s: { format: parsed.detectedFormat } } : {}) };
        });
      });
      return { ...current, cells };
    });
  };

  const clearSelection = () => {
    commitSheet((current) => {
      const cells = { ...current.cells };
      for (const key of selectedKeys) {
        if (cells[key]) cells[key] = { v: '', s: cells[key].s };
        if (cells[key] && !cells[key].s) delete cells[key];
      }
      return { ...current, cells };
    });
  };

  /* ---------------- rows / columns ---------------- */
  const insertRow = (before = true) => {
    const rowIndex = before ? selection.focus.row : selection.focus.row + 1;
    commitSheet((current) => {
      const cells: Record<string, { v: string; s?: CellStyle }> = {};
      for (const [key, cell] of Object.entries(current.cells)) {
        const ref = keyToRef(key);
        if (!ref) continue;
        cells[ref.row >= rowIndex ? refToKey({ ...ref, row: ref.row + 1 }) : key] = cell;
      }
      return { ...current, cells, rows: current.rows + 1 };
    });
  };

  const deleteRow = () => {
    const rowIndex = selection.focus.row;
    commitSheet((current) => {
      const cells: Record<string, { v: string; s?: CellStyle }> = {};
      for (const [key, cell] of Object.entries(current.cells)) {
        const ref = keyToRef(key);
        if (!ref || ref.row === rowIndex) continue;
        cells[ref.row > rowIndex ? refToKey({ ...ref, row: ref.row - 1 }) : key] = cell;
      }
      return { ...current, cells, rows: Math.max(10, current.rows - 1) };
    });
  };

  const insertCol = (before = true) => {
    const colIndex = before ? selection.focus.col : selection.focus.col + 1;
    commitSheet((current) => {
      const cells: Record<string, { v: string; s?: CellStyle }> = {};
      const widths: Record<string, number> = {};
      for (const [key, cell] of Object.entries(current.cells)) {
        const ref = keyToRef(key);
        if (!ref) continue;
        cells[ref.col >= colIndex ? refToKey({ ...ref, col: ref.col + 1 }) : key] = cell;
      }
      for (let col = current.cols; col >= colIndex; col -= 1) {
        widths[colToLetter(col + 1)] = current.colWidths[colToLetter(col)] ?? 96;
      }
      for (let col = 1; col < colIndex; col += 1) widths[colToLetter(col)] = current.colWidths[colToLetter(col)] ?? 96;
      widths[colToLetter(colIndex)] = 96;
      return { ...current, cells, colWidths: widths, cols: current.cols + 1 };
    });
  };

  const deleteCol = () => {
    const colIndex = selection.focus.col;
    commitSheet((current) => {
      const cells: Record<string, { v: string; s?: CellStyle }> = {};
      for (const [key, cell] of Object.entries(current.cells)) {
        const ref = keyToRef(key);
        if (!ref || ref.col === colIndex) continue;
        cells[ref.col > colIndex ? refToKey({ ...ref, col: ref.col - 1 }) : key] = cell;
      }
      const widths: Record<string, number> = {};
      for (let col = 1; col <= current.cols; col += 1) {
        const source = col >= colIndex ? col + 1 : col;
        widths[colToLetter(col)] = current.colWidths[colToLetter(source)] ?? 96;
      }
      return { ...current, cells, colWidths: widths, cols: Math.max(4, current.cols - 1) };
    });
  };

  const sortSelection = (direction: 'asc' | 'desc') => {
    const { minCol, maxCol, minRow, maxRow } = selectionBounds();
    if (maxRow <= minRow) return;
    commitSheet((current) => {
      const rows: { key: string; value: CellValue; cells: Record<string, { v: string; s?: CellStyle }> }[] = [];
      for (let row = minRow; row <= maxRow; row += 1) {
        const rowCells: Record<string, { v: string; s?: CellStyle }> = {};
        for (let col = minCol; col <= maxCol; col += 1) {
          const key = refToKey({ col, row });
          if (current.cells[key]) rowCells[key] = current.cells[key];
        }
        const sortValue = computed[refToKey({ col: minCol, row })] ?? '';
        rows.push({ key: String(row), value: sortValue, cells: rowCells });
      }
      rows.sort((a, b) => {
        const left = typeof a.value === 'number' ? a.value : String(a.value).toLowerCase();
        const right = typeof b.value === 'number' ? b.value : String(b.value).toLowerCase();
        if (left < right) return direction === 'asc' ? -1 : 1;
        if (left > right) return direction === 'asc' ? 1 : -1;
        return 0;
      });
      const cells = { ...current.cells };
      rows.forEach((entry, index) => {
        const targetRow = minRow + index;
        Object.entries(entry.cells).forEach(([key, cell]) => {
          const ref = keyToRef(key);
          if (!ref) return;
          delete cells[key];
          cells[refToKey({ col: ref.col, row: targetRow })] = cell;
        });
      });
      return { ...current, cells };
    });
  };

  const freezeAt = () => {
    const active = sheet.frozenRows > 0 || sheet.frozenCols > 0;
    commitSheet((current) => ({
      ...current,
      frozenRows: active ? 0 : Math.max(0, selection.focus.row - 1),
      frozenCols: active ? 0 : Math.max(0, selection.focus.col - 1),
    }));
  };

  /* ---------------- sheets ---------------- */
  const addSheet = () => {
    document$.setDoc((current) => {
      const next = createSheet(`${t('excel.sheet')}${current.sheets.length + 1}`);
      return { ...current, sheets: [...current.sheets, next], activeSheetId: next.id, updatedAt: Date.now() };
    });
  };

  const switchSheet = (id: string) => {
    setSelection({ anchor: { col: 1, row: 1 }, focus: { col: 1, row: 1 } });
    document$.setDoc((current) => ({ ...current, activeSheetId: id }));
  };

  const renameSheet = (id: string) => {
    const target = doc.sheets.find((item) => item.id === id);
    openDialog({
      kind: 'prompt',
      title: t('common.rename'),
      defaultValue: target?.name ?? '',
      onConfirm: (value) =>
        document$.setDoc((current) => ({
          ...current,
          sheets: current.sheets.map((item) => (item.id === id ? { ...item, name: value.trim() || item.name } : item)),
        })),
    });
  };

  const deleteSheet = (id: string) => {
    if (doc.sheets.length <= 1) return;
    openDialog({
      kind: 'confirm',
      title: t('common.confirmTitle'),
      message: 'Delete this sheet and everything in it?',
      danger: true,
      onConfirm: () =>
        document$.setDoc((current) => {
          const sheets = current.sheets.filter((item) => item.id !== id);
          return { ...current, sheets, activeSheetId: current.activeSheetId === id ? sheets[0].id : current.activeSheetId };
        }),
    });
  };

  /* ---------------- import / export ---------------- */
  const exportCsv = () => {
    const lines: string[] = [];
    for (let row = 1; row <= sheet.rows; row += 1) {
      const cells: string[] = [];
      let hasValue = false;
      for (let col = 1; col <= sheet.cols; col += 1) {
        const key = refToKey({ col, row });
        const value = computed[key];
        const text = value === undefined || value === '' ? '' : displayValue(value);
        if (text) hasValue = true;
        cells.push(/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
      }
      if (hasValue) lines.push(cells.join(','));
      else if (lines.length) lines.push('');
    }
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    downloadText(lines.join('\n'), `${document$.node?.name?.replace(/\.xlsx$/i, '') ?? 'workbook'}.csv`, 'text/csv;charset=utf-8');
  };

  const importCsv = async () => {
    const files = await pickFiles('.csv,text/csv', false);
    if (!files.length) return;
    const text = await readFileAsText(files[0]);
    const rows = parseCsv(text);
    commitSheet((current) => {
      const cells: Record<string, { v: string; s?: CellStyle }> = {};
      rows.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          if (!value) return;
          const parsed = parseUserInput(value);
          cells[refToKey({ col: colIndex + 1, row: rowIndex + 1 })] = { v: parsed.raw, ...(parsed.detectedFormat ? { s: { format: parsed.detectedFormat } } : {}) };
        });
      });
      return {
        ...current,
        cells,
        rows: Math.max(current.rows, rows.length + 20),
        cols: Math.max(current.cols, Math.max(1, ...rows.map((row) => row.length)) + 5),
      };
    });
    setImportNote(`Imported ${rows.length} rows from ${files[0].name}`);
  };

  const exportWorkbook = async () => {
    const computedBySheet: Record<string, Record<string, unknown>> = {};
    for (const item of doc.sheets) {
      const values = evaluateSheet((key) => item.cells[key]?.v, Object.keys(item.cells)).values;
      computedBySheet[item.id] = values;
    }
    await exportXlsx(doc, computedBySheet, `${document$.node?.name?.replace(/\.xlsx$/i, '') ?? 'workbook'}.xlsx`);
  };

  const importWorkbook = async () => {
    const files = await pickFiles('.xlsx', false);
    if (!files.length) return;
    try {
      const buffer = await readFileAsArrayBuffer(files[0]);
      const sheets = await importXlsx(buffer);
      document$.setDoc(() => {
        const created = sheets.map((imported) => {
          const next = createSheet(imported.name);
          next.cells = imported.cells;
          let maxRow = 0;
          let maxCol = 0;
          for (const key of Object.keys(imported.cells)) {
            const ref = keyToRef(key);
            if (!ref) continue;
            maxRow = Math.max(maxRow, ref.row);
            maxCol = Math.max(maxCol, ref.col);
          }
          next.rows = Math.max(next.rows, maxRow + 20);
          next.cols = Math.max(next.cols, maxCol + 5);
          return next;
        });
        return { version: 1, sheets: created, activeSheetId: created[0].id, updatedAt: Date.now() };
      });
      setImportNote(t('excel.mergeNote'));
    } catch (error) {
      console.warn('[Excel] import failed', error);
      setImportNote('That file could not be read as .xlsx');
    }
  };

  /* ---------------- charts ---------------- */
  const addChart = () => {
    const { minCol, maxCol, minRow, maxRow } = selectionBounds();
    const range = `${refToKey({ col: minCol, row: minRow })}:${refToKey({ col: maxCol, row: maxRow })}`;
    const chart: SheetChart = {
      id: uid('chart'),
      type: chartForm.type,
      title: chartForm.title || 'Chart',
      range,
      labelColumn: colToLetter(minCol),
    };
    commitSheet((current) => ({ ...current, charts: [...(current.charts ?? []), chart] }));
    setChartOpen(false);
  };

  const chartData = useCallback(
    (chart: SheetChart) => {
      const [startKey, endKey] = chart.range.split(':');
      const start = keyToRef(startKey);
      const end = keyToRef(endKey ?? startKey);
      if (!start || !end) return [];
      const labelCol = chart.labelColumn ? letterToCol(chart.labelColumn) : start.col;
      const valueCol = labelCol === end.col ? labelCol : Math.min(end.col, labelCol + 1);
      const points: { label: string; value: number }[] = [];
      for (let row = start.row; row <= end.row; row += 1) {
        const labelValue = computed[refToKey({ col: labelCol, row })];
        const rawValue = computed[refToKey({ col: valueCol, row })];
        const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
        if (labelValue === undefined || labelValue === '') continue;
        points.push({ label: displayValue(labelValue), value: Number.isFinite(value) ? value : 0 });
      }
      return points;
    },
    [computed],
  );

  /* ---------------- column resizing ---------------- */
  const resizing = useRef<{ letter: string; startX: number; startWidth: number } | null>(null);
  const beginColumnResize = (event: React.PointerEvent, letter: string) => {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = { letter, startX: event.clientX, startWidth: sheet.colWidths[letter] ?? 96 };
    const onMove = (moveEvent: PointerEvent) => {
      const state = resizing.current;
      if (!state) return;
      const width = Math.max(40, state.startWidth + (moveEvent.clientX - state.startX));
      commitSheet((current) => ({ ...current, colWidths: { ...current.colWidths, [state.letter]: Math.round(width) } }), false);
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const resizingRow = useRef<{ row: number; startY: number; startHeight: number } | null>(null);
  const beginRowResize = (event: React.PointerEvent, row: number) => {
    event.preventDefault();
    event.stopPropagation();
    resizingRow.current = { row, startY: event.clientY, startHeight: sheet.rowHeights[String(row)] ?? ROW_HEIGHT };
    const onMove = (moveEvent: PointerEvent) => {
      const state = resizingRow.current;
      if (!state) return;
      const height = Math.max(18, state.startHeight + (moveEvent.clientY - state.startY));
      commitSheet((current) => ({ ...current, rowHeights: { ...current.rowHeights, [String(state.row)]: Math.round(height) } }), false);
    };
    const onUp = () => {
      resizingRow.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /* ---------------- geometry + virtualised rows ---------------- */
  const rowTops = useMemo(() => {
    const tops: number[] = [0];
    for (let row = 1; row <= sheet.rows; row += 1) tops[row] = tops[row - 1] + (sheet.rowHeights[String(row)] ?? ROW_HEIGHT);
    return tops;
  }, [sheet.rows, sheet.rowHeights]);

  const totalHeight = rowTops[sheet.rows] ?? 0;

  const firstRow = useMemo(() => {
    let row = Math.max(1, Math.floor(scrollTop / ROW_HEIGHT) - 3);
    while (row > 1 && (rowTops[row] ?? 0) > scrollTop) row -= 1;
    while (row < sheet.rows && (rowTops[row + 1] ?? 0) < scrollTop) row += 1;
    return row;
  }, [scrollTop, rowTops, sheet.rows]);

  const lastRow = useMemo(() => {
    const bottom = scrollTop + (gridRef.current?.clientHeight ?? 600) + ROW_HEIGHT * 2;
    let row = firstRow;
    while (row < sheet.rows && (rowTops[row] ?? 0) < bottom) row += 1;
    return Math.min(sheet.rows, row);
  }, [firstRow, scrollTop, rowTops, sheet.rows]);

  const rows = useMemo(() => {
    const list: number[] = [];
    for (let row = firstRow; row <= lastRow; row += 1) list.push(row);
    return list;
  }, [firstRow, lastRow]);

  const frozenRowList = useMemo(() => {
    const list: number[] = [];
    for (let row = 1; row <= sheet.frozenRows; row += 1) list.push(row);
    return list;
  }, [sheet.frozenRows]);

  const colOffsets = useMemo(() => {
    const offsets: number[] = [0];
    for (let col = 1; col <= sheet.cols; col += 1) offsets[col] = offsets[col - 1] + (sheet.colWidths[colToLetter(col)] ?? 96);
    return offsets;
  }, [sheet.cols, sheet.colWidths]);

  const totalWidth = colOffsets[sheet.cols] ?? 0;
  const frozenWidth = colOffsets[sheet.frozenCols] ?? 0;

  const isSelected = (key: string) => selectedKeys.includes(key);
  const inRange = (col: number, row: number) => {
    const a = selection.anchor;
    const b = selection.focus;
    return col >= Math.min(a.col, b.col) && col <= Math.max(a.col, b.col) && row >= Math.min(a.row, b.row) && row <= Math.max(a.row, b.row);
  };

  const cellMenu = (event: React.MouseEvent, key: string) => {
    event.preventDefault();
    const ref = keyToRef(key);
    if (!ref) return;
    if (!isSelected(key)) setSelection({ anchor: ref, focus: ref });
    useShellStore.getState().openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: key,
      items: [
        { id: 'cut', label: t('common.cut'), icon: 'Scissors', shortcut: 'Ctrl+X', action: () => void copySelection().then(clearSelection) },
        { id: 'copy', label: t('common.copy'), icon: 'Copy', shortcut: 'Ctrl+C', action: () => void copySelection() },
        { id: 'paste', label: t('common.paste'), icon: 'Clipboard', shortcut: 'Ctrl+V', action: () => void pasteSelection() },
        { id: 'clear', label: t('excel.clearCells'), icon: 'Trash2', action: () => clearSelection() },
        { id: 'sep1', label: '', separator: true },
        { id: 'insert-row', label: t('excel.insertRow'), icon: 'Plus', action: () => insertRow(true) },
        { id: 'insert-col', label: t('excel.insertCol'), icon: 'Plus', action: () => insertCol(true) },
        { id: 'delete-row', label: t('excel.deleteRow'), icon: 'Trash2', action: () => deleteRow() },
        { id: 'delete-col', label: t('excel.deleteCol'), icon: 'Trash2', action: () => deleteCol() },
        { id: 'sep2', label: '', separator: true },
        { id: 'format', label: 'Format cells…', icon: 'Grid2x2', action: () => setFormatOpen(true) },
        { id: 'sort-asc', label: t('excel.sortAsc'), icon: 'ArrowUpDown', action: () => sortSelection('asc') },
        { id: 'sort-desc', label: t('excel.sortDesc'), icon: 'ArrowUpDown', action: () => sortSelection('desc') },
        { id: 'chart', label: t('excel.chart'), icon: 'Grid2x2', action: () => setChartOpen(true) },
      ],
    });
  };

  const columnHeaderMenu = (event: React.MouseEvent, col: number) => {
    event.preventDefault();
    useShellStore.getState().openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: colToLetter(col),
      items: [
        { id: 'insert-before', label: `Insert column left`, icon: 'Plus', action: () => { setSelection({ anchor: { col, row: 1 }, focus: { col, row: 1 } }); insertCol(true); } },
        { id: 'insert-after', label: `Insert column right`, icon: 'Plus', action: () => { setSelection({ anchor: { col, row: 1 }, focus: { col, row: 1 } }); insertCol(false); } },
        { id: 'delete', label: t('excel.deleteCol'), icon: 'Trash2', danger: true, action: () => { setSelection({ anchor: { col, row: 1 }, focus: { col, row: 1 } }); deleteCol(); } },
      ],
    });
  };

  const rowHeaderMenu = (event: React.MouseEvent, row: number) => {
    event.preventDefault();
    useShellStore.getState().openContextMenu({
      x: event.clientX,
      y: event.clientY,
      title: String(row),
      items: [
        { id: 'insert-before', label: 'Insert row above', icon: 'Plus', action: () => { setSelection({ anchor: { col: 1, row }, focus: { col: 1, row } }); insertRow(true); } },
        { id: 'insert-after', label: 'Insert row below', icon: 'Plus', action: () => { setSelection({ anchor: { col: 1, row }, focus: { col: 1, row } }); insertRow(false); } },
        { id: 'delete', label: t('excel.deleteRow'), icon: 'Trash2', danger: true, action: () => { setSelection({ anchor: { col: 1, row }, focus: { col: 1, row } }); deleteRow(); } },
      ],
    });
  };

  const charts = sheet.charts ?? [];

  const playSoundSafe = (name: Parameters<typeof import('../../services/sound').playSound>[0]) => {
    import('../../services/sound').then((mod) => mod.playSound(name)).catch(() => undefined);
  };

  const cfStyles = useMemo(
    () => compileConditionalFormats(sheet.conditionalFormats ?? [], (key) => computed[key]),
    [sheet.conditionalFormats, computed],
  );

  const selectionRangeText = (() => {
    const a = refToKey(selection.anchor);
    const b = refToKey(selection.focus);
    return a === b ? a : `${a}:${b}`;
  })();

  const applyConditionalFormat = () => {
    const rule: ConditionalFormatRule = {
      id: `cf-${Date.now().toString(36)}`,
      type: cfType,
      range: selectionRangeText,
      value: cfValue.trim() === '' ? undefined : cfValue.trim(),
    };
    commitSheet((current) => ({ ...current, conditionalFormats: [...(current.conditionalFormats ?? []), rule] }));
    playSoundSafe('click');
  };

  /** Renders one row of cells; shared by the scrollable body and frozen panes. */
  const cellsForRow = (row: number, frozen = false) => {
    const height = sheet.rowHeights[String(row)] ?? ROW_HEIGHT;
    return Array.from({ length: sheet.cols }, (_, index) => {
      const col = index + 1;
      const key = refToKey({ col, row });
      const width = sheet.colWidths[colToLetter(col)] ?? 96;
      const left = colOffsets[col - 1] ?? 0;
      const cell = sheet.cells[key];
      const value = computed[key];
      const cfStyle = cfStyles.get(key);
      const text =
        value === undefined || value === ''
          ? ''
          : formatCellValue(value, cell?.s, { currency, locale: locale.language === 'fa' ? 'fa-IR' : 'en-US', numberSystem: locale.numberSystem });
      const error = isError(value);
      const selected = isSelected(key);
      const ranged = inRange(col, row);
      const isEditing = !frozen && editing?.key === key;
      const align = cell?.s?.align ?? (typeof value === 'number' ? 'right' : 'left');
      return (
        <div
          key={key}
          className={`sheet-cell ${selected ? 'selected' : ranged ? 'in-range' : ''} ${error ? 'error' : ''}`}
          style={{
            width,
            height,
            position: 'absolute',
            left,
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
            textAlign: align,
            fontWeight: cell?.s?.bold ? 700 : undefined,
            fontStyle: cell?.s?.italic ? 'italic' : undefined,
            textDecoration: cell?.s?.underline ? 'underline' : undefined,
            color: cfStyle?.color ?? cell?.s?.color ?? (error ? '#dc2626' : undefined),
            background: cfStyle?.background ?? cell?.s?.background ?? undefined,
            borderTop: cell?.s?.borders?.top ? '1px solid #94a3b8' : undefined,
            borderBottom: cell?.s?.borders?.bottom ? '1px solid #94a3b8' : undefined,
            borderLeft: cell?.s?.borders?.left ? '1px solid #94a3b8' : undefined,
            borderRight: cell?.s?.borders?.right ? '1px solid #94a3b8' : undefined,
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const ref = { col, row };
            if (event.shiftKey) setSelection((current) => ({ anchor: current.anchor, focus: ref }));
            else {
              setSelection({ anchor: ref, focus: ref });
              dragSelect.current = { active: true, origin: ref };
            }
            gridRef.current?.focus();
          }}
          onPointerEnter={() => {
            const state = dragSelect.current;
            if (!state?.active) return;
            setSelection({ anchor: state.origin, focus: { col, row } });
          }}
          onDoubleClick={() => startEditing(key)}
          onContextMenu={(event) => cellMenu(event, key)}
          title={cell?.v?.startsWith('=') ? cell.v : undefined}
        >
          {cfStyle?.bar !== undefined && !isEditing ? (
            <span
              className="pointer-events-none absolute bottom-[2px] left-[2px] top-[2px] rounded-[2px] bg-[var(--accent)]/35"
              style={{ width: `calc(${Math.round(cfStyle.bar * 100)}% - 4px)` }}
            />
          ) : null}
          {isEditing ? (
            <input
              ref={editRef}
              value={editing?.value ?? ''}
              onChange={(event) => setEditing({ key, value: event.target.value })}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitEdit('down');
                } else if (event.key === 'Tab') {
                  event.preventDefault();
                  commitEdit('right');
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  setEditing(null);
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  commitEdit('none');
                  move(-1, 0, false);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  commitEdit('none');
                  move(1, 0, false);
                }
              }}
              onBlur={() => commitEdit('none')}
              className="h-full w-full border border-[var(--accent)] bg-[var(--surface-solid)] px-1 font-mono text-[12px] outline-none"
              style={{ textAlign: align }}
              dir="ltr"
            />
          ) : (
            <span className="truncate" style={{ width: '100%' }}>
              {text}
            </span>
          )}
        </div>
      );
    });
  };

  const rowBlock = (row: number, top: number) => (
    <div key={row} style={{ position: 'absolute', top, left: 0, width: totalWidth, height: sheet.rowHeights[String(row)] ?? ROW_HEIGHT }}>
      {cellsForRow(row)}
    </div>
  );

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <Toolbar>
        <ToolButton icon={<Save size={15} />} label={t('common.save')} onClick={() => void document$.save()} />
        <ToolButton icon={<Undo2 size={15} />} title={t('word.undo')} onClick={undo} />
        <ToolButton icon={<Redo2 size={15} />} title={t('word.redo')} onClick={redo} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Bold size={15} />} title={t('excel.bold')} active={Boolean(sheet.cells[activeKey]?.s?.bold)} onClick={() => toggleStyle('bold')} />
        <ToolButton icon={<Italic size={15} />} title={t('word.italic')} active={Boolean(sheet.cells[activeKey]?.s?.italic)} onClick={() => toggleStyle('italic')} />
        <ToolButton icon={<Palette size={15} />} title={t('excel.cf')} active={cfOpen} onClick={() => setCfOpen((value) => !value)} />
        <ToolButton icon={<Underline size={15} />} title={t('word.underline')} active={Boolean(sheet.cells[activeKey]?.s?.underline)} onClick={() => toggleStyle('underline')} />
        <ColorMenu icon={<PaintBucket size={15} />} title={t('excel.fill')} colors={FILL_COLORS} onPick={(color) => applyStyle({ background: color === 'transparent' ? undefined : color })} />
        <ColorMenu icon={<Type size={15} />} title={t('excel.fontColor')} colors={FONT_COLORS} onPick={(color) => applyStyle({ color })} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<AlignLeft size={15} />} title={t('word.alignLeft')} onClick={() => applyStyle({ align: 'left' })} />
        <ToolButton icon={<AlignCenter size={15} />} title={t('word.alignCenter')} onClick={() => applyStyle({ align: 'center' })} />
        <ToolButton icon={<AlignRight size={15} />} title={t('word.alignRight')} onClick={() => applyStyle({ align: 'right' })} />
        <ToolButton icon={<BorderAll size={15} />} title={t('excel.borders')} onClick={() => applyStyle({ borders: { top: true, bottom: true, left: true, right: true } })} />
        <FormatMenu value={sheet.cells[activeKey]?.s?.format ?? 'general'} onPick={(format) => applyStyle({ format, decimals: format === 'number' ? 2 : undefined })} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<Plus size={15} />} title={t('excel.insertRow')} onClick={() => insertRow(true)} />
        <ToolButton icon={<Trash2 size={15} />} title={t('excel.deleteRow')} onClick={deleteRow} />
        <ToolButton icon={<ArrowDownUp size={15} />} title={t('excel.sortAsc')} onClick={() => sortSelection('asc')} />
        <ToolButton
          icon={<Snowflake size={15} />}
          title={sheet.frozenRows || sheet.frozenCols ? t('excel.unfreeze') : t('excel.freeze')}
          active={Boolean(sheet.frozenRows || sheet.frozenCols)}
          onClick={freezeAt}
        />
        <ToolButton icon={<BarChart3 size={15} />} title={t('excel.chart')} onClick={() => setChartOpen(true)} />
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <ToolButton icon={<FileDown size={15} />} title={t('excel.exportCsv')} onClick={exportCsv} />
        <ToolButton icon={<FileUp size={15} />} title={t('excel.importCsv')} onClick={() => void importCsv()} />
        <ToolButton icon={<FileDown size={15} />} title={t('excel.exportXlsx')} onClick={() => void exportWorkbook()} />
        <ToolButton icon={<FileUp size={15} />} title={t('excel.importXlsx')} onClick={() => void importWorkbook()} />
        <ToolButton icon={<HelpCircle size={15} />} title={t('excel.formulaHelp')} active={helpOpen} onClick={() => setHelpOpen((value) => !value)} />
        <span className="ms-auto flex items-center gap-2 pe-1">
          {document$.dirty ? <Badge tone="warning">{t('common.unsaved')}</Badge> : <Badge tone="success">{t('common.saved')}</Badge>}
        </span>
      </Toolbar>

      {/* Name box + formula bar */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
        <input
          value={activeKey}
          onChange={(event) => {
            const ref = keyToRef(event.target.value.toUpperCase());
            if (ref) setSelection({ anchor: ref, focus: ref });
          }}
          className="win-input h-7 w-20 text-center font-mono text-[12px]"
          aria-label={t('excel.nameBox')}
        />
        <span className="text-[13px] font-bold opacity-40">fx</span>
        <input
          value={editing?.key === activeKey ? editing.value : (sheet.cells[activeKey]?.v ?? '')}
          onChange={(event) => {
            const value = event.target.value;
            if (editing?.key === activeKey) setEditing({ key: activeKey, value });
            else {
              setEditing({ key: activeKey, value });
              window.setTimeout(() => editRef.current?.focus(), 0);
            }
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              commitEdit('down');
              gridRef.current?.focus();
            }
            if (event.key === 'Escape') setEditing(null);
          }}
          onBlur={() => {
            if (editing) commitEdit('none');
          }}
          className="win-input h-7 flex-1 font-mono text-[12px]"
          placeholder={t('excel.formulaBar')}
          aria-label={t('excel.formulaBar')}
          dir="ltr"
        />
      </div>

      {helpOpen ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[11.5px]">
          <p className="mb-1 font-semibold">{t('excel.functions')}</p>
          <p className="opacity-75">{SUPPORTED_FUNCTIONS.join(' · ')}</p>
          <p className="mt-1 opacity-60">
            Examples: <code>=SUM(B2:B8)</code> · <code>=IF(A1&gt;10,"yes","no")</code> · <code>=AVERAGE(B2:B8)*1.1</code> · <code>=VLOOKUP(A2,A1:C9,3,FALSE)</code> · <code>=XLOOKUP(A2,A2:A9,C2:C9,"n/a")</code> · <code>=SPARKLINE(B2:H2)</code>
          </p>
        </div>
      ) : null}

      {cfOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-wide opacity-55">{t('excel.cf')}</span>
          {(['greater', 'less', 'dataBar', 'colorScale', 'duplicates', 'contains'] as ConditionalFormatType[]).map((type) => (
            <button
              key={type}
              type="button"
              className={`segment-button px-2 py-1 text-[11px] ${cfType === type ? 'segment-active' : ''}`}
              onClick={() => setCfType(type)}
            >
              {t(`excel.cf.${type}`)}
            </button>
          ))}
          {cfType === 'greater' || cfType === 'less' || cfType === 'contains' ? (
            <input
              value={cfValue}
              onChange={(event) => setCfValue(event.target.value)}
              className="win-input h-7 w-28 text-[12px]"
              placeholder={t('excel.cf.value')}
              dir="ltr"
            />
          ) : null}
          <span className="text-[11px] tabular-nums opacity-60" dir="ltr">{selectionRangeText}</span>
          <button type="button" className="win-button win-button-accent h-7 px-3 text-[11.5px]" onClick={applyConditionalFormat}>
            {t('excel.cf.apply')}
          </button>
          {sheet.conditionalFormats?.length ? (
            <button
              type="button"
              className="win-button h-7 px-3 text-[11.5px]"
              onClick={() => commitSheet((current) => ({ ...current, conditionalFormats: [] }))}
            >
              {t('excel.cf.clear')} ({sheet.conditionalFormats.length})
            </button>
          ) : null}
        </div>
      ) : null}

      {importNote ? (
        <div className="flex items-center gap-2 border-b border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[11.5px]">
          <span>{importNote}</span>
          <button type="button" className="icon-button ms-auto h-5 w-5" onClick={() => setImportNote(null)} aria-label={t('common.close')}>
            <X size={12} />
          </button>
        </div>
      ) : null}

      {/* Grid */}
      <div className="flex min-h-0 flex-1">
        <div
          ref={gridRef}
          className="scroll-thin relative min-w-0 flex-1 overflow-auto"
          tabIndex={0}
          onScroll={(event) => {
            const element = event.target as HTMLDivElement;
            setScrollTop(element.scrollTop);
            setScrollLeft(element.scrollLeft);
          }}
          onPointerUp={() => {
            if (dragSelect.current) dragSelect.current = null;
          }}
        >
          <div style={{ width: totalWidth + HEADER_WIDTH, height: totalHeight + ROW_HEIGHT, position: 'relative' }}>
            {/* Corner */}
            <div
              className="z-40 border-b border-e border-[var(--border)] bg-[var(--surface-2)]"
              style={{ position: 'absolute', left: 0, top: 0, width: HEADER_WIDTH, height: ROW_HEIGHT, transform: `translate(${scrollLeft}px, ${scrollTop}px)` }}
            />

            {/* Column headers (stick vertically) */}
            <div
              className="z-30 flex"
              style={{ position: 'absolute', left: HEADER_WIDTH, top: 0, height: ROW_HEIGHT, width: totalWidth, transform: `translateY(${scrollTop}px)` }}
            >
              {Array.from({ length: sheet.cols }, (_, index) => {
                const col = index + 1;
                const letter = colToLetter(col);
                const width = sheet.colWidths[letter] ?? 96;
                const active = inRange(col, selection.focus.row);
                return (
                  <div
                    key={letter}
                    className="sheet-header relative shrink-0"
                    style={{ width, height: ROW_HEIGHT, background: active ? 'var(--accent-soft)' : undefined }}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      setSelection({ anchor: { col, row: 1 }, focus: { col, row: sheet.rows } });
                    }}
                    onContextMenu={(event) => columnHeaderMenu(event, col)}
                  >
                    {letter}
                    <span
                      className="absolute inset-y-0 end-0 w-1.5 cursor-col-resize"
                      onPointerDown={(event) => beginColumnResize(event, letter)}
                      role="separator"
                      aria-orientation="vertical"
                    />
                  </div>
                );
              })}
            </div>

            {/* Row headers (stick horizontally) */}
            <div
              className="z-30"
              style={{ position: 'absolute', left: 0, top: ROW_HEIGHT, width: HEADER_WIDTH, height: totalHeight, transform: `translateX(${scrollLeft}px)` }}
            >
              {rows.map((row) => (
                <div
                  key={row}
                  className="sheet-header"
                  style={{
                    position: 'absolute',
                    top: rowTops[row - 1] ?? 0,
                    left: 0,
                    height: sheet.rowHeights[String(row)] ?? ROW_HEIGHT,
                    width: HEADER_WIDTH,
                    background: inRange(selection.focus.col, row) ? 'var(--accent-soft)' : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    setSelection({ anchor: { col: 1, row }, focus: { col: sheet.cols, row } });
                  }}
                  onContextMenu={(event) => rowHeaderMenu(event, row)}
                >
                  {row}
                  <span
                    className="absolute inset-x-0 bottom-0 h-1 cursor-row-resize"
                    onPointerDown={(event) => beginRowResize(event, row)}
                    role="separator"
                    aria-orientation="horizontal"
                  />
                </div>
              ))}
            </div>

            {/* Cells */}
            <div style={{ position: 'absolute', left: HEADER_WIDTH, top: ROW_HEIGHT, width: totalWidth, height: totalHeight }}>
              {rows.map((row) => rowBlock(row, rowTops[row - 1] ?? 0))}
            </div>

            {/* Frozen rows */}
            {frozenRowList.length ? (
              <div
                className="z-20 border-b border-[var(--border)] bg-[var(--surface-solid)]"
                style={{
                  position: 'absolute',
                  left: HEADER_WIDTH,
                  top: ROW_HEIGHT,
                  width: totalWidth,
                  height: rowTops[sheet.frozenRows] ?? 0,
                  transform: `translate(${scrollLeft}px, ${scrollTop}px)`,
                }}
              >
                {frozenRowList.map((row) => rowBlock(row, rowTops[row - 1] ?? 0))}
              </div>
            ) : null}

            {/* Frozen columns */}
            {sheet.frozenCols > 0 ? (
              <div
                className="z-20 border-e border-[var(--border)] bg-[var(--surface-solid)]"
                style={{
                  position: 'absolute',
                  left: HEADER_WIDTH,
                  top: ROW_HEIGHT,
                  width: frozenWidth,
                  height: totalHeight,
                  transform: `translate(${scrollLeft}px, ${scrollTop}px)`,
                  overflow: 'hidden',
                }}
              >
                <div style={{ position: 'relative', width: frozenWidth, height: totalHeight }}>
                  {rows.map((row) => (
                    <div key={row} style={{ position: 'absolute', top: rowTops[row - 1] ?? 0, left: 0, width: totalWidth, height: sheet.rowHeights[String(row)] ?? ROW_HEIGHT }}>
                      {Array.from({ length: sheet.frozenCols }, (_, index) => cellsForRow(row, true)[index])}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Charts panel */}
        {charts.length ? (
          <aside className="scroll-thin w-72 shrink-0 overflow-y-auto border-s border-[var(--border)] bg-[var(--surface-2)] p-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide opacity-55">{t('excel.chart')}</p>
            {charts.map((chart) => {
              const data = chartData(chart);
              return (
                <div key={chart.id} className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-solid)] p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="truncate text-[11.5px] font-medium">{chart.title}</span>
                    <button
                      type="button"
                      className="icon-button h-5 w-5"
                      onClick={() => commitSheet((current) => ({ ...current, charts: (current.charts ?? []).filter((item) => item.id !== chart.id) }))}
                      aria-label={t('common.remove')}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {data.length === 0 ? (
                    <p className="py-4 text-center text-[11px] opacity-55">No numeric data in {chart.range}</p>
                  ) : chart.type === 'line' ? (
                    <LineChart data={data} height={120} />
                  ) : chart.type === 'pie' ? (
                    <PieChart size={120} data={data.map((point, index) => ({ label: point.label, value: point.value, color: ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][index % 6] }))} />
                  ) : (
                    <BarChart data={data} height={120} />
                  )}
                </div>
              );
            })}
          </aside>
        ) : null}
      </div>

      {/* Sheet tabs */}
      <div className="flex shrink-0 items-center gap-1 border-t border-[var(--border)] bg-[var(--surface-2)] px-2 py-1">
        {doc.sheets.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition ${
              item.id === sheet.id ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--hover)]'
            }`}
            onClick={() => switchSheet(item.id)}
            onDoubleClick={() => renameSheet(item.id)}
            onContextMenu={(event) => {
              event.preventDefault();
              useShellStore.getState().openContextMenu({
                x: event.clientX,
                y: event.clientY,
                title: item.name,
                items: [
                  { id: 'rename', label: t('common.rename'), icon: 'Pencil', action: () => renameSheet(item.id) },
                  { id: 'delete', label: t('common.delete'), icon: 'Trash2', danger: true, disabled: doc.sheets.length <= 1, action: () => deleteSheet(item.id) },
                ],
              });
            }}
          >
            {item.name}
          </button>
        ))}
        <ToolButton icon={<Plus size={14} />} title={t('excel.addSheet')} onClick={addSheet} />
      </div>

      {/* Status bar */}
      <footer className="flex shrink-0 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[11px]">
        <span className="opacity-70">{t('excel.selectedCells', { n: selectedKeys.length })}</span>
        {selectionStats.numbers ? (
          <>
            <span>
              {t('excel.sum')}: <strong className="tabular-nums">{formatCellValue(selectionStats.sum, { format: 'number', decimals: 2 }, { currency })}</strong>
            </span>
            <span>
              {t('excel.average')}: <strong className="tabular-nums">{formatCellValue(selectionStats.average, { format: 'number', decimals: 2 }, { currency })}</strong>
            </span>
            <span>
              {t('excel.count')}: <strong className="tabular-nums">{selectionStats.count}</strong>
            </span>
          </>
        ) : null}
        <span className="ms-auto flex items-center gap-2 opacity-60">
          {sheet.frozenRows || sheet.frozenCols ? <Badge tone="accent">frozen {sheet.frozenRows}/{sheet.frozenCols}</Badge> : null}
          <span>{t('excel.ready')}</span>
        </span>
      </footer>

      {/* Chart dialog */}
      <Modal
        open={chartOpen}
        title={t('excel.chart')}
        onClose={() => setChartOpen(false)}
        footer={
          <>
            <button type="button" className="win-button" onClick={() => setChartOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="win-button win-button-accent" onClick={addChart}>
              {t('common.add')}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('excel.chartType')}>
            <div className="flex gap-2">
              {([
                { type: 'bar', icon: <BarChart3 size={16} />, label: t('excel.barChart') },
                { type: 'line', icon: <LineChartIcon size={16} />, label: t('excel.lineChart') },
                { type: 'pie', icon: <PieChartIcon size={16} />, label: t('excel.pieChart') },
              ] as const).map((option) => (
                <button
                  key={option.type}
                  type="button"
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-[11.5px] transition ${
                    chartForm.type === option.type ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] hover:bg-[var(--hover)]'
                  }`}
                  onClick={() => setChartForm((form) => ({ ...form, type: option.type }))}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('common.name')}>
            <input className="win-input" value={chartForm.title} onChange={(event) => setChartForm((form) => ({ ...form, title: event.target.value }))} />
          </Field>
          <p className="text-[11px] opacity-60">
            Range: <code>{selectedKeys.length ? `${selectedKeys[0]}:${selectedKeys[selectedKeys.length - 1]}` : '—'}</code> — first column is used as labels, the
            second as values.
          </p>
        </div>
      </Modal>

      {/* Format cells */}
      <Modal open={formatOpen} title="Format cells" onClose={() => setFormatOpen(false)} footer={<button type="button" className="win-button win-button-accent" onClick={() => setFormatOpen(false)}>{t('common.ok')}</button>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('excel.formatNumber')}>
            <Select
              value={sheet.cells[activeKey]?.s?.format ?? 'general'}
              onChange={(value) => applyStyle({ format: value as CellFormat })}
              options={FORMATS.map((format) => ({ value: format.value, label: format.label }))}
            />
          </Field>
          <Field label="Decimal places">
            <input
              type="number"
              min={0}
              max={6}
              className="win-input"
              value={sheet.cells[activeKey]?.s?.decimals ?? 2}
              onChange={(event) => applyStyle({ decimals: Number(event.target.value) })}
            />
          </Field>
          <Field label={t('word.alignLeft')}>
            <Select
              value={sheet.cells[activeKey]?.s?.align ?? 'left'}
              onChange={(value) => applyStyle({ align: value as CellStyle['align'] })}
              options={[
                { value: 'left', label: t('word.alignLeft') },
                { value: 'center', label: t('word.alignCenter') },
                { value: 'right', label: t('word.alignRight') },
              ]}
            />
          </Field>
          <Field label={t('excel.borders')}>
            <div className="flex gap-2">
              <ToolButton icon={<BorderAll size={15} />} label="All" onClick={() => applyStyle({ borders: { top: true, bottom: true, left: true, right: true } })} />
              <ToolButton icon={<Ban size={15} />} label="None" onClick={() => applyStyle({ borders: {} })} />
            </div>
          </Field>
        </div>
        <p className="mt-3 text-[11px] opacity-60">Applies to {selectedKeys.length} selected cell(s).</p>
      </Modal>

      {doc.sheets.length === 0 ? <EmptyState icon={<Grid3x3 size={40} />} title="No sheets" /> : null}
    </div>
  );
}

function ColorMenu({ icon, title, colors, onPick }: { icon: React.ReactNode; title: string; colors: string[]; onPick: (color: string) => void }) {
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

function FormatMenu({ value, onPick }: { value: CellFormat; onPick: (format: CellFormat) => void }) {
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
      <ToolButton icon={<Grid3x3 size={15} />} title="Number format" active={open} onClick={() => setOpen((value) => !value)} />
      {open ? (
        <div className="panel absolute start-0 top-full z-40 mt-1 w-40 p-1">
          {FORMATS.map((format) => (
            <button
              key={format.value}
              type="button"
              className="list-row w-full justify-between"
              onClick={() => {
                onPick(format.value);
                setOpen(false);
              }}
            >
              <span className="flex items-center gap-2">
                {format.icon}
                {format.label}
              </span>
              {value === format.value ? <span className="text-[var(--accent)]">●</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Minimal CSV parser that respects quoted fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => cell !== ''));
}

export default ExcelApp;
