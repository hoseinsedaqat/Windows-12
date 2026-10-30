import { keyToRef, refToKey, isValidKey } from './cellref';

/**
 * Spreadsheet formula engine.
 *
 * Formulas are tokenised, parsed into an AST and evaluated by a recursive
 * evaluator — user input is never passed to `eval()` and never executed as code.
 * Dependencies are collected from the AST so a change can invalidate exactly the
 * cells that reference it, and cycles are reported as `#CYCLE!`.
 */

export const ERROR_CODES = ['#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#N/A', '#NUM!', '#NULL!', '#CYCLE!'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface SpreadsheetError {
  readonly error: true;
  readonly code: ErrorCode;
}

export type CellValue = number | string | boolean | SpreadsheetError;

export function makeError(code: ErrorCode): SpreadsheetError {
  return { error: true, code };
}

export function isError(value: unknown): value is SpreadsheetError {
  return Boolean(value) && typeof value === 'object' && (value as SpreadsheetError).error === true;
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'cell'; value: string }
  | { type: 'range'; start: string; end: string }
  | { type: 'name'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'colon' };

const OPERATORS = ['<=', '>=', '<>', '=', '<', '>', '+', '-', '*', '/', '^', '&'];

export class FormulaParseError extends Error {
  constructor(message: string, readonly at: number) {
    super(message);
    this.name = 'FormulaParseError';
  }
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const text = input.trim();

  while (i < text.length) {
    const char = text[i];
    if (char === ' ') {
      i += 1;
      continue;
    }
    if (char === '"') {
      let value = '';
      i += 1;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        value += text[i];
        i += 1;
      }
      tokens.push({ type: 'string', value });
      continue;
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(text[i + 1] ?? ''))) {
      let value = '';
      while (i < text.length && /[0-9.]/.test(text[i])) {
        value += text[i];
        i += 1;
      }
      // Scientific notation, e.g. 1.2E-3
      if (i < text.length && (text[i] === 'e' || text[i] === 'E')) {
        const save = i;
        let sci = 'e';
        i += 1;
        if (text[i] === '+' || text[i] === '-') {
          sci += text[i];
          i += 1;
        }
        if (/[0-9]/.test(text[i] ?? '')) {
          while (i < text.length && /[0-9]/.test(text[i])) {
            sci += text[i];
            i += 1;
          }
          value += sci;
        } else {
          i = save;
        }
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) throw new FormulaParseError(`Invalid number "${value}"`, i);
      tokens.push({ type: 'number', value: parsed });
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      let word = '';
      const start = i;
      while (i < text.length && /[A-Za-z0-9_$.]/.test(text[i])) {
        word += text[i];
        i += 1;
      }
      const upper = word.toUpperCase();
      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({ type: 'boolean', value: upper === 'TRUE' });
        continue;
      }
      // A cell reference or the start of a range?
      if (isValidKey(word)) {
        if (text[i] === ':') {
          const colonIndex = i;
          i += 1;
          let end = '';
          while (i < text.length && /[A-Za-z0-9$]/.test(text[i])) {
            end += text[i];
            i += 1;
          }
          if (isValidKey(end)) {
            tokens.push({ type: 'range', start: normalizeKey(word), end: normalizeKey(end) });
            continue;
          }
          i = colonIndex;
        }
        tokens.push({ type: 'cell', value: normalizeKey(word) });
        continue;
      }
      // Whole-column / whole-row ranges such as A:A are not supported.
      void start;
      tokens.push({ type: 'name', value: upper });
      continue;
    }
    if (char === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (char === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }
    if (char === ':') {
      tokens.push({ type: 'colon' });
      i += 1;
      continue;
    }
    if (char === '%') {
      tokens.push({ type: 'op', value: '%' });
      i += 1;
      continue;
    }
    const op = OPERATORS.find((candidate) => text.startsWith(candidate, i));
    if (op) {
      tokens.push({ type: 'op', value: op });
      i += op.length;
      continue;
    }
    throw new FormulaParseError(`Unexpected character "${char}"`, i);
  }
  return tokens;
}

function normalizeKey(key: string): string {
  return key.replace(/\$/g, '').toUpperCase();
}

/* ------------------------------------------------------------------ */
/* AST                                                                 */
/* ------------------------------------------------------------------ */

