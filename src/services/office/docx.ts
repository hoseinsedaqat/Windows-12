import JSZip from 'jszip';
import { downloadBlob } from '../files';
import { sanitizeHtml } from '../sanitize';
import type { WordDocument } from '../../types';

/**
 * Real `.docx` export.
 *
 * Builds a valid OOXML package (WordprocessingML) from the document model:
 * paragraphs, headings, lists, tables, bold/italic/underline/strike, colours,
 * alignment, page size and margins all survive the round trip through Word.
 * Complex layout (columns, headers/footers, styles inheritance) is simplified.
 */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function coreXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${escapeXml(title)}</dc:title>
<dc:creator>Windows 12 Concept</dc:creator>
<cp:lastModifiedBy>Windows 12 Concept</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created>
</cp:coreProperties>`;
}

interface RunStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color?: string;
  highlight?: string;
  size?: number;
  font?: string;
}

function runXml(text: string, style: RunStyle, rtl: boolean): string {
  if (!text) return '';
  const props: string[] = [];
  if (style.bold) props.push('<w:b/>');
  if (style.italic) props.push('<w:i/>');
  if (style.underline) props.push('<w:u w:val="single"/>');
  if (style.strike) props.push('<w:strike/>');
  if (style.color) props.push(`<w:color w:val="${style.color.replace('#', '')}"/>`);
  if (style.highlight) props.push(`<w:highlight w:val="${highlightName(style.highlight)}"/>`);
  if (style.size) props.push(`<w:sz w:val="${style.size * 2}"/>`);
  if (style.font) props.push(`<w:rFonts w:ascii="${escapeXml(style.font)}" w:hAnsi="${escapeXml(style.font)}" w:cs="${escapeXml(style.font)}"/>`);
  if (rtl) props.push('<w:rtl/>');
  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function highlightName(color: string): string {
  const map: Record<string, string> = {
    '#ffff00': 'yellow',
    '#00ff00': 'green',
    '#00ffff': 'cyan',
    '#ff00ff': 'magenta',
    '#0000ff': 'blue',
    '#ff0000': 'red',
    '#000080': 'darkBlue',
    '#008080': 'darkCyan',
    '#008000': 'darkGreen',
    '#800080': 'darkMagenta',
    '#800000': 'darkRed',
    '#808000': 'darkYellow',
    '#808080': 'darkGray',
    '#c0c0c0': 'lightGray',
    '#000000': 'black',
  };
  return map[color.toLowerCase()] ?? 'yellow';
}

function styleFromElement(element: Element): RunStyle {
  const computedWeight = element.closest('b,strong') ? true : false;
  return {
    bold: computedWeight || element.closest('h1,h2,h3,th') !== null,
    italic: Boolean(element.closest('i,em')),
    underline: Boolean(element.closest('u')),
    strike: Boolean(element.closest('s,strike,del')),
    color: inlineColor(element),
    highlight: inlineBackground(element),
  };
}

function inlineColor(element: Element): string | undefined {
  const style = (element as HTMLElement).style;
  return style?.color ? rgbToHex(style.color) : undefined;
}

function inlineBackground(element: Element): string | undefined {
  const style = (element as HTMLElement).style;
  const value = style?.backgroundColor;
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return undefined;
  return rgbToHex(value);
}

function rgbToHex(value: string): string | undefined {
  if (value.startsWith('#')) return value.length === 7 ? value : undefined;
  const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (!match) return undefined;
  return `#${[1, 2, 3].map((index) => Number(match[index]).toString(16).padStart(2, '0')).join('')}`;
}

function paragraphRuns(container: Element, rtl: boolean): string {
  let xml = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text) return;
      const parent = node.parentElement;
      const style: RunStyle = parent
        ? styleFromElement(parent)
        : { bold: false, italic: false, underline: false, strike: false };
      xml += runXml(text, style, rtl);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element.tagName === 'BR') {
      xml += '<w:r><w:br/></w:r>';
      return;
    }
    element.childNodes.forEach(walk);
  };
  container.childNodes.forEach(walk);
  return xml;
}

