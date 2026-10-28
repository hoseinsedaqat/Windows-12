import JSZip from 'jszip';
import type { CellStyle, SpreadsheetDocument, SpreadsheetSheet } from '../../types';
import { downloadBlob } from '../files';
import { colToLetter, keyToRef } from '../../core/spreadsheet/cellref';
import { parseLiteral, isError } from '../../core/spreadsheet/engine';

/**
 * Real `.xlsx` export and a best-effort import.
 *
 * Export writes values, formulas (with cached results) and basic formatting
 * (bold/italic/underline, font colour, fill colour, alignment, number format,
 * column widths, frozen panes). Import reads cell text/values, formulas and
 * those same basic styles from every worksheet — charts, pivots and conditional
 * formatting are ignored, and that limitation is stated in the UI.
 */

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const NUM_FMT_ID: Record<string, number> = {
  general: 0,
  number: 2,
  currency: 44,
  percent: 10,
  date: 14,
  text: 49,
};

interface StyleTable {
  fonts: CellStyle[];
  fills: string[];
  xfs: { fontId: number; fillId: number; numFmtId: number; align?: string }[];
  cache: Map<string, number>;
}

function createStyleTable(): StyleTable {
  return {
    fonts: [{}],
    fills: ['', 'gray125'],
    xfs: [{ fontId: 0, fillId: 0, numFmtId: 0 }],
    cache: new Map(),
  };
}

function styleId(table: StyleTable, style: CellStyle | undefined): number {
  const key = JSON.stringify(style ?? {});
  const cached = table.cache.get(key);
  if (cached !== undefined) return cached;

  let fontId = 0;
  if (style && (style.bold || style.italic || style.underline || style.color)) {
    fontId = table.fonts.findIndex(
      (font) =>
        Boolean(font.bold) === Boolean(style.bold) &&
        Boolean(font.italic) === Boolean(style.italic) &&
        Boolean(font.underline) === Boolean(style.underline) &&
        (font.color ?? null) === (style.color ?? null),
    );
    if (fontId < 0) {
      table.fonts.push({ bold: style.bold, italic: style.italic, underline: style.underline, color: style.color });
      fontId = table.fonts.length - 1;
    }
  }

  let fillId = 0;
  if (style?.background) {
    fillId = table.fills.indexOf(style.background);
    if (fillId < 0) {
      table.fills.push(style.background);
      fillId = table.fills.length - 1;
    }
  }

  const numFmtId = NUM_FMT_ID[style?.format ?? 'general'] ?? 0;
  const align = style?.align;

  let xfIndex = table.xfs.findIndex(
    (xf) => xf.fontId === fontId && xf.fillId === fillId && xf.numFmtId === numFmtId && xf.align === align,
  );
  if (xfIndex < 0) {
    table.xfs.push({ fontId, fillId, numFmtId, align });
    xfIndex = table.xfs.length - 1;
  }
  table.cache.set(key, xfIndex);
  return xfIndex;
}