export type AstNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'cell'; key: string }
  | { type: 'range'; start: string; end: string }
  | { type: 'unary'; op: '-' | '+' | '%'; operand: AstNode }
  | { type: 'binary'; op: string; left: AstNode; right: AstNode }
  | { type: 'call'; name: string; args: AstNode[] };

export interface ParseResult {
  ast: AstNode;
  dependencies: string[];
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): AstNode {
    const node = this.parseComparison();
    if (this.pos < this.tokens.length) {
      const token = this.tokens[this.pos];
      throw new FormulaParseError(`Unexpected token ${describe(token)}`, this.pos);
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private parseComparison(): AstNode {
    let left = this.parseConcat();
    while (this.peek()?.type === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes((this.peek() as { value: string }).value)) {
      const op = (this.tokens[this.pos] as { value: string }).value;
      this.pos += 1;
      const right = this.parseConcat();
      left = { type: 'binary', op, left, right };
    }
    return left;
  }

  private parseConcat(): AstNode {
    let left = this.parseAdditive();
    while (this.peek()?.type === 'op' && (this.peek() as { value: string }).value === '&') {
      this.pos += 1;
      left = { type: 'binary', op: '&', left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): AstNode {
    let left = this.parseMultiplicative();
    for (;;) {
      const token = this.peek();
      if (token?.type === 'op' && ['+', '-'].includes(token.value)) {
        this.pos += 1;
        left = { type: 'binary', op: token.value, left, right: this.parseMultiplicative() };
        continue;
      }
      break;
    }
    return left;
  }

  private parseMultiplicative(): AstNode {
    let left = this.parsePower();
    for (;;) {
      const token = this.peek();
      if (token?.type === 'op' && ['*', '/'].includes(token.value)) {
        this.pos += 1;
        left = { type: 'binary', op: token.value, left, right: this.parsePower() };
        continue;
      }
      break;
    }
    return left;
  }

  private parsePower(): AstNode {
    const left = this.parseUnary();
    const token = this.peek();
    if (token?.type === 'op' && token.value === '^') {
      this.pos += 1;
      return { type: 'binary', op: '^', left, right: this.parsePower() };
    }
    return left;
  }

  private parseUnary(): AstNode {
    const token = this.peek();
    if (token?.type === 'op' && (token.value === '-' || token.value === '+')) {
      this.pos += 1;
      const operand = this.parseUnary();
      if (token.value === '+') return operand;
      return { type: 'unary', op: '-', operand };
    }
    const node = this.parsePostfix();
    return node;
  }

  private parsePostfix(): AstNode {
    let node = this.parsePrimary();
    while (this.peek()?.type === 'op' && (this.peek() as { value: string }).value === '%') {
      this.pos += 1;
      node = { type: 'unary', op: '%', operand: node };
    }
    return node;
  }

  private parsePrimary(): AstNode {
    const token = this.peek();
    if (!token) throw new FormulaParseError('Unexpected end of formula', this.pos);

    switch (token.type) {
      case 'number':
        this.pos += 1;
        return { type: 'number', value: token.value };
      case 'string':
        this.pos += 1;
        return { type: 'string', value: token.value };
      case 'boolean':
        this.pos += 1;
        return { type: 'boolean', value: token.value };
      case 'cell':
        this.pos += 1;
        return { type: 'cell', key: token.value };
      case 'range':
        this.pos += 1;
        return { type: 'range', start: token.start, end: token.end };
      case 'lparen': {
        this.pos += 1;
        const inner = this.parseComparison();
        if (this.peek()?.type !== 'rparen') throw new FormulaParseError('Missing closing parenthesis', this.pos);
        this.pos += 1;
        return inner;
      }
      case 'name': {
        const name = token.value;
        this.pos += 1;
        if (this.peek()?.type !== 'lparen') {
          throw new FormulaParseError(`Unknown name "${name}"`, this.pos);
        }
        this.pos += 1;
        const args: AstNode[] = [];
        if (this.peek()?.type !== 'rparen') {
          for (;;) {
            args.push(this.parseComparison());
            if (this.peek()?.type === 'comma') {
              this.pos += 1;
              continue;
            }
            break;
          }
        }
        if (this.peek()?.type !== 'rparen') throw new FormulaParseError(`Missing ")" after ${name}(...)`, this.pos);
        this.pos += 1;
        return { type: 'call', name, args };
      }
      default:
        throw new FormulaParseError(`Unexpected token ${describe(token)}`, this.pos);
    }
  }
}

function describe(token: Token): string {
  switch (token.type) {
    case 'number':
      return String(token.value);
    case 'string':
      return `"${token.value}"`;
    case 'boolean':
      return String(token.value);
    case 'cell':
      return token.value;
    case 'range':
      return `${token.start}:${token.end}`;
    case 'name':
      return token.value;
    case 'op':
      return token.value;
    case 'lparen':
      return '(';
    case 'rparen':
      return ')';
    case 'comma':
      return ',';
    case 'colon':
      return ':';
    default:
      return '?';
  }
}

export function parseFormula(input: string): ParseResult {
  const formula = input.trim().startsWith('=') ? input.trim().slice(1) : input.trim();
  const tokens = tokenize(formula);
  const ast = new Parser(tokens).parse();
  return { ast, dependencies: collectDependencies(ast) };
}

export function collectDependencies(node: AstNode, into: Set<string> = new Set()): string[] {
  switch (node.type) {
    case 'cell':
      into.add(node.key);
      break;
    case 'range': {
      for (const key of rangeKeys(node.start, node.end)) into.add(key);
      break;
    }
    case 'unary':
      collectDependencies(node.operand, into);
      break;
    case 'binary':
      collectDependencies(node.left, into);
      collectDependencies(node.right, into);
      break;
    case 'call':
      node.args.forEach((arg) => collectDependencies(arg, into));
      break;
    default:
      break;
  }
  return [...into];
}

export function rangeKeys(start: string, end: string): string[] {
  const a = keyToRef(start);
  const b = keyToRef(end);
  if (!a || !b) return [];
  const keys: string[] = [];
  const minCol = Math.min(a.col, b.col);
  const maxCol = Math.max(a.col, b.col);
  const minRow = Math.min(a.row, b.row);
  const maxRow = Math.max(a.row, b.row);
  // Guard against absurd ranges such as A1:ZZ1000000.
  if ((maxCol - minCol + 1) * (maxRow - minRow + 1) > 100_000) {
    for (let col = minCol; col <= minCol + 99; col += 1) {
      for (let row = minRow; row <= minRow + 99; row += 1) keys.push(refToKey({ col, row }));
    }
    return keys;
  }
  for (let col = minCol; col <= maxCol; col += 1) {
    for (let row = minRow; row <= maxRow; row += 1) keys.push(refToKey({ col, row }));
  }
  return keys;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

export type RawCellProvider = (key: string) => string | undefined;

export interface EvaluateContext {
  /** Raw text stored in a cell (formula strings included). */
  getRaw: RawCellProvider;
  /** Resolved value of a cell, computed on demand and memoised. */
  getValue: (key: string) => CellValue;
}

function toNumber(value: CellValue): number | SpreadsheetError {
  if (isError(value)) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = value.trim();
  if (text === '') return 0;
  const parsed = Number(text.replace(/,/g, ''));
  if (Number.isNaN(parsed)) return makeError('#VALUE!');
  return parsed;
}

function toText(value: CellValue): string {
  if (isError(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#NUM!';
    return String(Math.round(value * 1e10) / 1e10);
  }
  return value;
}

function toBoolean(value: CellValue): boolean | SpreadsheetError {
  if (isError(value)) return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = value.trim().toUpperCase();
  if (text === 'TRUE') return true;
  if (text === 'FALSE') return false;
  const parsed = Number(text);
  if (!Number.isNaN(parsed) && text !== '') return parsed !== 0;
  return makeError('#VALUE!');
}

function compareValues(left: CellValue, right: CellValue): number {
  if (typeof left === 'number' && typeof right === 'number') return left === right ? 0 : left < right ? -1 : 1;
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    const a = toBoolean(left);
    const b = toBoolean(right);
    if (isError(a)) return NaN;
    if (isError(b)) return NaN;
    return a === b ? 0 : a ? 1 : -1;
  }
  const a = toText(left).toLowerCase();
  const b = toText(right).toLowerCase();
  return a === b ? 0 : a < b ? -1 : 1;
}

/** Flatten args, expanding ranges into value lists (used by aggregate functions). */
function flattenValues(args: CellValue[][], ctx: EvaluateContext, argNodes: AstNode[]): CellValue[] {
  const out: CellValue[] = [];
  args.forEach((group, index) => {
    const node = argNodes[index];
    if (node?.type === 'range') {
      for (const key of rangeKeys(node.start, node.end)) out.push(ctx.getValue(key));
    } else {
      out.push(...group);
    }
  });
  return out;
}

function numericList(values: CellValue[]): { numbers: number[]; error?: SpreadsheetError } {
  const numbers: number[] = [];
  for (const value of values) {
    if (isError(value)) return { numbers, error: value };
    if (typeof value === 'number') {
      if (Number.isFinite(value)) numbers.push(value);
      continue;
    }
    if (typeof value === 'boolean') {
      numbers.push(value ? 1 : 0);
      continue;
    }
    // Text inside a range is ignored (Excel behaviour); a direct text arg is an error.
  }
  return { numbers };
}

type Fn = (args: CellValue[][], nodes: AstNode[], ctx: EvaluateContext) => CellValue;

const FUNCTIONS: Record<string, Fn> = {
  SUM: (args, nodes, ctx) => {
    const { numbers, error } = numericList(flattenValues(args, ctx, nodes));
    if (error) return error;
    return numbers.reduce((sum, value) => sum + value, 0);
  },
  AVERAGE: (args, nodes, ctx) => {
    const { numbers, error } = numericList(flattenValues(args, ctx, nodes));
    if (error) return error;
    if (!numbers.length) return makeError('#DIV/0!');
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  },
  MEDIAN: (args, nodes, ctx) => {
    const { numbers, error } = numericList(flattenValues(args, ctx, nodes));
    if (error) return error;
    if (!numbers.length) return makeError('#NUM!');
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  MIN: (args, nodes, ctx) => {
    const { numbers, error } = numericList(flattenValues(args, ctx, nodes));
    if (error) return error;
    return numbers.length ? Math.min(...numbers) : 0;
  },
  MAX: (args, nodes, ctx) => {
    const { numbers, error } = numericList(flattenValues(args, ctx, nodes));
    if (error) return error;
    return numbers.length ? Math.max(...numbers) : 0;
  },
  PRODUCT: (args, nodes, ctx) => {
    const { numbers, error } = numericList(flattenValues(args, ctx, nodes));
    if (error) return error;
    return numbers.reduce((product, value) => product * value, numbers.length ? 1 : 0);
  },
  COUNT: (args, nodes, ctx) => numericList(flattenValues(args, ctx, nodes)).numbers.length,
  COUNTA: (args, nodes, ctx) =>
    flattenValues(args, ctx, nodes).filter((value) => !(typeof value === 'string' && value === '')).length,
  IF: (args) => {
    const condition = toBoolean(args[0]?.[0] ?? false);
    if (isError(condition)) return condition;
    if (condition) return args[1]?.[0] ?? true;
    return args[2]?.[0] ?? false;
  },
  IFERROR: (args) => {
    const value = args[0]?.[0];
    if (value === undefined) return makeError('#VALUE!');
    return isError(value) ? (args[1]?.[0] ?? '') : value;
  },
  AND: (args) => {
    const values = args.flat();
    if (!values.length) return makeError('#VALUE!');
    let result = true;
    for (const value of values) {
      const bool = toBoolean(value);
      if (isError(bool)) return bool;
      if (!bool) result = false;
    }
    return result;
  },
  OR: (args) => {
    const values = args.flat();
    if (!values.length) return makeError('#VALUE!');
    for (const value of values) {
      const bool = toBoolean(value);
      if (isError(bool)) return bool;
      if (bool) return true;
    }
    return false;
  },
  NOT: (args) => {
    const bool = toBoolean(args[0]?.[0] ?? false);
    if (isError(bool)) return bool;
    return !bool;
  },
  ABS: (args) => {
    const value = toNumber(args[0]?.[0] ?? 0);
    return isError(value) ? value : Math.abs(value);
  },
  ROUND: (args) => {
    const value = toNumber(args[0]?.[0] ?? 0);
    if (isError(value)) return value;
    const digits = toNumber(args[1]?.[0] ?? 0);
    if (isError(digits)) return digits;
    const factor = 10 ** Math.trunc(digits);
    return Math.round(value * factor) / factor;
  },
  INT: (args) => {
    const value = toNumber(args[0]?.[0] ?? 0);
    return isError(value) ? value : Math.floor(value);
  },
  MOD: (args) => {
    const a = toNumber(args[0]?.[0] ?? 0);
    const b = toNumber(args[1]?.[0] ?? 0);
    if (isError(a)) return a;
    if (isError(b)) return b;
    if (b === 0) return makeError('#DIV/0!');
    return a - b * Math.floor(a / b);
  },
  POWER: (args) => {
    const base = toNumber(args[0]?.[0] ?? 0);
    const exponent = toNumber(args[1]?.[0] ?? 0);
    if (isError(base)) return base;
    if (isError(exponent)) return exponent;
    const result = base ** exponent;
    return Number.isFinite(result) ? result : makeError('#NUM!');
  },
  SQRT: (args) => {
    const value = toNumber(args[0]?.[0] ?? 0);
    if (isError(value)) return value;
    if (value < 0) return makeError('#NUM!');
    return Math.sqrt(value);
  },
  LEN: (args) => toText(args[0]?.[0] ?? '').length,
  UPPER: (args) => toText(args[0]?.[0] ?? '').toUpperCase(),
  LOWER: (args) => toText(args[0]?.[0] ?? '').toLowerCase(),
  TRIM: (args) => toText(args[0]?.[0] ?? '').trim().replace(/\s+/g, ' '),
  CONCAT: (args) => args.flat().map(toText).join(''),
  CONCATENATE: (args) => args.flat().map(toText).join(''),
  TEXTJOIN: (args) => {
    const separator = toText(args[0]?.[0] ?? '');
    const parts = args.slice(2).flat().map(toText).filter((part) => part !== '');
    return parts.join(separator);
  },
  TODAY: () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  },
  NOW: () => new Date().toISOString().slice(0, 16).replace('T', ' '),
  VLOOKUP: (args, _nodes, ctx) => {
    const needle = args[0]?.[0];
    const rangeNode = _nodes[1];
    const indexValue = toNumber(args[2]?.[0] ?? 1);
    if (needle === undefined || rangeNode?.type !== 'range' || isError(indexValue)) return makeError('#VALUE!');
    const index = Math.trunc(indexValue);
    if (index < 1) return makeError('#VALUE!');
    const start = keyToRef(rangeNode.start);
    const end = keyToRef(rangeNode.end);
    if (!start || !end) return makeError('#REF!');
    const firstCol = Math.min(start.col, end.col);
    const lastCol = Math.max(start.col, end.col);
    const firstRow = Math.min(start.row, end.row);
    const lastRow = Math.max(start.row, end.row);
    if (firstCol + index - 1 > lastCol) return makeError('#REF!');
    const approximate = args[3]?.[0] === undefined ? true : Boolean(toBoolean(args[3][0]));
    let fallback: CellValue = makeError('#N/A');
    for (let row = firstRow; row <= lastRow; row += 1) {
      const candidate = ctx.getValue(refToKey({ col: firstCol, row }));
      if (compareValues(candidate, needle) === 0) {
        return ctx.getValue(refToKey({ col: firstCol + index - 1, row }));
      }
      if (approximate && typeof candidate === 'number' && typeof needle === 'number' && candidate <= needle) {
        fallback = ctx.getValue(refToKey({ col: firstCol + index - 1, row }));
      }
    }
    return fallback;
  },
  XLOOKUP: (args, nodes, ctx) => {
    const needle = args[0]?.[0];
    const lookupNode = nodes[1];
    const returnNode = nodes[2];
    if (needle === undefined || lookupNode?.type !== 'range' || returnNode?.type !== 'range') return makeError('#VALUE!');
    const lookupStart = keyToRef(lookupNode.start);
    const lookupEnd = keyToRef(lookupNode.end);
    const returnStart = keyToRef(returnNode.start);
    const returnEnd = keyToRef(returnNode.end);
    if (!lookupStart || !lookupEnd || !returnStart || !returnEnd) return makeError('#REF!');
    const lookupCol = Math.min(lookupStart.col, lookupEnd.col);
    const lookupFirstRow = Math.min(lookupStart.row, lookupEnd.row);
    const lookupLastRow = Math.max(lookupStart.row, lookupEnd.row);
    const returnCol = Math.min(returnStart.col, returnEnd.col);
    const returnRowOffset = Math.min(returnStart.row, returnEnd.row) - lookupFirstRow;
    for (let row = lookupFirstRow; row <= lookupLastRow; row += 1) {
      const candidate = ctx.getValue(refToKey({ col: lookupCol, row }));
      if (compareValues(candidate, needle) === 0) {
        return ctx.getValue(refToKey({ col: returnCol, row: row + returnRowOffset }));
      }
    }
    return args[3]?.[0] !== undefined ? args[3][0] : makeError('#N/A');
  },
  SPARKLINE: (_args, nodes, ctx) => {
    const node = nodes[0];
    if (node?.type !== 'range') return makeError('#VALUE!');
    const values = rangeKeys(node.start, node.end).map((key) => ctx.getValue(key));
    const numbers = values.filter((value): value is number => typeof value === 'number');
    if (numbers.length === 0) return '';
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    const span = max - min || 1;
    const blocks = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587'];
    return values
      .map((value) => {
        if (typeof value !== 'number') return ' ';
        const level = Math.min(6, Math.max(0, Math.round(((value - min) / span) * 6)));
        return blocks[level];
      })
      .join('');
  },
  SUMIF: (args, nodes, ctx) => {
    const rangeNode = nodes[0];
    const criteria = args[1]?.[0];
    if (rangeNode?.type !== 'range' || criteria === undefined) return makeError('#VALUE!');
    const keys = rangeKeys(rangeNode.start, rangeNode.end);
    const sumNode = nodes[2];
    const sumKeys = sumNode?.type === 'range' ? rangeKeys(sumNode.start, sumNode.end) : keys;
    let total = 0;
    keys.forEach((key, index) => {
      const value = ctx.getValue(key);
      if (matchesCriteria(value, criteria)) {
        const target = ctx.getValue(sumKeys[Math.min(index, sumKeys.length - 1)] ?? key);
        const numeric = toNumber(target);
        if (!isError(numeric) && Number.isFinite(numeric)) total += numeric;
      }
    });
    return total;
  },
  COUNTIF: (args, nodes, ctx) => {
    const rangeNode = nodes[0];
    const criteria = args[1]?.[0];
    if (rangeNode?.type !== 'range' || criteria === undefined) return makeError('#VALUE!');
    return rangeKeys(rangeNode.start, rangeNode.end).filter((key) => matchesCriteria(ctx.getValue(key), criteria)).length;
  },
};

function matchesCriteria(value: CellValue, criteria: CellValue): boolean {
  const text = toText(criteria);
  const match = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(text);
  const operator = match?.[1] ?? '=';
  const needle = match?.[2] ?? text;
  if (operator === '<>' ) return compareValues(value, coerceCriteria(needle)) !== 0;
  if (['<', '>', '<=', '>='].includes(operator)) {
    const comparison = compareValues(value, coerceCriteria(needle));
    if (Number.isNaN(comparison)) return false;
    if (operator === '<') return comparison < 0;
    if (operator === '>') return comparison > 0;
    if (operator === '<=') return comparison <= 0;
    return comparison >= 0;
  }
  if (typeof value === 'string' && needle.includes('*')) {
    const pattern = new RegExp(`^${needle.split('*').map(escapeRegExp).join('.*')}$`, 'i');
    return pattern.test(value);
  }
  return compareValues(value, coerceCriteria(needle)) === 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function coerceCriteria(text: string): CellValue {
  if (text.toUpperCase() === 'TRUE') return true;
  if (text.toUpperCase() === 'FALSE') return false;
  const numeric = Number(text);
  if (text.trim() !== '' && !Number.isNaN(numeric)) return numeric;
  return text;
}

export function evaluateAst(node: AstNode, ctx: EvaluateContext): CellValue {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'string':
      return node.value;
    case 'boolean':
      return node.value;
    case 'cell':
      return ctx.getValue(node.key);
    case 'range': {
      // A bare range outside an aggregate is an implicit intersection → first cell.
      const keys = rangeKeys(node.start, node.end);
      return keys.length ? ctx.getValue(keys[0]) : makeError('#REF!');
    }
    case 'unary': {
      const value = toNumber(evaluateAst(node.operand, ctx));
      if (isError(value)) return value;
      if (node.op === '%') return value / 100;
      return node.op === '-' ? -value : value;
    }
    case 'binary': {
      const op = node.op;
      if (op === '&') {
        const left = evaluateAst(node.left, ctx);
        const right = evaluateAst(node.right, ctx);
        if (isError(left)) return left;
        if (isError(right)) return right;
        return toText(left) + toText(right);
      }
      if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
        const left = evaluateAst(node.left, ctx);
        const right = evaluateAst(node.right, ctx);
        if (isError(left)) return left;
        if (isError(right)) return right;
        const comparison = compareValues(left, right);
        if (Number.isNaN(comparison)) return makeError('#VALUE!');
        switch (op) {
          case '=':
            return comparison === 0;
          case '<>':
            return comparison !== 0;
          case '<':
            return comparison < 0;
          case '>':
            return comparison > 0;
          case '<=':
            return comparison <= 0;
          default:
            return comparison >= 0;
        }
      }
      const left = toNumber(evaluateAst(node.left, ctx));
      if (isError(left)) return left;
      const right = toNumber(evaluateAst(node.right, ctx));
      if (isError(right)) return right;
      switch (op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return right === 0 ? makeError('#DIV/0!') : left / right;
        case '^': {
          const result = left ** right;
          return Number.isFinite(result) ? result : makeError('#NUM!');
        }
        default:
          return makeError('#VALUE!');
      }
    }
    case 'call': {
      const fn = FUNCTIONS[node.name];
      if (!fn) return makeError('#NAME?');
      const args: CellValue[][] = node.args.map((arg) => {
        if (arg.type === 'range') {
          // Ranges are expanded lazily inside aggregate functions; here we
          // resolve the first cell so non-aggregate functions still work.
          const keys = rangeKeys(arg.start, arg.end);
          return keys.length ? [ctx.getValue(keys[0])] : [makeError('#REF!')];
        }
        return [evaluateAst(arg, ctx)];
      });
      try {
        return fn(args, node.args, ctx);
      } catch (error) {
        console.warn('[formula] evaluation failure', node.name, error);
        return makeError('#VALUE!');
      }
    }
    default:
      return makeError('#VALUE!');
  }
}

/* ------------------------------------------------------------------ */
/* Sheet evaluation                                                    */
/* ------------------------------------------------------------------ */

export interface EvaluateSheetResult {
  values: Record<string, CellValue>;
  dependencies: Record<string, string[]>;
}

/**
 * Evaluate every formula cell in a sheet. Non-formula cells are parsed to their
 * natural type (number / boolean / text) so downstream code can rely on values.
 */
export function evaluateSheet(getRaw: RawCellProvider, keys: Iterable<string>): EvaluateSheetResult {
  const values: Record<string, CellValue> = {};
  const dependencies: Record<string, string[]> = {};
  const asts = new Map<string, ParseResult>();
  const resolving = new Set<string>();
  const keyList = [...keys];

  const getValue = (key: string): CellValue => {
    if (key in values) return values[key];
    const raw = getRaw(key);
    if (raw === undefined || raw === '') {
      values[key] = '';
      return '';
    }
    if (raw.startsWith('=')) {
      if (resolving.has(key)) return makeError('#CYCLE!');
      let parsed = asts.get(key);
      if (!parsed) {
        try {
          parsed = parseFormula(raw);
          asts.set(key, parsed);
        } catch (error) {
          const code = error instanceof FormulaParseError ? '#VALUE!' : '#NAME?';
          values[key] = makeError(code as ErrorCode);
          dependencies[key] = [];
          return values[key];
        }
      }
      dependencies[key] = parsed.dependencies;
      resolving.add(key);
      const result = evaluateAst(parsed.ast, { getRaw, getValue });
      resolving.delete(key);
      values[key] = result;
      return result;
    }
    values[key] = parseLiteral(raw);
    return values[key];
  };

  for (const key of keyList) getValue(key);
  return { values, dependencies };
}

export function parseLiteral(raw: string): CellValue {
  const text = raw.trim();
  if (text === '') return '';
  if (text.toUpperCase() === 'TRUE') return true;
  if (text.toUpperCase() === 'FALSE') return false;
  const numeric = Number(text.replace(/,/g, ''));
  if (!Number.isNaN(numeric) && /^-?[\d.,]+([eE][-+]?\d+)?$/.test(text.replace(/,/g, ''))) return numeric;
  return raw;
}

export function displayValue(value: CellValue): string {
  if (isError(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#NUM!';
    if (Math.abs(value) >= 1e12) return value.toExponential(4);
    return String(Math.round(value * 1e10) / 1e10);
  }
  return value;
}

export const SUPPORTED_FUNCTIONS = Object.keys(FUNCTIONS).sort();
