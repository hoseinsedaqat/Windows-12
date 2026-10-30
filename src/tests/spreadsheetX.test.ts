import { describe, expect, it } from 'vitest';
import { evaluateSheet, isError } from '../core/spreadsheet/engine';
import { compileConditionalFormats, parseRangeA1 } from '../core/spreadsheet/conditional';
import type { ConditionalFormatRule } from '../types';

const evaluate = (cells: Record<string, string>) =>
  evaluateSheet((key) => cells[key], Object.keys(cells)).values;

describe('XLOOKUP + SPARKLINE', () => {
  it('XLOOKUP finds a match across separate ranges', () => {
    const values = evaluate({
      A1: 'tea', A2: 'coffee', A3: 'juice',
      B1: '3', B2: '4.5', B3: '2',
      D1: '=XLOOKUP("coffee",A1:A3,B1:B3)',
      D2: '=XLOOKUP("water",A1:A3,B1:B3,"none")',
      D3: '=XLOOKUP("water",A1:A3,B1:B3)',
    });
    expect(values.D1).toBe(4.5);
    expect(values.D2).toBe('none');
    expect(isError(values.D3)).toBe(true);
  });

  it('SPARKLINE renders unicode bars scaled to the range', () => {
    const values = evaluate({
      B1: '1', B2: '2', B3: '5', B4: '10',
      C1: '=SPARKLINE(B1:B4)',
    });
    expect(values.C1).toBe('\u2581\u2582\u2584\u2587');
  });
});

describe('conditional formatting compiler', () => {
  const getValue = (cells: Record<string, number | string>) => (key: string) => cells[key];

  it('parses A1 ranges', () => {
    expect(parseRangeA1('A1:B2')).toHaveLength(4);
    expect(parseRangeA1('C3')).toHaveLength(1);
    expect(parseRangeA1('nope')).toHaveLength(0);
  });

  it('flags greater-than cells and duplicates', () => {
    const cells = { A1: 10, A2: 3, A3: 12, B1: 'x', B2: 'y', B3: 'x' };
    const rules: ConditionalFormatRule[] = [
      { id: 'r1', type: 'greater', range: 'A1:A3', value: '5' },
      { id: 'r2', type: 'duplicates', range: 'B1:B3' },
    ];
    const styles = compileConditionalFormats(rules, getValue(cells));
    expect(styles.get('A1')?.background).toBeTruthy();
    expect(styles.get('A2')).toBeUndefined();
    expect(styles.get('B1')?.background).toBeTruthy();
    expect(styles.get('B2')).toBeUndefined();
  });

  it('scales data bars between min and max', () => {
    const cells = { A1: 0, A2: 5, A3: 10 };
    const styles = compileConditionalFormats([{ id: 'r', type: 'dataBar', range: 'A1:A3' }], getValue(cells));
    expect(styles.get('A1')?.bar).toBeCloseTo(0.04);
    expect(styles.get('A2')?.bar).toBeCloseTo(0.5);
    expect(styles.get('A3')?.bar).toBeCloseTo(1);
  });
});
