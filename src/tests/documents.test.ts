import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  contentForKind,
  createNoteDocument,
  createPresentation,
  createSheet,
  createSlide,
  createSpreadsheet,
  createWordDocument,
  isNote,
  isPresentation,
  isSpreadsheet,
  isWordDocument,
} from '../core/Documents';
import { DESKTOP_ID, DOCUMENTS_ID, getNode, NOTES_ID } from '../core/FileSystem';
import { evaluateSheet } from '../core/spreadsheet/engine';
import { formatCellValue } from '../core/spreadsheet/format';
import { countWords, htmlToText, sanitizeHtml } from '../services/sanitize';
import { exportDocx, wordDocumentToXml } from '../services/office/docx';
import { exportXlsx, importXlsx } from '../services/office/xlsx';
import { exportPptx } from '../services/office/pptx';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { db } from '../services/db';
import type { NoteDocument, PresentationDocument, SpreadsheetDocument, WordDocument } from '../types';

/** Capture every "download" so exports can be verified instead of hitting the disk. */
const downloads = vi.hoisted(() => [] as { blob: Blob; filename: string }[]);

vi.mock('../services/files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/files')>();
  return {
    ...actual,
    downloadBlob: (blob: Blob, filename: string) => {
      downloads.push({ blob, filename });
    },
  };
});

/** jsdom's Blob has no `arrayBuffer()`, so exports are read through a FileReader. */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsArrayBuffer(blob);
  });
}

function store() {
  return useFileSystemStore.getState();
}

async function reload(): Promise<void> {
  useFileSystemStore.setState({ nodes: {}, hydrated: false, usedBytes: 0, recentIds: [], clipboard: null });
  await store().hydrate();
}

beforeEach(async () => {
  localStorage.clear();
  downloads.length = 0;
  await db.files.clear();
  await db.kv.clear();
  useFileSystemStore.setState({ nodes: {}, hydrated: false, usedBytes: 0, recentIds: [], clipboard: null });
  await store().hydrate();
});

describe('document factories', () => {
  it('creates valid models for every office kind', () => {
    const word = createWordDocument('<p>Hi</p>', 'Report');
    expect(isWordDocument(word)).toBe(true);
    expect(word).toMatchObject({ version: 1, title: 'Report', pageSize: 'A4', html: '<p>Hi</p>' });

    const sheet = createSpreadsheet(['Q1', 'Q2']);
    expect(isSpreadsheet(sheet)).toBe(true);
    expect(sheet.sheets).toHaveLength(2);
    expect(sheet.activeSheetId).toBe(sheet.sheets[0].id);
    expect(sheet.sheets[0].rows).toBeGreaterThan(0);
    expect(sheet.sheets[0].cols).toBe(26);
    expect(sheet.sheets[0].colWidths.A).toBeGreaterThan(0);

    const deck = createPresentation();
    expect(isPresentation(deck)).toBe(true);
    expect(deck.slides).toHaveLength(2);
    expect(deck.slides[0].layout).toBe('title');

    const note = createNoteDocument('Shopping', 'Milk', '#fde68a');
    expect(isNote(note)).toBe(true);
    expect(note).toMatchObject({ title: 'Shopping', body: 'Milk', pinned: false, tags: [] });

    expect(isWordDocument(sheet)).toBe(false);
    expect(isSpreadsheet(deck)).toBe(false);
    expect(isNote('plain text')).toBe(false);
    expect(isPresentation(null)).toBe(false);
  });

  it('provides default content per file kind', () => {
    expect(isWordDocument(contentForKind('doc', 'Paper.docx'))).toBe(true);
    expect(isSpreadsheet(contentForKind('sheet'))).toBe(true);
    expect(isPresentation(contentForKind('slides'))).toBe(true);
    expect(isNote(contentForKind('note', 'Idea.note'))).toBe(true);
    expect(contentForKind('text')).toBe('');
    expect(contentForKind('folder')).toBeNull();
  });

  it('builds slides for every layout', () => {
    for (const layout of ['title', 'title-content', 'blank', 'two-column', 'section'] as const) {
      const slide = createSlide(layout);
      expect(slide.layout).toBe(layout);
      expect(slide.background).toBe('#ffffff');
      expect(Array.isArray(slide.elements)).toBe(true);
      if (layout !== 'blank') expect(slide.elements.length).toBeGreaterThan(0);
    }
  });
});

