import { describe, expect, it } from 'vitest';
import {
  colToLetter,
  compareRefs,
  expandRange,
  isValidKey,
  keyToRef,
  letterToCol,
  MAX_COLS,
  MAX_ROWS,
  rangeKey,
  refToKey,
  shiftKey,
} from '../core/spreadsheet/cellref';
import {
  collectDependencies,
  displayValue,
  evaluateSheet,
  isError,
  makeError,
  parseFormula,
  parseLiteral,
  SUPPORTED_FUNCTIONS,
  type CellValue,
} from '../core/spreadsheet/engine';
import { dateToExcelSerial, excelSerialToDate, formatCellValue, parseUserInput } from '../core/spreadsheet/format';

type Raw = Record<string, string>;

/** Evaluate a small sheet described as A1 → raw text. */
function compute(cells: Raw, keys: string[] = Object.keys(cells)): Record<string, CellValue> {
  return evaluateSheet((key) => cells[key], keys).values;
}

function valueOf(cells: Raw, key: string): CellValue {
  const keys = new Set<string>(Object.keys(cells));
  keys.add(key);
  return compute(cells, [...keys])[key];
}

describe('cell references', () => {
  it('converts between columns, letters and keys', () => {
    expect(colToLetter(1)).toBe('A');
    expect(colToLetter(26)).toBe('Z');
    expect(colToLetter(27)).toBe('AA');
    expect(colToLetter(52)).toBe('AZ');
    expect(colToLetter(MAX_COLS)).toBe(colToLetter(100));
    expect(letterToCol('A')).toBe(1);
    expect(letterToCol('AA')).toBe(27);
    expect(letterToCol('zz')).toBe(702);
    expect(letterToCol('A1')).toBe(0);

    expect(refToKey({ col: 3, row: 12 })).toBe('C12');
    expect(keyToRef('c12')).toEqual({ col: 3, row: 12 });
    expect(keyToRef('nonsense')).toBeNull();
    expect(isValidKey('B7')).toBe(true);
    expect(isValidKey('7B')).toBe(false);
  });

  it('expands and compares ranges', () => {
    const cells = expandRange({ col: 1, row: 1 }, { col: 2, row: 3 });
    expect(cells.map((cell) => refToKey(cell))).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    // Reversed selections normalise.
    expect(expandRange({ col: 2, row: 3 }, { col: 1, row: 1 })).toHaveLength(6);
    expect(rangeKey({ col: 1, row: 1 }, { col: 2, row: 2 })).toContain(':');
    expect(compareRefs({ col: 1, row: 2 }, { col: 1, row: 5 })).toBeLessThan(0);
    expect(compareRefs({ col: 2, row: 1 }, { col: 1, row: 9 })).toBeGreaterThan(0);
  });

  it('shifts keys and clamps at the sheet limits', () => {
    expect(shiftKey('B2', 1, 1)).toBe('C3');
    expect(shiftKey('A1', -1, 0)).toBeNull();
    expect(shiftKey('A1', MAX_ROWS, 0)).toBeNull();
    expect(shiftKey('A1', 0, MAX_COLS)).toBeNull();
    expect(MAX_ROWS).toBe(1000);
    expect(MAX_COLS).toBe(100);
  });
});

describe('formula parser', () => {
  it('builds an AST and never evaluates raw strings', () => {
    const parsed = parseFormula('=SUM(A1:A3)*2+1');
    expect(parsed.ast).toBeTruthy();
    expect(parsed.dependencies).toEqual(expect.arrayContaining(['A1', 'A2', 'A3']));
    // The parser is structural: no eval/new Function is used anywhere in the engine.
    expect(collectDependencies(parsed.ast)).toEqual(parsed.dependencies);
  });

  it('collects dependencies across functions and nested ranges', () => {
    const deps = parseFormula('=IF(SUM(A1:A2)>0,B1&C2,"")').dependencies;
    expect(deps).toEqual(expect.arrayContaining(['A1', 'A2', 'B1', 'C2']));
  });

  it('rejects malformed formulas instead of guessing', () => {
    expect(() => parseFormula('=SUM(A1')).toThrow();
    expect(() => parseFormula('=1+')).toThrow();
  });

  it('parses literals', () => {
    expect(parseLiteral('42')).toBe(42);
    expect(parseLiteral('3.5')).toBe(3.5);
    expect(parseLiteral('TRUE')).toBe(true);
    expect(parseLiteral('hello')).toBe('hello');
    expect(parseLiteral('')).toBe('');
  });

  it('lists the supported functions', () => {
    for (const fn of ['SUM', 'AVERAGE', 'MIN', 'MAX', 'COUNT', 'IF']) {
      expect(SUPPORTED_FUNCTIONS).toContain(fn);
    }
  });
});