function paragraphXml(element: Element, rtl: boolean): string {
  const tag = element.tagName.toLowerCase();
  const props: string[] = [];
  const align = ((element as HTMLElement).style?.textAlign ?? '').toLowerCase();
  const jc = align === 'center' ? 'center' : align === 'right' ? (rtl ? 'left' : 'right') : align === 'justify' ? 'both' : align === 'left' ? (rtl ? 'right' : 'left') : null;
  if (jc) props.push(`<w:jc w:val="${jc}"/>`);
  if (rtl) props.push('<w:bidi/>');

  let outline = 0;
  if (tag === 'h1') outline = 1;
  else if (tag === 'h2') outline = 2;
  else if (tag === 'h3') outline = 3;
  if (outline) props.push(`<w:outlineLvl w:val="${outline - 1}"/>`);

  let prefix = '';
  if (tag === 'li') {
    const ordered = element.parentElement?.tagName === 'OL';
    const index = element.parentElement ? [...element.parentElement.children].indexOf(element) + 1 : 1;
    prefix = ordered ? `${index}. ` : '• ';
    props.push('<w:ind w:left="420" w:hanging="220"/>');
  }
  if (tag === 'blockquote') props.push('<w:ind w:left="420"/>');

  const runs = prefix
    ? runXml(prefix, { bold: false, italic: false, underline: false, strike: false }, rtl) + paragraphRuns(element, rtl)
    : paragraphRuns(element, rtl);

  const spacing = `<w:spacing w:after="120" w:line="276" w:lineRule="auto"/>`;
  return `<w:p><w:pPr>${spacing}${props.join('')}</w:pPr>${runs || '<w:r><w:t/></w:r>'}</w:p>`;
}

function tableXml(table: HTMLTableElement, rtl: boolean): string {
  const borders =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`)
      .join('') +
    '</w:tblBorders>';
  const rows = [...table.rows].map((row) => {
    const cells = [...row.cells]
      .map((cell) => {
        const paragraphs = cell.childNodes.length
          ? [...cell.childNodes]
              .map((child) =>
                child.nodeType === Node.ELEMENT_NODE && ['P', 'DIV', 'UL', 'OL', 'H1', 'H2', 'H3'].includes((child as Element).tagName)
                  ? paragraphXml(child as Element, rtl)
                  : paragraphXml(cell as unknown as Element, rtl),
              )
              .join('')
          : paragraphXml(cell as unknown as Element, rtl);
        return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraphs}</w:tc>`;
      })
      .join('');
    return `<w:tr>${cells}</w:tr>`;
  });
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}</w:tblPr>${rows.join('')}</w:tbl>`;
}

export function wordDocumentToXml(doc: WordDocument): string {
  const container = document.createElement('div');
  container.innerHTML = sanitizeHtml(doc.html || '');
  const rtl = /dir=["']rtl/i.test(doc.html || '') || container.querySelector('[dir="rtl"]') !== null;

  const body: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (tag === 'table') {
      body.push(tableXml(element as HTMLTableElement, rtl));
      return;
    }
    if (['ul', 'ol'].includes(tag)) {
      [...element.children].forEach((child) => {
        if (child.tagName.toLowerCase() === 'li') body.push(paragraphXml(child, rtl));
      });
      return;
    }
    if (['p', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'div'].includes(tag)) {
      body.push(paragraphXml(element, rtl));
      return;
    }
    element.childNodes.forEach(walk);
  };
  [...container.childNodes].forEach(walk);
  if (!body.length) body.push('<w:p><w:r><w:t/></w:r></w:p>');

  const pageWidth = doc.pageSize === 'Letter' ? 12240 : 11906;
  const pageHeight = doc.pageSize === 'Letter' ? 15840 : 16838;
  const mm = (value: number) => Math.round(value * 56.7);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${body.join('')}<w:sectPr><w:pgSz w:w="${pageWidth}" w:h="${pageHeight}"/><w:pgMar w:top="${mm(doc.margins.top)}" w:right="${mm(doc.margins.right)}" w:bottom="${mm(doc.margins.bottom)}" w:left="${mm(doc.margins.left)}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
}

export async function exportDocx(doc: WordDocument, filename: string): Promise<void> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.folder('_rels')?.file('.rels', RELS);
  zip.folder('word')?.file('document.xml', wordDocumentToXml(doc));
  zip.folder('docProps')?.file('core.xml', coreXml(doc.title));
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  downloadBlob(blob, filename.endsWith('.docx') ? filename : `${filename}.docx`);
}
