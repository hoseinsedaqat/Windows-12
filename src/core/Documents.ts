import type {
  FileKind,
  NoteDocument,
  PresentationDocument,
  Slide,
  SpreadsheetDocument,
  SpreadsheetSheet,
  WordDocument,
} from '../types';
import { uid } from '../services/id';
import { colToLetter } from './spreadsheet/cellref';

/** Factories for the document models stored inside the virtual file system. */

export const DEFAULT_SHEET_ROWS = 200;
export const DEFAULT_SHEET_COLS = 26;

export function createWordDocument(html = '', title = 'Document'): WordDocument {
  return {
    version: 1,
    html,
    title,
    pageSize: 'A4',
    margins: { top: 25, right: 25, bottom: 25, left: 25 },
    wordCount: 0,
    updatedAt: Date.now(),
  };
}

export function createSheet(name: string, rows = DEFAULT_SHEET_ROWS, cols = DEFAULT_SHEET_COLS): SpreadsheetSheet {
  return {
    id: uid('sheet'),
    name,
    rows,
    cols,
    cells: {},
    colWidths: Object.fromEntries(Array.from({ length: cols }, (_, index) => [colToLetter(index + 1), 96])),
    rowHeights: {},
    frozenRows: 0,
    frozenCols: 0,
  };
}

export function createSpreadsheet(sheetNames: string[] = ['Sheet1']): SpreadsheetDocument {
  const sheets = sheetNames.map((name) => createSheet(name));
  return { version: 1, sheets, activeSheetId: sheets[0].id, updatedAt: Date.now() };
}

export function createSlide(layout: Slide['layout'] = 'title-content', background = '#ffffff'): Slide {
  const id = uid('slide');
  const elements: Slide['elements'] = [];
  if (layout === 'title' || layout === 'section') {
    elements.push({
      id: uid('el'),
      type: 'title',
      x: 80,
      y: layout === 'section' ? 240 : 200,
      w: 800,
      h: 90,
      text: layout === 'section' ? 'Section title' : 'Click to add a title',
      fontSize: layout === 'section' ? 40 : 48,
      color: '#0f172a',
      bold: true,
      align: layout === 'section' ? 'left' : 'center',
    });
    if (layout === 'title') {
      elements.push({
        id: uid('el'),
        type: 'text',
        x: 80,
        y: 310,
        w: 800,
        h: 50,
        text: 'Click to add a subtitle',
        fontSize: 22,
        color: '#475569',
        align: 'center',
      });
    }
  } else if (layout === 'title-content') {
    elements.push({
      id: uid('el'),
      type: 'title',
      x: 60,
      y: 44,
      w: 840,
      h: 60,
      text: 'Click to add a title',
      fontSize: 32,
      color: '#0f172a',
      bold: true,
    });
    elements.push({
      id: uid('el'),
      type: 'text',
      x: 60,
      y: 130,
      w: 840,
      h: 320,
      text: 'Click to add text',
      fontSize: 20,
      color: '#334155',
    });
  } else if (layout === 'two-column') {
    elements.push({
      id: uid('el'),
      type: 'title',
      x: 60,
      y: 44,
      w: 840,
      h: 60,
      text: 'Click to add a title',
      fontSize: 32,
      color: '#0f172a',
      bold: true,
    });
    for (const [index, x] of [60, 500].entries()) {
      elements.push({
        id: uid('el'),
        type: 'text',
        x,
        y: 130,
        w: 400,
        h: 320,
        text: `Column ${index + 1} text`,
        fontSize: 18,
        color: '#334155',
      });
    }
  }
  return { id, layout, background, elements };
}

export function createPresentation(theme = 'concept'): PresentationDocument {
  const slides: Slide[] = [createSlide('title', '#0b1220'), createSlide('title-content')];
  slides[0].elements.forEach((element) => {
    if (element.type === 'title') element.color = '#f8fafc';
    else element.color = '#93c5fd';
  });
  return { version: 1, slides, theme, updatedAt: Date.now() };
}

export function createNoteDocument(title = 'New note', body = '', color = '#fde68a'): NoteDocument {
  return { version: 1, title, body, color, pinned: false, tags: [], updatedAt: Date.now() };
}

/** Default (empty) content for a file kind. */
export function contentForKind(kind: FileKind, name?: string): unknown {
  switch (kind) {
    case 'doc':
      return createWordDocument('', name ?? 'Document');
    case 'sheet':
      return createSpreadsheet();
    case 'slides':
      return createPresentation();
    case 'note':
      return createNoteDocument(name?.replace(/\.note$/i, '') ?? 'New note');
    case 'text':
      return '';
    case 'folder':
    case 'shortcut':
      return null;
    default:
      return '';
  }
}

export function isWordDocument(value: unknown): value is WordDocument {
  return Boolean(value) && typeof value === 'object' && (value as WordDocument).version === 1 && 'html' in (value as object);
}

export function isSpreadsheet(value: unknown): value is SpreadsheetDocument {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as SpreadsheetDocument).sheets);
}

export function isPresentation(value: unknown): value is PresentationDocument {
  return Boolean(value) && typeof value === 'object' && Array.isArray((value as PresentationDocument).slides);
}

export function isNote(value: unknown): value is NoteDocument {
  return Boolean(value) && typeof value === 'object' && 'body' in (value as object) && 'pinned' in (value as object);
}
