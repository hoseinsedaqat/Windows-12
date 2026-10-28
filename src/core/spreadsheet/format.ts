import type { CellFormat, CellStyle } from '../../types';
import { displayValue, isError, type CellValue } from './engine';

export interface FormatOptions {
  currency?: string;
  locale?: string;
  numberSystem?: 'latn' | 'arabext';
}

/** Render a computed cell value according to its number format. */
export function formatCellValue(value: CellValue, style: CellStyle | undefined, options: FormatOptions = {}): string {
  if (value === undefined || value === null) return '';
  if (isError(value)) return value.code;
  const format: CellFormat = style?.format ?? 'general';
  const decimals = style?.decimals ?? 2;

  if (typeof value === 'string') {
    if (format === 'date') return value;
    return value;
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';

  const locale = buildLocale(options);
  switch (format) {
    case 'text':
      return String(value);
    case 'percent':
      return new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value);
    case 'currency':
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: options.currency ?? 'USD',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      } catch {
        return `${value.toFixed(decimals)} ${options.currency ?? 'USD'}`;
      }
    case 'number':
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: style?.decimals ?? 0,
        maximumFractionDigits: style?.decimals ?? 2,
      }).format(value);
    case 'date': {
      const date = excelSerialToDate(value);
      if (!date) return displayValue(value);
      return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    }
    case 'general':
    default:
      if (Math.abs(value) >= 1e12) return value.toExponential(4);
      const rounded = Math.round(value * 1e10) / 1e10;
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(rounded);
  }
}

function buildLocale(options: FormatOptions): string {
  const base = options.locale ?? 'en-US';
  if (options.numberSystem === 'arabext') return `${base}-u-nu-arabext`;
  return base;
}

/** Excel serial dates (1900 system) → JS Date. */
export function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 86400000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function dateToExcelSerial(date: Date): number {
  const epoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc - epoch) / 86400000);
}

/** Parse user text into a raw cell value, recognising dates and percentages. */
export function parseUserInput(input: string): { raw: string; detectedFormat?: CellFormat } {
  const text = input.trim();
  if (!text) return { raw: '' };
  if (text.startsWith('=')) return { raw: text };
  if (/^-?[\d.,]+$/.test(text)) return { raw: text };
  if (/^-?\d+(\.\d+)?%$/.test(text)) {
    const value = Number(text.slice(0, -1)) / 100;
    return { raw: String(value), detectedFormat: 'percent' };
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(date.getTime())) return { raw: String(dateToExcelSerial(date)), detectedFormat: 'date' };
  }
  return { raw: input };
}
