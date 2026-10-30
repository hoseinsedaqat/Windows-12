import { expandRange, letterToCol, refToKey } from './cellref';
import type { ConditionalFormatRule } from '../../types';
import type { CellValue } from './engine';

export interface ConditionalStyle {
  background?: string;
  color?: string;
  /** 0..1 relative bar length for dataBar rules. */
  bar?: number;
}

/** Parses "A1:B2" (or a single "A1") into cell refs. */
export function parseRangeA1(range: string) {
  const parse = (text: string | undefined) => {
    const match = /^([A-Z]+)(\d+)$/.exec((text ?? '').trim().toUpperCase());
    if (!match) return null;
    return { col: letterToCol(match[1]), row: Number(match[2]) };
  };
  const [startText, endText] = range.split(':');
  const start = parse(startText);
  const end = parse(endText ?? startText);
  if (!start || !end) return [];
  return expandRange(start, end);
}

/** Pre-computes conditional styles for every rule target cell (called once per render). */
export function compileConditionalFormats(
  rules: ConditionalFormatRule[],
  getValue: (key: string) => CellValue | undefined,
): Map<string, ConditionalStyle> {
  const styles = new Map<string, ConditionalStyle>();
  const merge = (key: string, style: ConditionalStyle) => {
    const previous = styles.get(key);
    styles.set(key, {
      background: style.background ?? previous?.background,
      color: style.color ?? previous?.color,
      bar: style.bar ?? previous?.bar,
    });
  };

  for (const rule of rules) {
    const keys = parseRangeA1(rule.range).map(refToKey);
    if (keys.length === 0) continue;
    const values = keys.map((key) => getValue(key));
    const numbers = values.filter((value): value is number => typeof value === 'number');

    if (rule.type === 'dataBar' || rule.type === 'colorScale') {
      if (numbers.length === 0) continue;
      const min = Math.min(...numbers);
      const max = Math.max(...numbers);
      const span = max - min || 1;
      keys.forEach((key, index) => {
        const value = values[index];
        if (typeof value !== 'number') return;
        const ratio = Math.min(1, Math.max(0, (value - min) / span));
        if (rule.type === 'dataBar') {
          merge(key, { bar: Math.max(0.04, ratio) });
        } else {
          merge(key, { background: `hsl(${Math.round(ratio * 120)} 80% 84%)` });
        }
      });
      continue;
    }

    if (rule.type === 'greater' || rule.type === 'less') {
      const threshold = Number(rule.value);
      if (rule.value === undefined || rule.value === '' || Number.isNaN(threshold)) continue;
      keys.forEach((key, index) => {
        const value = values[index];
        if (typeof value !== 'number') return;
        const hit = rule.type === 'greater' ? value > threshold : value < threshold;
        if (hit) {
          merge(key, {
            background: rule.color ?? (rule.type === 'greater' ? 'rgba(220,38,38,0.18)' : 'rgba(37,99,235,0.18)'),
            color: rule.color ? '#ffffff' : undefined,
          });
        }
      });
      continue;
    }

    if (rule.type === 'duplicates') {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        if (typeof value === 'string' && value !== '') counts.set(value, (counts.get(value) ?? 0) + 1);
      });
      keys.forEach((key, index) => {
        const value = values[index];
        if (typeof value === 'string' && (counts.get(value) ?? 0) > 1) {
          merge(key, { background: rule.color ?? 'rgba(245,158,11,0.25)' });
        }
      });
      continue;
    }

    if (rule.type === 'contains') {
      const needle = (rule.value ?? '').toLowerCase();
      if (!needle) continue;
      keys.forEach((key, index) => {
        const value = values[index];
        if (value !== undefined && String(value).toLowerCase().includes(needle)) {
          merge(key, { background: rule.color ?? 'rgba(245,158,11,0.25)' });
        }
      });
    }
  }
  return styles;
}