describe('Word documents', () => {
  it('saves rich text, survives a reload and exports real DOCX', async () => {
    const html = sanitizeHtml('<h1>Quarterly report</h1><p>Sales grew <b>12%</b>.</p><ul><li>Nordic</li><li>Baltic</li></ul>');
    const doc = createWordDocument(html, 'Quarterly report');
    doc.wordCount = countWords(html);

    const fileId = store().createFile('doc', DOCUMENTS_ID, 'Quarterly report.docx', doc);
    expect(store().nodeById(fileId)?.size).toBeGreaterThan(0);

    // Edit and save again.
    const updated: WordDocument = { ...doc, html: sanitizeHtml(`${html}<p>Updated paragraph.</p>`), updatedAt: Date.now() };
    updated.wordCount = countWords(updated.html);
    store().updateContent(fileId, updated);

    await reload();
    const reopened = store().nodeById(fileId)?.content as WordDocument;
    expect(isWordDocument(reopened)).toBe(true);
    expect(reopened.html).toContain('<h1>Quarterly report</h1>');
    expect(reopened.html).toContain('<b>12%</b>');
    expect(reopened.html).toContain('Updated paragraph.');
    expect(reopened.wordCount).toBeGreaterThan(5);
    expect(htmlToText(reopened.html)).toContain('Quarterly report');

    // Real DOCX generation.
    await exportDocx(reopened, 'Quarterly report.docx');
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe('Quarterly report.docx');
    expect(downloads[0].blob.size).toBeGreaterThan(1000);
    const xml = wordDocumentToXml(reopened);
    expect(xml).toContain('<w:document');
    expect(xml).toContain('Quarterly report');
  });

  it('strips scripts and event handlers from pasted HTML', () => {
    const dirty = '<p onclick="steal()">Hello</p><script>alert(1)</script><img src="x" onerror="steal()"><a href="https://example.com" target="_blank">link</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).toContain('Hello');
    expect(clean).toContain('href="https://example.com"');
  });
});

describe('Excel workbooks', () => {
  it('stores formulas, recomputes them after a reload and exports XLSX', async () => {
    const doc = createSpreadsheet(['Sales']);
    const sheet = doc.sheets[0];
    sheet.cells.A1 = { v: '1200' };
    sheet.cells.A2 = { v: '800' };
    sheet.cells.A3 = { v: '450.5' };
    sheet.cells.A4 = { v: '=SUM(A1:A3)' };
    sheet.cells.B1 = { v: '=AVERAGE(A1:A3)', s: { format: 'number', decimals: 2 } };
    sheet.cells.B2 = { v: '=IF(A4>2000,"target","below")' };
    sheet.cells.B3 = { v: '=A1/0' };
    sheet.cells.B4 = { v: '=MAX(A1:A3)' };
    sheet.cells.B5 = { v: '=COUNT(A1:A3)' };

    const evaluate = (target: SpreadsheetDocument) => {
      const active = target.sheets[0];
      return evaluateSheet((key) => active.cells[key]?.v, Object.keys(active.cells)).values;
    };

    const values = evaluate(doc);
    expect(values.A4).toBe(2450.5);
    expect(values.B1).toBeCloseTo(816.83, 2);
    expect(values.B2).toBe('target');
    expect((values.B3 as { code: string }).code).toBe('#DIV/0!');
    expect(values.B4).toBe(1200);
    expect(values.B5).toBe(3);
    expect(formatCellValue(values.A4, { format: 'currency', decimals: 2 }, { locale: 'en-US', currency: 'USD' })).toBe('$2,450.50');

    const fileId = store().createFile('sheet', DOCUMENTS_ID, 'Sales.xlsx', doc);
    await reload();

    const reopened = store().nodeById(fileId)?.content as SpreadsheetDocument;
    expect(isSpreadsheet(reopened)).toBe(true);
    expect(reopened.sheets[0].name).toBe('Sales');
    // The formula text is preserved (not baked into a value) and still computes.
    expect(reopened.sheets[0].cells.A4.v).toBe('=SUM(A1:A3)');
    expect(evaluate(reopened).A4).toBe(2450.5);

    await exportXlsx(reopened, { [reopened.sheets[0].id]: evaluate(reopened) }, 'Sales.xlsx');
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe('Sales.xlsx');

    const imported = await importXlsx(await blobToArrayBuffer(downloads[0].blob));
    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('Sales');
    expect(imported[0].cells.A1?.v).toBe('1200');
    expect(imported[0].cells.A4?.v).toBe('=SUM(A1:A3)');
  });

  it('supports multiple sheets, freezing and column widths', () => {
    const doc = createSpreadsheet(['Sheet1']);
    doc.sheets.push(createSheet('Summary'));
    doc.sheets[0].frozenRows = 1;
    doc.sheets[0].frozenCols = 1;
    doc.sheets[0].colWidths.A = 180;
    doc.activeSheetId = doc.sheets[1].id;

    const fileId = store().createFile('sheet', DESKTOP_ID, 'Multi.xlsx', doc);
    const saved = store().nodeById(fileId)?.content as SpreadsheetDocument;
    expect(saved.sheets.map((sheet) => sheet.name)).toEqual(['Sheet1', 'Summary']);
    expect(saved.sheets[0].frozenRows).toBe(1);
    expect(saved.sheets[0].colWidths.A).toBe(180);
    expect(saved.activeSheetId).toBe(doc.sheets[1].id);
  });
});

