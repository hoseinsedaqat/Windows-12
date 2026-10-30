import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { clsx } from 'clsx';

/** Shared design-system controls used by every application in the OS. */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative shrink-0 rounded-full transition-colors disabled:opacity-40',
        size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 rounded-full bg-white shadow transition-all',
          size === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
          checked ? (size === 'sm' ? 'left-[13px]' : 'left-[18px]') : 'left-0.5',
        )}
      />
    </button>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {description ? <p className="mt-0.5 text-[11.5px] leading-snug opacity-60">{description}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function SliderRow({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  suffix = '%',
  icon,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  suffix?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[12.5px] font-medium">
          {icon}
          {label}
        </span>
        <span className="text-[11.5px] tabular-nums opacity-70">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border-strong)] accent-[var(--accent)]"
        aria-label={label}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          onClick={() => onChange(option.value)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md transition-colors',
            size === 'sm' ? 'px-2 py-1 text-[11.5px]' : 'px-2.5 py-1.5 text-[12.5px]',
            value === option.value ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--hover)]',
          )}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ToolButton({
  icon,
  label,
  onClick,
  active,
  disabled,
  size = 16,
  danger,
  title,
  onMouseDown,
}: {
  icon?: ReactNode;
  label?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  danger?: boolean;
  title?: string;
  /** Lets rich-text editors keep their selection while a toolbar button is pressed. */
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
      title={title ?? label}
      aria-label={label ?? title}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'hover:bg-[var(--hover)]',
        danger && 'text-red-500 hover:bg-red-500/12',
      )}
      style={size && size !== 16 ? { fontSize: `${Math.max(10, size - 4)}px` } : undefined}
    >
      {icon}
      {label ? <span className="truncate">{label}</span> : null}
    </button>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium opacity-75">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[10.5px] leading-snug opacity-55">{hint}</span> : null}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={ariaLabel}
      className={clsx('win-input cursor-pointer appearance-none pe-6', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 8px center',
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      {icon ? <span className="opacity-40">{icon}</span> : null}
      <p className="text-[13px] font-medium opacity-80">{title}</p>
      {message ? <p className="max-w-sm text-[11.5px] leading-relaxed opacity-55">{message}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
      {actionLabel && onAction ? (
        <button type="button" className="win-button win-button-accent mt-2" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-strong)]">
      <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }} />
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-[var(--hover)] text-[var(--text-secondary)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
    success: 'bg-emerald-500/15 text-emerald-500',
    warning: 'bg-amber-500/15 text-amber-500',
    danger: 'bg-red-500/15 text-red-500',
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium', tones[tone])}>{children}</span>;
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return <ModalInner title={title} onClose={onClose} width={width} footer={footer}>{children}</ModalInner>;
}

function ModalInner({
  title,
  onClose,
  children,
  footer,
  width,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width: string;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, { onEscape: onClose });
  return (
    <div
      ref={dialogRef}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={clsx('panel animate-scale-in flex max-h-full w-full flex-col overflow-hidden', width)}>
        <header className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          <button type="button" className="icon-button h-7 w-7 rounded" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </header>
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--border)] px-4 py-2.5">{footer}</footer> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts (hand-rolled SVG so no chart library is needed)               */
/* ------------------------------------------------------------------ */

export interface ChartPoint {
  label: string;
  value: number;
  value2?: number;
}

export function BarChart({ data, height = 160, color = 'var(--accent)', color2 = '#f59e0b', formatValue }: { data: ChartPoint[]; height?: number; color?: string; color2?: string; formatValue?: (value: number) => string }) {
  const max = Math.max(1, ...data.map((point) => Math.max(point.value, point.value2 ?? 0)));
  return (
    <div className="w-full">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((point) => (
          <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${point.label}: ${formatValue ? formatValue(point.value) : point.value}`}>
            <div className="flex w-full items-end justify-center gap-0.5" style={{ height: '100%' }}>
              <span className="w-1/2 rounded-t transition-all" style={{ height: `${(point.value / max) * 100}%`, background: color, minHeight: point.value > 0 ? 2 : 0 }} />
              {point.value2 !== undefined ? (
                <span className="w-1/2 rounded-t transition-all" style={{ height: `${(point.value2 / max) * 100}%`, background: color2, minHeight: point.value2 > 0 ? 2 : 0 }} />
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((point) => (
          <span key={point.label} className="flex-1 truncate text-center text-[9.5px] opacity-55">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, height = 160, color = 'var(--accent)', color2 }: { data: ChartPoint[]; height?: number; color?: string; color2?: string }) {
  const width = 320;
  const max = Math.max(1, ...data.map((point) => Math.max(point.value, point.value2 ?? 0)));
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const toPath = (key: 'value' | 'value2') =>
    data
      .map((point, index) => {
        const value = key === 'value' ? point.value : (point.value2 ?? 0);
        const x = index * stepX;
        const y = height - (value / max) * (height - 12) - 6;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1="0" x2={width} y1={height * ratio} y2={height * ratio} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
        ))}
        <path d={toPath('value')} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {data.some((point) => point.value2 !== undefined) && color2 ? (
          <path d={toPath('value2')} fill="none" stroke={color2} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" />
        ) : null}
        {data.map((point, index) => (
          <circle key={point.label} cx={index * stepX} cy={height - (point.value / max) * (height - 12) - 6} r="2.6" fill={color} />
        ))}
      </svg>
      <div className="mt-1 flex">
        {data.map((point) => (
          <span key={point.label} className="flex-1 truncate text-center text-[9.5px] opacity-55">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PieChart({ data, size = 150 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, item) => sum + Math.max(0, item.value), 0);
  const radius = size / 2;
  let angle = -Math.PI / 2;
  const arcs = data
    .filter((item) => item.value > 0)
    .map((item) => {
      const slice = (item.value / (total || 1)) * Math.PI * 2;
      const start = angle;
      const end = angle + slice;
      angle = end;
      const largeArc = slice > Math.PI ? 1 : 0;
      const x1 = radius + radius * Math.cos(start);
      const y1 = radius + radius * Math.sin(start);
      const x2 = radius + radius * Math.cos(end);
      const y2 = radius + radius * Math.sin(end);
      return { d: `M${radius},${radius} L${x1.toFixed(2)},${y1.toFixed(2)} A${radius},${radius} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`, color: item.color, label: item.label, value: item.value };
    });

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {total === 0 ? <circle cx={radius} cy={radius} r={radius - 1} fill="currentColor" opacity="0.08" /> : null}
        {arcs.map((arc) => (
          <path key={arc.d} d={arc.d} fill={arc.color} opacity="0.9">
            <title>{`${arc.label}: ${arc.value}`}</title>
          </path>
        ))}
        <circle cx={radius} cy={radius} r={radius * 0.46} fill="var(--surface-solid)" />
      </svg>
      <ul className="min-w-0 flex-1 space-y-1">
        {data.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11.5px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums opacity-65">{total ? Math.round((item.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StatusDot({ tone = 'success' }: { tone?: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const colors: Record<string, string> = {
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    neutral: 'bg-slate-400',
  };
  return <span className={clsx('inline-block h-2 w-2 rounded-full', colors[tone])} />;
}