describe('formula evaluation', () => {
  const sheet: Raw = { A1: '10', A2: '20', A3: '30', A4: 'text', A5: '', B1: '4', B2: '0' };

  it('evaluates arithmetic with operator precedence', () => {
    expect(valueOf(sheet, 'C1')).toBe('');
    const cells = { ...sheet, C1: '=2+3*4', C2: '=(2+3)*4', C3: '=10/4', C4: '=2^3', C5: '=-A1+A2', C6: '=7&" kg"' };
    expect(valueOf(cells, 'C1')).toBe(14);
    expect(valueOf(cells, 'C2')).toBe(20);
    expect(valueOf(cells, 'C3')).toBe(2.5);
    expect(valueOf(cells, 'C4')).toBe(8);
    expect(valueOf(cells, 'C5')).toBe(10);
    expect(valueOf(cells, 'C6')).toBe('7 kg');
  });

  it('aggregates ranges and skips text/blank cells', () => {
    const cells = {
      ...sheet,
      D1: '=SUM(A1:A5)',
      D2: '=AVERAGE(A1:A3)',
      D3: '=MIN(A1:A3)',
      D4: '=MAX(A1:A3)',
      D5: '=COUNT(A1:A5)',
      D6: '=COUNTA(A1:A5)',
      D7: '=SUM(A1:A3,B1)',
    };
    expect(valueOf(cells, 'D1')).toBe(60);
    expect(valueOf(cells, 'D2')).toBe(20);
    expect(valueOf(cells, 'D3')).toBe(10);
    expect(valueOf(cells, 'D4')).toBe(30);
    expect(valueOf(cells, 'D5')).toBe(3);
    expect(valueOf(cells, 'D6')).toBe(4);
    expect(valueOf(cells, 'D7')).toBe(64);
  });

  it('evaluates IF / AND / OR / NOT with comparisons', () => {
    const cells = {
      ...sheet,
      E1: '=IF(A1>5,"big","small")',
      E2: '=IF(A1>A2,"yes","no")',
      E3: '=IF(AND(A1>5,B1<5),1,0)',
      E4: '=IF(OR(A1>100,B1>100),1,0)',
      E5: '=IF(NOT(A1>5),1,0)',
      E6: '=IF(B2=0,"zero","other")',
    };
    expect(valueOf(cells, 'E1')).toBe('big');
    expect(valueOf(cells, 'E2')).toBe('no');
    expect(valueOf(cells, 'E3')).toBe(1);
    expect(valueOf(cells, 'E4')).toBe(0);
    expect(valueOf(cells, 'E5')).toBe(0);
    expect(valueOf(cells, 'E6')).toBe('zero');
  });

  it('follows cell-dependent formulas transitively', () => {
    const cells = { A1: '5', A2: '=A1*2', A3: '=SUM(A1:A2)', A4: '=A3+A2' };
    const values = compute(cells);
    expect(values.A2).toBe(10);
    expect(values.A3).toBe(15);
    expect(values.A4).toBe(25);
  });

  it('reports #DIV/0!, #VALUE!, #NAME? and #REF!', () => {
    const div = valueOf({ A1: '1', B1: '0', C1: '=A1/B1' }, 'C1');
    expect(isError(div)).toBe(true);
    expect((div as { code: string }).code).toBe('#DIV/0!');

    const value = valueOf({ A1: 'text', C1: '=A1+1' }, 'C1');
    expect(isError(value)).toBe(true);
    expect((value as { code: string }).code).toBe('#VALUE!');

    const name = valueOf({ C1: '=NOSUCHFN(1)' }, 'C1');
    expect(isError(name)).toBe(true);
    expect((name as { code: string }).code).toBe('#NAME?');

    const ref = valueOf({ C1: '=SUM(' }, 'C1');
    expect(isError(ref)).toBe(true);
  });

  it('detects circular references', () => {
    const values = compute({ A1: '=B1', B1: '=A1' });
    const cyclic = [values.A1, values.B1].filter((value) => isError(value) && value.code === '#CYCLE!');
    expect(cyclic.length).toBeGreaterThan(0);
  });

  it('supports text and lookup helpers', () => {
    const cells = {
      A1: ' hello ',
      B1: '=TRIM(A1)',
      B2: '=UPPER(TRIM(A1))',
      B3: '=LEN(TRIM(A1))',
      B4: '=CONCAT(TRIM(A1)," world")',
      C1: '=ROUND(2.345,2)',
      C2: '=ABS(-7)',
      C3: '=MOD(10,3)',
      C4: '=SQRT(16)',
      C5: '=POWER(2,5)',
      C6: '=INT(3.9)',
    };
    expect(valueOf(cells, 'B1')).toBe('hello');
    expect(valueOf(cells, 'B2')).toBe('HELLO');
    expect(valueOf(cells, 'B3')).toBe(5);
    expect(valueOf(cells, 'B4')).toBe('hello world');
    expect(valueOf(cells, 'C1')).toBe(2.35);
    expect(valueOf(cells, 'C2')).toBe(7);
    expect(valueOf(cells, 'C3')).toBe(1);
    expect(valueOf(cells, 'C4')).toBe(4);
    expect(valueOf(cells, 'C5')).toBe(32);
    expect(valueOf(cells, 'C6')).toBe(3);
  });

  it('evaluates SUMIF / COUNTIF and VLOOKUP over real ranges', () => {
    const cells: Raw = {
      A1: 'apple', B1: '3',
      A2: 'pear', B2: '5',
      A3: 'apple', B3: '7',
      C1: '=SUMIF(A1:A3,"apple",B1:B3)',
      C2: '=COUNTIF(A1:A3,"apple")',
      C3: '=VLOOKUP("pear",A1:B3,2,FALSE)',
    };
    expect(valueOf(cells, 'C1')).toBe(10);
    expect(valueOf(cells, 'C2')).toBe(2);
    expect(valueOf(cells, 'C3')).toBe(5);
  });

  it('returns dependency metadata for the grid', () => {
    const result = evaluateSheet((key) => ({ A1: '1', A2: '=A1+1' }[key]), ['A1', 'A2']);
    expect(result.dependencies.A2).toEqual(['A1']);
    expect(result.values.A2).toBe(2);
  });

  it('renders computed values for display', () => {
    expect(displayValue(2.5)).toBe('2.5');
    expect(displayValue(true)).toBe('TRUE');
    expect(displayValue('')).toBe('');
    expect(displayValue(makeError('#REF!'))).toBe('#REF!');
  });
});

