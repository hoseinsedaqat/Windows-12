import { useCallback, useEffect, useState } from 'react';
import { Delete, History, X } from 'lucide-react';
import { useT } from '../../i18n';
import { formatNumber } from '../../services/format';
import { useSettingsStore } from '../../stores/settingsStore';
import { getKV, setKV } from '../../services/db';
import { Segmented } from '../../components/ui/Controls';

const HISTORY_KEY = 'calc.history.v1';
const MEMORY_KEY = 'calc.memory.v1';

interface HistoryEntry {
  expression: string;
  result: string;
  at: number;
}

type Mode = 'standard' | 'scientific';

/** Safe arithmetic evaluator: shunting-yard over a token list — never `eval`. */
function evaluateExpression(input: string): number | string {
  const text = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/π/g, String(Math.PI)).replace(/e(?![0-9])/gi, String(Math.E));
  const tokens = tokenize(text);
  if (!tokens) return 'Error';
  const output: (number | string)[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };

  for (const token of tokens) {
    if (typeof token === 'number') {
      output.push(token);
    } else if (token === '(') {
      operators.push(token);
    } else if (token === ')') {
      while (operators.length && operators[operators.length - 1] !== '(') output.push(operators.pop() as string);
      if (!operators.length) return 'Error';
      operators.pop();
    } else if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'].includes(token)) {
      operators.push(token);
    } else {
      while (operators.length && (precedence[operators[operators.length - 1]] ?? 4) >= (precedence[token] ?? 0)) {
        output.push(operators.pop() as string);
      }
      operators.push(token);
    }
  }
  while (operators.length) {
    const operator = operators.pop() as string;
    if (operator === '(' || operator === ')') return 'Error';
    output.push(operator);
  }

  const stack: number[] = [];
  for (const token of output) {
    if (typeof token === 'number') {
      stack.push(token);
      continue;
    }
    if (['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'].includes(token)) {
      const value = stack.pop();
      if (value === undefined) return 'Error';
      stack.push(applyFunction(token, value));
      continue;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (right === undefined || left === undefined) return 'Error';
    switch (token) {
      case '+':
        stack.push(left + right);
        break;
      case '-':
        stack.push(left - right);
        break;
      case '*':
        stack.push(left * right);
        break;
      case '/':
        if (right === 0) return 'Cannot divide by zero';
        stack.push(left / right);
        break;
      case '%':
        stack.push(left % right);
        break;
      case '^':
        stack.push(left ** right);
        break;
      default:
        return 'Error';
    }
  }
  const result = stack.pop();
  if (result === undefined || stack.length || !Number.isFinite(result)) return 'Error';
  return result;
}

function applyFunction(name: string, value: number): number {
  switch (name) {
    case 'sin':
      return Math.sin((value * Math.PI) / 180);
    case 'cos':
      return Math.cos((value * Math.PI) / 180);
    case 'tan':
      return Math.tan((value * Math.PI) / 180);
    case 'log':
      return Math.log10(value);
    case 'ln':
      return Math.log(value);
    case 'sqrt':
      return Math.sqrt(value);
    case 'abs':
      return Math.abs(value);
    default:
      return value;
  }
}

