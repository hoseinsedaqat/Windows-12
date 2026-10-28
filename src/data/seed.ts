import type { FileKind, FSNode, PresentationDocument, SpreadsheetDocument, WordDocument } from '../types';
import {
  createNode,
  estimateSize,
  DESKTOP_ID,
  DOCUMENTS_ID,
  DOWNLOADS_ID,
  KNOWN_FOLDERS,
  MUSIC_ID,
  NOTES_ID,
  ONEDRIVE_ID,
  PICTURES_ID,
  RECYCLE_BIN_ID,
  ROOT_ID,
  VIDEOS_ID,
  type NodeMap,
} from '../core/FileSystem';
import { createNoteDocument, createPresentation, createSpreadsheet, createWordDocument } from '../core/Documents';
import { colToLetter } from '../core/spreadsheet/cellref';
import { SAMPLE_IMAGES } from './sampleImages';

/**
 * First-run content for the virtual file system. Everything here is generated
 * locally; nothing is downloaded and nothing touches the user's real files.
 */

const DEMO_STAMP = Date.now() - 1000 * 60 * 60 * 24 * 3;

function shortcut(name: string, appId: string, x: number, y: number, props?: Record<string, unknown>): FSNode {
  return createNode({
    name,
    kind: 'shortcut',
    parentId: DESKTOP_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    size: 1024,
    content: null,
    metadata: { appId, iconX: x, iconY: y, ...(props ? { props } : {}) },
    system: true,
  });
}

function folderShortcut(name: string, targetId: string, x: number, y: number): FSNode {
  return createNode({
    name,
    kind: 'shortcut',
    parentId: DESKTOP_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    size: 1024,
    content: null,
    metadata: { targetId, iconX: x, iconY: y },
    system: true,
  });
}

function welcomeDocument(): WordDocument {
  return createWordDocument(
    `<h1 style="text-align:center">Welcome to Windows 12 Concept</h1>` +
      `<p style="text-align:center"><em>A fan-made web desktop simulator — not a real operating system and not affiliated with Microsoft.</em></p>` +
      `<h2>What you can do here</h2>` +
      `<ul>` +
      `<li>Open apps from the <strong>Start menu</strong>, the desktop or the taskbar.</li>` +
      `<li>Drag, resize, snap and minimise windows just like on a real desktop.</li>` +
      `<li>Create files in <strong>File Explorer</strong> and edit them in Word, Excel, PowerPoint or Notepad.</li>` +
      `<li>Everything you save is stored in this browser and comes back after a refresh.</li>` +
      `</ul>` +
      `<h2>Try the keyboard</h2>` +
      `<table border="1" style="border-collapse:collapse;width:100%">` +
      `<thead><tr><th>Shortcut</th><th>Action</th></tr></thead>` +
      `<tbody>` +
      `<tr><td>Win + E</td><td>File Explorer</td></tr>` +
      `<tr><td>Win + I</td><td>Settings</td></tr>` +
      `<tr><td>Win + L</td><td>Lock the simulator</td></tr>` +
      `<tr><td>Alt + Tab</td><td>Switch between apps</td></tr>` +
      `<tr><td>Win + D</td><td>Show desktop</td></tr>` +
      `</tbody></table>` +
      `<h3>Writing in Persian?</h3>` +
      `<p dir="rtl" style="text-align:right">زبان رابط را از مسیر <strong>Settings → Time &amp; language</strong> به فارسی تغییر دهید تا کل سیستم راست‌به‌چپ شود.</p>` +
      `<p>Happy exploring — and remember: this desktop lives entirely inside your browser tab.</p>`,
    'Welcome to Windows 12 Concept',
  );
}