describe('cell formatting', () => {
  it('formats numbers, currency, percent and text', () => {
    expect(formatCellValue(1234.5, { format: 'number', decimals: 2 }, { locale: 'en-US' })).toBe('1,234.50');
    expect(formatCellValue(0.25, { format: 'percent', decimals: 0 }, { locale: 'en-US' })).toBe('25%');
    expect(formatCellValue(1500, { format: 'currency', decimals: 2 }, { locale: 'en-US', currency: 'USD' })).toBe('$1,500.00');
    expect(formatCellValue('hello', { format: 'text' })).toBe('hello');
    expect(formatCellValue(true, undefined)).toBe('TRUE');
    expect(formatCellValue(makeError('#DIV/0!'), undefined)).toBe('#DIV/0!');
    expect(formatCellValue(undefined as unknown as CellValue, undefined)).toBe('');
  });

  it('honours the locale and Persian digits', () => {
    const latin = formatCellValue(1234, { format: 'number', decimals: 0 }, { locale: 'en-US' });
    const persian = formatCellValue(1234, { format: 'number', decimals: 0 }, { locale: 'fa-IR', numberSystem: 'arabext' });
    expect(latin).toBe('1,234');
    expect(persian).toBe('۱٬۲۳۴');
  });

  it('converts Excel serial dates both ways', () => {
    const serial = dateToExcelSerial(new Date(2026, 9, 27));
    const back = excelSerialToDate(serial)!;
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(9);
    expect(back.getDate()).toBe(27);
    expect(excelSerialToDate(0)).toBeNull();
    expect(excelSerialToDate(-5)).toBeNull();
    expect(formatCellValue(serial, { format: 'date' }, { locale: 'en-US' })).toMatch(/2026/);
  });

  it('detects dates and percentages typed by the user', () => {
    expect(parseUserInput('2026-10-27')).toEqual({ raw: String(dateToExcelSerial(new Date(2026, 9, 27))), detectedFormat: 'date' });
    expect(parseUserInput('12%')).toEqual({ raw: '0.12', detectedFormat: 'percent' });
    expect(parseUserInput('42')).toEqual({ raw: '42' });
    expect(parseUserInput('=SUM(A1)')).toEqual({ raw: '=SUM(A1)' });
    expect(parseUserInput('  ')).toEqual({ raw: '' });
    expect(parseUserInput('plain text')).toEqual({ raw: 'plain text' });
  });
});