function stylesXml(table: StyleTable): string {
  const fonts = table.fonts
    .map((font) => {
      const parts: string[] = [];
      if (font.bold) parts.push('<b/>');
      if (font.italic) parts.push('<i/>');
      if (font.underline) parts.push('<u/>');
      if (font.color) parts.push(`<color rgb="FF${font.color.replace('#', '')}"/>`);
      parts.push('<sz val="11"/>', '<name val="Calibri"/>');
      return `<font>${parts.join('')}</font>`;
    })
    .join('');

  const fills = table.fills
    .map((fill) => {
      if (!fill) return '<fill><patternFill patternType="none"/></fill>';
      if (fill === 'gray125') return '<fill><patternFill patternType="gray125"/></fill>';
      return `<fill><patternFill patternType="solid"><fgColor rgb="FF${fill.replace('#', '')}"/><bgColor indexed="64"/></patternFill></fill>`;
    })
    .join('');

  const xfs = table.xfs
    .map((xf) => {
      const alignment = xf.align ? `<alignment horizontal="${xf.align}" vertical="center"/>` : '<alignment vertical="center"/>';
      const applyAlignment = 'applyAlignment="1"';
      return `<xf numFmtId="${xf.numFmtId}" fontId="${xf.fontId}" fillId="${xf.fillId}" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" ${applyAlignment}>${alignment}</xf>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}">
<numFmts count="0"/>
<fonts count="${table.fonts.length}">${fonts}</fonts>
<fills count="${table.fills.length}">${fills}</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${table.xfs.length}">${xfs}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function sheetXml(sheet: SpreadsheetSheet, table: StyleTable, computed: Record<string, unknown>): string {
  const rows = new Map<number, string[]>();
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const ref = keyToRef(key);
    if (!ref) continue;
    const raw = cell.v ?? '';
    if (raw === '' && !cell.s) continue;
    const style = styleId(table, cell.s);
    let cellXml = '';
    if (raw.startsWith('=')) {
      const formula = raw.slice(1);
      const cached = computed[key];
      const numeric = typeof cached === 'number' && Number.isFinite(cached);
      const boolValue = typeof cached === 'boolean';
      const textValue = typeof cached === 'string';
      const errorValue = isError(cached);
      if (numeric) cellXml = `<c r="${key}" s="${style}"><f>${escapeXml(formula)}</f><v>${cached}</v></c>`;
      else if (boolValue) cellXml = `<c r="${key}" s="${style}" t="b"><f>${escapeXml(formula)}</f><v>${cached ? 1 : 0}</v></c>`;
      else if (errorValue) cellXml = `<c r="${key}" s="${style}" t="e"><f>${escapeXml(formula)}</f><v>${(cached as { code: string }).code}</v></c>`;
      else cellXml = `<c r="${key}" s="${style}" t="str"><f>${escapeXml(formula)}</f><v>${escapeXml(textValue ? String(cached) : '')}</v></c>`;
    } else {
      const parsed = parseLiteral(raw);
      if (typeof parsed === 'number' && Number.isFinite(parsed)) {
        cellXml = `<c r="${key}" s="${style}"><v>${parsed}</v></c>`;
      } else if (typeof parsed === 'boolean') {
        cellXml = `<c r="${key}" s="${style}" t="b"><v>${parsed ? 1 : 0}</v></c>`;
      } else if (raw !== '') {
        cellXml = `<c r="${key}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(raw)}</t></is></c>`;
      } else {
        cellXml = `<c r="${key}" s="${style}"/>`;
      }
    }
    const list = rows.get(ref.row) ?? [];
    list.push(cellXml);
    rows.set(ref.row, list);
  }

  const rowXml = [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, cells]) => {
      const height = sheet.rowHeights[String(row)];
      const customHeight = height ? ` ht="${Math.round(height * 0.75)}" customHeight="1"` : '';
      return `<row r="${row}"${customHeight}>${cells.join('')}</row>`;
    })
    .join('');

  const cols = Object.entries(sheet.colWidths)
    .map(([letter, width]) => ({ col: keyToRef(`${letter}1`)?.col ?? 0, width }))
    .filter((entry) => entry.col > 0)
    .sort((a, b) => a.col - b.col);

  const colsXml = cols.length
    ? `<cols>${cols.map((entry) => `<col min="${entry.col}" max="${entry.col}" width="${(entry.width / 7).toFixed(2)}" customWidth="1"/>`).join('')}</cols>`
    : '';

  const paneXml =
    sheet.frozenRows > 0 || sheet.frozenCols > 0
      ? `<pane xSplit="${sheet.frozenCols}" ySplit="${sheet.frozenRows}" topLeftCell="${colToLetter(sheet.frozenCols + 1)}${sheet.frozenRows + 1}" activePane="bottomRight" state="frozen"/>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}" xmlns:r="${RNS}">
<dimension ref="A1:${colToLetter(sheet.cols)}${sheet.rows}"/>
<sheetViews><sheetView workbookViewId="0">${paneXml}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
${colsXml}
<sheetData>${rowXml}</sheetData>
</worksheet>`;
}