function budgetWorkbook(): SpreadsheetDocument {
  const doc = createSpreadsheet(['Budget']);
  const sheet = doc.sheets[0];
  const put = (col: number, row: number, value: string, style?: SpreadsheetDocument['sheets'][number]['cells'][string]['s']) => {
    sheet.cells[`${colToLetter(col)}${row}`] = { v: value, ...(style ? { s: style } : {}) };
  };
  const bold = { bold: true };
  const header = { bold: true, background: '#dcfce7' };

  put(1, 1, 'Quarterly budget — demo workbook', { bold: true, color: '#217346' });
  put(1, 3, 'Category', header);
  ['Jan', 'Feb', 'Mar'].forEach((month, index) => put(index + 2, 3, month, header));
  put(5, 3, 'Total', header);

  const rows: [string, number, number, number][] = [
    ['Product sales', 18400, 21250, 24980],
    ['Consulting', 7600, 5400, 9150],
    ['Support plans', 3200, 3450, 3600],
    ['Licenses', 5100, 5100, 5400],
    ['Training', 1200, 2600, 1800],
  ];
  rows.forEach(([label, jan, feb, mar], index) => {
    const row = 4 + index;
    put(1, row, label);
    put(2, row, String(jan), { format: 'number' });
    put(3, row, String(feb), { format: 'number' });
    put(4, row, String(mar), { format: 'number' });
    put(5, row, `=SUM(B${row}:D${row})`, { format: 'number', bold: true });
  });

  put(1, 10, 'Total income', bold);
  ['B', 'C', 'D', 'E'].forEach((letter) => {
    sheet.cells[`${letter}10`] = { v: `=SUM(${letter}4:${letter}8)`, s: { format: 'currency', bold: true, background: '#f0fdf4' } };
  });

  put(1, 12, 'Monthly average');
  put(2, 12, '=AVERAGE(B4:B8)', { format: 'currency' });
  put(1, 13, 'Best month');
  put(2, 13, '=MAX(B10:D10)', { format: 'currency' });
  put(1, 14, 'Target check');
  put(2, 14, '=IF(E10>100000,"Target reached","Below target")', bold);
  put(1, 16, 'Expenses', header);
  put(2, 16, 'Amount', header);
  put(1, 17, 'Hosting');
  put(2, 17, '1450', { format: 'currency' });
  put(1, 18, 'Salaries');
  put(2, 18, '42000', { format: 'currency' });
  put(1, 19, 'Marketing');
  put(2, 19, '8600', { format: 'currency' });
  put(1, 20, 'Total expenses', bold);
  put(2, 20, '=SUM(B17:B19)', { format: 'currency', bold: true });
  put(1, 22, 'Net result', bold);
  put(2, 22, '=E10-B20', { format: 'currency', bold: true, background: '#fef9c3' });

  sheet.colWidths.A = 168;
  return doc;
}

function launchDeck(): PresentationDocument {
  const deck = createPresentation();
  deck.slides[0].elements[0].text = 'Windows 12 Concept';
  deck.slides[0].elements[1].text = 'A desktop that lives in your browser';
  deck.slides[1].elements[0].text = 'What is inside?';
  deck.slides[1].elements[1].text =
    '• Window manager with snapping and Alt+Tab\n• Virtual file system persisted in IndexedDB\n• Word, Excel, PowerPoint and Notepad\n• A working Accounting ledger\n• Settings that actually change the system';
  deck.slides.push({
    id: 'slide-3',
    layout: 'title-content',
    background: '#0f172a',
    elements: [
      { id: 'el-3a', type: 'title', x: 60, y: 44, w: 840, h: 60, text: 'Try it yourself', fontSize: 32, bold: true, color: '#f8fafc' },
      {
        id: 'el-3b',
        type: 'text',
        x: 60,
        y: 140,
        w: 840,
        h: 300,
        text: 'Press Win + E to open File Explorer, right-click for the New menu, and create your own deck.',
        fontSize: 22,
        color: '#cbd5f5',
      },
      { id: 'el-3c', type: 'shape', shape: 'ellipse', x: 700, y: 330, w: 180, h: 180, fill: '#22d3ee', stroke: '#0e7490' },
    ],
  });
  return deck;
}