function tokenize(text: string): (number | string)[] | null {
  const tokens: (number | string)[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === ' ') {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let value = '';
      while (index < text.length && /[0-9.]/.test(text[index])) {
        value += text[index];
        index += 1;
      }
      const parsed = Number(value);
      if (Number.isNaN(parsed)) return null;
      tokens.push(parsed);
      continue;
    }
    if (/[a-z]/i.test(char)) {
      let name = '';
      while (index < text.length && /[a-z]/i.test(text[index])) {
        name += text[index];
        index += 1;
      }
      if (!['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'abs'].includes(name.toLowerCase())) return null;
      tokens.push(name.toLowerCase());
      continue;
    }
    if ('+-*/%^()'.includes(char)) {
      // Unary minus
      if (char === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string')) tokens.push(0);
      tokens.push(char);
      index += 1;
      continue;
    }
    return null;
  }
  return tokens;
}

export function CalculatorApp() {
  const { t } = useT();
  const locale = useSettingsStore((state) => state.settings.locale);
  const [mode, setMode] = useState<Mode>('standard');
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);

  useEffect(() => {
    void getKV<HistoryEntry[]>(HISTORY_KEY).then((value) => {
      if (Array.isArray(value)) setHistory(value);
    });
    void getKV<number>(MEMORY_KEY).then((value) => {
      if (typeof value === 'number') setMemory(value);
    });
  }, []);

  const persistHistory = (next: HistoryEntry[]) => {
    setHistory(next);
    void setKV(HISTORY_KEY, next.slice(0, 60));
  };

  const numericLocale = locale.language === 'fa' ? 'fa-IR' : 'en-US';
  const pretty = useCallback(
    (value: number) => formatNumber(value, { locale: numericLocale, maximumFractionDigits: 10 }),
    [numericLocale],
  );

  const input = (value: string) => {
    setExpression((current) => (justEvaluated && /[0-9.]/.test(value) ? value : justEvaluated ? current + value : current + value));
    setJustEvaluated(false);
  };

  const equals = () => {
    if (!expression.trim()) return;
    const result = evaluateExpression(expression);
    if (typeof result === 'number') {
      const shown = pretty(result);
      setDisplay(shown);
      setJustEvaluated(true);
      persistHistory([{ expression, result: shown, at: Date.now() }, ...history].slice(0, 60));
      setExpression(shown);
    } else {
      setDisplay(result);
      setJustEvaluated(true);
    }
  };

  const clear = () => {
    setExpression('');
    setDisplay('0');
    setJustEvaluated(false);
  };

  const backspace = () => {
    setExpression((current) => current.slice(0, -1));
    setJustEvaluated(false);
  };

  const percent = () => {
    const result = evaluateExpression(expression);
    if (typeof result === 'number') {
      const value = result / 100;
      setExpression(pretty(value));
      setDisplay(pretty(value));
    }
  };

  const negate = () => {
    const result = evaluateExpression(expression || display);
    if (typeof result === 'number') {
      const value = pretty(-result);
      setExpression(value);
      setDisplay(value);
    }
  };

  const memoryAction = (action: 'mc' | 'mr' | 'm+' | 'm-' | 'ms') => {
    const current = (() => {
      const result = evaluateExpression(expression || display);
      return typeof result === 'number' ? result : 0;
    })();
    let next = memory;
    if (action === 'mc') next = 0;
    if (action === 'ms') next = current;
    if (action === 'm+') next = memory + current;
    if (action === 'm-') next = memory - current;
    if (action === 'mr') {
      setExpression(pretty(memory));
      setDisplay(pretty(memory));
      return;
    }
    setMemory(next);
    void setKV(MEMORY_KEY, next);
  };

  /* Keyboard support */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (/^[0-9.]$/.test(event.key)) {
        event.preventDefault();
        input(event.key);
      } else if (['+', '-', '*', '/', '%', '^', '(', ')'].includes(event.key)) {
        event.preventDefault();
        input(event.key);
      } else if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        equals();
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        backspace();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  interface CalcKey {
    label: string;
    onClick: () => void;
    tone?: 'fn' | 'op' | 'equals';
  }

  const standardKeys: CalcKey[] = [
    { label: 'MC', onClick: () => memoryAction('mc'), tone: 'fn' },
    { label: 'MR', onClick: () => memoryAction('mr'), tone: 'fn' },
    { label: 'M+', onClick: () => memoryAction('m+'), tone: 'fn' },
    { label: 'M-', onClick: () => memoryAction('m-'), tone: 'fn' },
    { label: 'MS', onClick: () => memoryAction('ms'), tone: 'fn' },
    { label: '%', onClick: percent, tone: 'fn' },
    { label: 'CE', onClick: () => setExpression(''), tone: 'fn' },
    { label: 'C', onClick: clear, tone: 'fn' },
    { label: '⌫', onClick: backspace, tone: 'fn' },
    { label: '1/x', onClick: () => { const value = evaluateExpression(expression || display); if (typeof value === 'number' && value !== 0) { setExpression(pretty(1 / value)); setDisplay(pretty(1 / value)); } else setDisplay('Cannot divide by zero'); }, tone: 'fn' },
    { label: 'x²', onClick: () => { const value = evaluateExpression(expression || display); if (typeof value === 'number') { setExpression(pretty(value ** 2)); setDisplay(pretty(value ** 2)); } }, tone: 'fn' },
    { label: '√', onClick: () => { const value = evaluateExpression(expression || display); if (typeof value === 'number') { setExpression(`sqrt(${pretty(value)})`); } }, tone: 'fn' },
    { label: '7', onClick: () => input('7') },
    { label: '8', onClick: () => input('8') },
    { label: '9', onClick: () => input('9') },
    { label: '÷', onClick: () => input('/'), tone: 'op' },
    { label: '4', onClick: () => input('4') },
    { label: '5', onClick: () => input('5') },
    { label: '6', onClick: () => input('6') },
    { label: '×', onClick: () => input('*'), tone: 'op' },
    { label: '1', onClick: () => input('1') },
    { label: '2', onClick: () => input('2') },
    { label: '3', onClick: () => input('3') },
    { label: '−', onClick: () => input('-'), tone: 'op' },
    { label: '±', onClick: negate },
    { label: '0', onClick: () => input('0') },
    { label: '.', onClick: () => input('.') },
    { label: '+', onClick: () => input('+'), tone: 'op' },
    { label: '=', onClick: equals, tone: 'equals' },
  ];

  const scientificKeys: CalcKey[] = [
    { label: 'sin', onClick: () => input('sin(') },
    { label: 'cos', onClick: () => input('cos(') },
    { label: 'tan', onClick: () => input('tan(') },
    { label: 'π', onClick: () => input('π') },
    { label: 'ln', onClick: () => input('ln(') },
    { label: 'log', onClick: () => input('log(') },
    { label: 'e', onClick: () => input('e') },
    { label: 'x^y', onClick: () => input('^') },
    { label: '(', onClick: () => input('(') },
    { label: ')', onClick: () => input(')') },
    { label: '|x|', onClick: () => input('abs(') },
    { label: 'mod', onClick: () => input('%') },
  ];

  return (
    <div className="flex h-full flex-col bg-[var(--surface-solid)] text-[var(--text)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <Segmented
          size="sm"
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          options={[
            { value: 'standard', label: t('calc.standard') },
            { value: 'scientific', label: t('calc.scientific') },
          ]}
        />
        <button type="button" className={`icon-button h-7 w-7 ${showHistory ? 'text-[var(--accent)]' : ''}`} onClick={() => setShowHistory((value) => !value)} aria-label={t('calc.history')}>
          <History size={15} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Display */}
          <div className="px-4 pb-2 pt-3 text-end">
            <div className="h-5 truncate text-[12px] opacity-55" dir="ltr">
              {expression || '\u00A0'}
            </div>
            <div className="truncate text-[34px] font-semibold leading-tight tabular-nums" dir="ltr">
              {display}
            </div>
            {memory ? (
              <div className="mt-1 flex items-center justify-end gap-1 text-[11px] opacity-60">
                <span className="rounded bg-[var(--hover)] px-1.5 py-0.5">M</span>
                <span dir="ltr">{pretty(memory)}</span>
              </div>
            ) : null}
          </div>

          {mode === 'scientific' ? (
            <div className="grid grid-cols-4 gap-1 px-3 pb-1">
              {scientificKeys.map((key) => (
                <button key={key.label} type="button" className="calc-key fn" onClick={key.onClick}>
                  {key.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid flex-1 grid-cols-4 gap-1 p-3">
            {standardKeys.map((key) => (
              <button
                key={key.label}
                type="button"
                className={`calc-key ${key.tone === 'op' || key.tone === 'fn' || key.tone === 'equals' ? key.tone : ''}`}
                onClick={key.onClick}
              >
                {key.label}
              </button>
            ))}
          </div>
        </div>

        {showHistory ? (
          <aside className="flex w-56 shrink-0 flex-col border-s border-[var(--border)] bg-[var(--surface-2)]">
            <header className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="text-[12px] font-semibold">{t('calc.history')}</span>
              <div className="flex items-center gap-1">
                <button type="button" className="icon-button h-6 w-6" title={t('calc.clearHistory')} onClick={() => persistHistory([])}>
                  <Delete size={13} />
                </button>
                <button type="button" className="icon-button h-6 w-6" title={t('common.close')} onClick={() => setShowHistory(false)}>
                  <X size={13} />
                </button>
              </div>
            </header>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
              {history.length === 0 ? <p className="p-3 text-center text-[11.5px] opacity-55">{t('calc.noHistory')}</p> : null}
              {history.map((entry) => (
                <button
                  key={`${entry.at}-${entry.expression}`}
                  type="button"
                  className="mb-1 block w-full rounded-md px-2 py-1.5 text-end transition hover:bg-[var(--hover)]"
                  onClick={() => {
                    setExpression(entry.result);
                    setDisplay(entry.result);
                  }}
                >
                  <span className="block truncate text-[11px] opacity-55" dir="ltr">
                    {entry.expression}
                  </span>
                  <span className="block truncate text-[14px] font-semibold tabular-nums" dir="ltr">
                    {entry.result}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export default CalculatorApp;