describe('PowerPoint decks', () => {
  it('keeps slides, elements and speaker notes across a reload and exports PPTX', async () => {
    const doc = createPresentation();
    doc.slides[0].elements[0].text = 'Windows 12 Concept';
    doc.slides.push(createSlide('title-content', '#0f172a'));
    const added = doc.slides[2];
    added.notes = 'Remember to demo the snap layouts.';
    added.elements.push({
      id: 'el-custom',
      type: 'shape',
      shape: 'rect',
      x: 100,
      y: 100,
      w: 200,
      h: 120,
      fill: '#22c55e',
      stroke: '#14532d',
      strokeWidth: 3,
    });

    const fileId = store().createFile('slides', DOCUMENTS_ID, 'Kickoff.pptx', doc);
    await reload();

    const reopened = store().nodeById(fileId)?.content as PresentationDocument;
    expect(isPresentation(reopened)).toBe(true);
    expect(reopened.slides).toHaveLength(3);
    expect(reopened.slides[0].elements[0].text).toBe('Windows 12 Concept');
    expect(reopened.slides[2].background).toBe('#0f172a');
    expect(reopened.slides[2].notes).toContain('snap layouts');
    const shape = reopened.slides[2].elements.find((element) => element.id === 'el-custom');
    expect(shape).toMatchObject({ type: 'shape', shape: 'rect', fill: '#22c55e', strokeWidth: 3 });

    await exportPptx(reopened, 'Kickoff.pptx');
    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe('Kickoff.pptx');
    expect(downloads[0].blob.size).toBeGreaterThan(1000);
  });
});

describe('Notepad and Notes', () => {
  it('persists plain text files', async () => {
    const fileId = store().createFile('text', DESKTOP_ID, 'todo.txt', 'Buy milk\nShip release');
    store().updateContent(fileId, 'Buy milk\nShip release\nWrite docs');

    await reload();
    expect(store().nodeById(fileId)?.content).toBe('Buy milk\nShip release\nWrite docs');
    expect(store().rename(fileId, 'todo-list.txt')).toBe(true);
    expect(store().nodeById(fileId)?.name).toBe('todo-list.txt');
  });

  it('persists note documents with tags, colour and pin state', async () => {
    const note = createNoteDocument('Ideas', 'Ship the simulator', '#bfdbfe');
    note.tags = ['work', 'concept'];
    note.pinned = true;

    const fileId = store().createFile('note', NOTES_ID, 'Ideas.note', note);
    await reload();

    const reopened = store().nodeById(fileId)?.content as NoteDocument;
    expect(isNote(reopened)).toBe(true);
    expect(reopened).toMatchObject({ title: 'Ideas', body: 'Ship the simulator', color: '#bfdbfe', pinned: true });
    expect(reopened.tags).toEqual(['work', 'concept']);
    expect(getNode(store().nodes, NOTES_ID)).toBeTruthy();

    // Editing a note updates both content and the file name.
    store().updateContent(fileId, { ...reopened, title: 'Roadmap', body: 'Polish the shell' });
    store().rename(fileId, 'Roadmap.note');
    await reload();
    const edited = store().nodeById(fileId)?.content as NoteDocument;
    expect(edited.title).toBe('Roadmap');
    expect(edited.body).toBe('Polish the shell');
    expect(store().nodeById(fileId)?.name).toBe('Roadmap.note');
  });

  it('keeps notes and files in one shared file system', async () => {
    const noteId = store().createFile('note', NOTES_ID, 'Shared.note', createNoteDocument('Shared', 'body'));
    const textId = store().createFile('text', DOCUMENTS_ID, 'shared.txt', 'body');

    await reload();
    expect(store().nodeById(noteId)?.kind).toBe('note');
    expect(store().nodeById(textId)?.kind).toBe('text');
    // Both are reachable through the same search index.
    const hits = store().childrenOf(NOTES_ID).map((node) => node.id);
    expect(hits).toContain(noteId);
  });
});