export async function exportXlsx(doc: SpreadsheetDocument, computedBySheet: Record<string, Record<string, unknown>>, filename: string): Promise<void> {
  const zip = new JSZip();
  const table = createStyleTable();
  const sheetFiles = doc.sheets.map((sheet, index) => ({ sheet, file: `worksheets/sheet${index + 1}.xml` }));

  // Build sheet XML first so the style table is fully populated.
  const sheetXmls = sheetFiles.map(({ sheet }) => sheetXml(sheet, table, computedBySheet[sheet.id] ?? {}));

  const overrides = sheetFiles
    .map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${overrides}
</Types>`,
  );
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );

  const xl = zip.folder('xl');
  xl?.file(
    'workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}" xmlns:r="${RNS}">
<sheets>${doc.sheets
      .map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join('')}</sheets>
</workbook>`,
  );
  xl?.folder('_rels')?.file(
    'workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${doc.sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}
<Relationship Id="rId${doc.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );
  xl?.file('styles.xml', stylesXml(table));
  sheetFiles.forEach((entry, index) => {
    xl?.file(entry.file, sheetXmls[index]);
  });

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

export interface ImportedSheet {
  name: string;
  cells: Record<string, { v: string; s?: CellStyle }>;
}

export async function importXlsx(buffer: ArrayBuffer): Promise<ImportedSheet[]> {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookXml) throw new Error('Not a valid .xlsx package (workbook.xml missing)');

  const relsXml = (await zip.file('xl/_rels/workbook.xml.rels')?.async('string')) ?? '';
  const relMap = new Map<string, string>();
  for (const match of relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relMap.set(match[1], match[2]);
  }

  const sharedStrings: string[] = [];
  const sharedXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  if (sharedXml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sharedXml, 'application/xml');
    doc.querySelectorAll('si').forEach((si) => sharedStrings.push(si.textContent ?? ''));
  }

  const stylesXml = await zip.file('xl/styles.xml')?.async('string');
  const styleIndex = stylesXml ? parseStyles(stylesXml) : null;

  const sheets: ImportedSheet[] = [];
  const parser = new DOMParser();
  const workbookDoc = parser.parseFromString(workbookXml, 'application/xml');
  const sheetElements = [...workbookDoc.querySelectorAll('sheet')];

  for (const element of sheetElements) {
    const name = element.getAttribute('name') ?? `Sheet${sheets.length + 1}`;
    const relId = element.getAttribute('r:id') ?? element.getAttributeNS(RNS, 'id') ?? '';
    let target = relMap.get(relId);
    if (!target) target = `worksheets/sheet${sheets.length + 1}.xml`;
    const path = target.startsWith('/xl/') ? target.slice(1) : `xl/${target.replace(/^\/?xl\//, '')}`;
    const xml = await zip.file(path)?.async('string');
    if (!xml) continue;
    const doc = parser.parseFromString(xml, 'application/xml');
    const cells: Record<string, { v: string; s?: CellStyle }> = {};

    doc.querySelectorAll('c').forEach((cell) => {
      const ref = cell.getAttribute('r');
      if (!ref) return;
      const type = cell.getAttribute('t');
      const styleAttr = Number(cell.getAttribute('s') ?? 0);
      const formula = cell.querySelector('f')?.textContent ?? '';
      const valueNode = cell.querySelector('v');
      const inlineNode = cell.querySelector('is');
      let value = '';
      if (formula) value = `=${formula}`;
      else if (type === 'inlineStr') value = inlineNode?.textContent ?? '';
      else if (type === 's') value = sharedStrings[Number(valueNode?.textContent ?? -1)] ?? '';
      else if (type === 'str') value = valueNode?.textContent ?? '';
      else value = valueNode?.textContent ?? '';
      if (value === '' && styleAttr === 0) return;
      const style = styleIndex ? styleIndex(styleAttr) : undefined;
      cells[ref.toUpperCase()] = { v: value, ...(style ? { s: style } : {}) };
    });

    sheets.push({ name, cells });
  }

  if (!sheets.length) throw new Error('No worksheets found in that file');
  return sheets;
}

function parseStyles(xml: string): (index: number) => CellStyle | undefined {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const fonts = [...doc.querySelectorAll('fonts > font')].map((font) => ({
    bold: font.querySelector('b') !== null,
    italic: font.querySelector('i') !== null,
    underline: font.querySelector('u') !== null,
    color: rgbFrom(font.querySelector('color')?.getAttribute('rgb')),
  }));
  const fills = [...doc.querySelectorAll('fills > fill')].map((fill) => rgbFrom(fill.querySelector('fgColor')?.getAttribute('rgb')));
  const numFmts = new Map<number, string>();
  doc.querySelectorAll('numFmts > numFmt').forEach((node) => {
    numFmts.set(Number(node.getAttribute('numFmtId')), node.getAttribute('formatCode') ?? '');
  });
  const xfs = [...doc.querySelectorAll('cellXfs > xf')].map((xf) => ({
    numFmtId: Number(xf.getAttribute('numFmtId') ?? 0),
    fontId: Number(xf.getAttribute('fontId') ?? 0),
    fillId: Number(xf.getAttribute('fillId') ?? 0),
    align: xf.querySelector('alignment')?.getAttribute('horizontal') as CellStyle['align'],
  }));

  return (index: number) => {
    const xf = xfs[index];
    if (!xf) return undefined;
    const font = fonts[xf.fontId];
    const fill = fills[xf.fillId];
    const style: CellStyle = {};
    if (font?.bold) style.bold = true;
    if (font?.italic) style.italic = true;
    if (font?.underline) style.underline = true;
    if (font?.color) style.color = font.color;
    if (fill) style.background = fill;
    if (xf.align) style.align = xf.align;
    const format = formatFromNumFmt(xf.numFmtId, numFmts.get(xf.numFmtId));
    if (format) style.format = format;
    return Object.keys(style).length ? style : undefined;
  };
}

function formatFromNumFmt(id: number, code?: string): CellStyle['format'] | undefined {
  if (id === 0) return undefined;
  if (id === 9 || id === 10) return 'percent';
  if (id === 14 || id === 15 || id === 16 || id === 22) return 'date';
  if (id === 44 || id === 43 || id === 42 || id === 41) return 'currency';
  if (id === 49) return 'text';
  if (id === 1 || id === 2 || id === 3 || id === 4) return 'number';
  if (code?.includes('%')) return 'percent';
  if (code?.includes('$') || code?.includes('€')) return 'currency';
  if (code?.includes('yy') || code?.includes('mm')) return 'date';
  return undefined;
}

function rgbFrom(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const hex = value.replace(/^FF/i, '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toLowerCase()}` : undefined;
}