export function buildSeedNodes(): NodeMap {
  const nodes: NodeMap = {};
  const root: FSNode = createNode({
    id: ROOT_ID,
    name: 'This PC',
    kind: 'folder',
    parentId: null,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    size: 0,
    content: null,
    metadata: {},
    system: true,
  });
  nodes[root.id] = root;

  for (const folder of KNOWN_FOLDERS) {
    const node = createNode({
      id: folder.id,
      name: folder.name,
      kind: 'folder',
      parentId: folder.parentId,
      createdAt: DEMO_STAMP,
      updatedAt: DEMO_STAMP,
      size: 0,
      content: null,
      metadata: {},
      system: true,
    });
    nodes[node.id] = node;
  }

  /* Desktop shortcuts -------------------------------------------------- */
  const desktopShortcuts: FSNode[] = [
    folderShortcut('This PC', ROOT_ID, 16, 16),
    folderShortcut('Recycle Bin', RECYCLE_BIN_ID, 16, 128),
    shortcut('Google Chrome', 'chrome', 16, 240, { url: 'win://newtab' }),
    shortcut('Accounting', 'accounting', 16, 352),
    folderShortcut('Documents', DOCUMENTS_ID, 16, 464),
    folderShortcut('Downloads', DOWNLOADS_ID, 16, 576),
    shortcut('Word', 'word', 128, 16),
    shortcut('Excel', 'excel', 128, 128),
    shortcut('PowerPoint', 'powerpoint', 128, 240),
    shortcut('Notepad', 'notepad', 128, 352),
    shortcut('Settings', 'settings', 128, 464),
    shortcut('Calculator', 'calculator', 128, 576),
  ];
  desktopShortcuts.forEach((node) => {
    nodes[node.id] = node;
  });

  /* Documents ---------------------------------------------------------- */
  const welcome = createNode({
    name: 'Welcome to Windows 12 Concept.docx',
    kind: 'doc' as FileKind,
    parentId: DOCUMENTS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: welcomeDocument(),
    metadata: { appId: 'word' },
  });
  welcome.size = estimateSize(welcome.content);
  nodes[welcome.id] = welcome;

  const budget = createNode({
    name: 'Quarterly budget.xlsx',
    kind: 'sheet' as FileKind,
    parentId: DOCUMENTS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: budgetWorkbook(),
    metadata: { appId: 'excel' },
  });
  budget.size = estimateSize(budget.content);
  nodes[budget.id] = budget;

  const deck = createNode({
    name: 'Product launch.pptx',
    kind: 'slides' as FileKind,
    parentId: DOCUMENTS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: launchDeck(),
    metadata: { appId: 'powerpoint' },
  });
  deck.size = estimateSize(deck.content);
  nodes[deck.id] = deck;

  const meetingNotes = createNode({
    name: 'Meeting notes.txt',
    kind: 'text' as FileKind,
    parentId: DOCUMENTS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: 'Kick-off checklist\n- Define the concept scope\n- Pick the accent colour\n- Ship the window manager\n- Write the demo script\n',
    metadata: { appId: 'notepad' },
  });
  meetingNotes.size = estimateSize(meetingNotes.content);
  nodes[meetingNotes.id] = meetingNotes;

  const ideaNote = createNode({
    name: 'Ideas.note',
    kind: 'note' as FileKind,
    parentId: DOCUMENTS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: {
      version: 1,
      title: 'Ideas for the concept',
      body: 'Snap layouts\nPersian RTL polish\nBattery saver dimming\nTerminal easter egg',
      color: '#fde68a',
      pinned: true,
      tags: ['concept'],
      updatedAt: DEMO_STAMP,
    },
    metadata: { appId: 'notes', color: '#fde68a', pinned: true },
  });
  ideaNote.size = estimateSize(ideaNote.content);
  nodes[ideaNote.id] = ideaNote;

  /* Pictures ----------------------------------------------------------- */
  SAMPLE_IMAGES.forEach((image) => {
    const node = createNode({
      id: `pic-${image.id}`,
      name: `${image.title}.svg`,
      kind: 'image',
      parentId: PICTURES_ID,
      createdAt: image.createdAt,
      updatedAt: image.createdAt,
      size: Math.round(image.src.length / 2),
      content: null,
      metadata: { dataUrl: image.src, mime: 'image/svg+xml', appId: 'photos' },
    });
    nodes[node.id] = node;
  });

  /* Downloads ---------------------------------------------------------- */
  const releaseNotes = createNode({
    name: 'concept-release-notes.txt',
    kind: 'text',
    parentId: DOWNLOADS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: 'Windows 12 Concept — build 1.0.0 (browser)\n\nNew\n- Window manager with snapping, Alt+Tab and per-app rules\n- Virtual file system with Recycle Bin\n- Word / Excel / PowerPoint / Notepad with real persistence\n- Accounting ledger with invoices, payments and reports\n\nNotes\n- Everything runs locally in your browser.\n- No data leaves this device.\n',
    metadata: { appId: 'notepad' },
  });
  releaseNotes.size = estimateSize(releaseNotes.content);
  nodes[releaseNotes.id] = releaseNotes;

  /* OneDrive (demo) ---------------------------------------------------- */
  const oneDriveReadme = createNode({
    name: 'About OneDrive (demo).txt',
    kind: 'text',
    parentId: ONEDRIVE_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: 'This OneDrive folder is a visual demo only.\nNo cloud service is contacted and nothing is uploaded anywhere.',
    metadata: { appId: 'notepad' },
  });
  oneDriveReadme.size = estimateSize(oneDriveReadme.content);
  nodes[oneDriveReadme.id] = oneDriveReadme;

  /* Music / Videos: keep them honest — empty folders with a note. */
  const musicNote = createNode({
    name: 'About this folder.txt',
    kind: 'text',
    parentId: MUSIC_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: 'Drop audio files here with File Explorer → Upload.\nThe simulator stores them in this browser only.',
    metadata: { appId: 'notepad' },
  });
  musicNote.size = estimateSize(musicNote.content);
  nodes[musicNote.id] = musicNote;

  const videoNote = createNode({
    name: 'About this folder.txt',
    kind: 'text',
    parentId: VIDEOS_ID,
    createdAt: DEMO_STAMP,
    updatedAt: DEMO_STAMP,
    content: 'Drop video files here with File Explorer → Upload.\nThe simulator stores them in this browser only.',
    metadata: { appId: 'notepad' },
  });
  videoNote.size = estimateSize(videoNote.content);
  nodes[videoNote.id] = videoNote;

  /* Notes folder: three starter notes (all local). */
  const starterNotes: [string, string, string, string[]][] = [
    ['Welcome to Notes', 'Notes live in the shared virtual file system, so they appear in File Explorer and Search too.\n\n• Pin important notes with the pin button\n• Tag them to filter the list\n• Everything autosaves in this browser only', '#fde68a', ['start-here']],
    ['Shopping list', 'Coffee beans\nOat milk\nSparkling water\nNotebook refill', '#bbf7d0', ['personal']],
    ['Concept build ideas', 'Snap layouts for thirds\nClipboard history panel\nFocus sessions in Clock\nPer-app theme accents', '#bfdbfe', ['work', 'ideas']],
  ];
  starterNotes.forEach(([title, body, color, tags], index) => {
    const note = createNode({
      name: `${title}.note`,
      kind: 'note',
      parentId: NOTES_ID,
      createdAt: DEMO_STAMP + index * 1000,
      updatedAt: DEMO_STAMP + index * 1000,
      content: { ...createNoteDocument(title, body, color), tags, pinned: index === 0 },
      metadata: { appId: 'notes' },
    });
    note.size = estimateSize(note.content);
    nodes[note.id] = note;
  });

  return nodes;
}
