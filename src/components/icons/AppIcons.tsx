import type { CSSProperties } from 'react';
import type { FileKind } from '../../types';

/**
 * Original SVG app icons for the concept OS.
 *
 * They are hand-drawn renditions in the visual language of familiar desktop
 * apps — no brand artwork is copied and no trademark is claimed.
 */

export interface IconProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const base = (size = 48) => ({ width: size, height: size, viewBox: '0 0 48 48', xmlns: 'http://www.w3.org/2000/svg' });

export function WordIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Word">
      <defs>
        <linearGradient id="w12-word" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2b7cd3" />
          <stop offset="100%" stopColor="#185abd" />
        </linearGradient>
      </defs>
      <path d="M18 8h18a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff" stroke="#c7d7ee" />
      <g fill="#dbe7f8">
        <rect x="22" y="14" width="14" height="2.4" rx="1.2" />
        <rect x="22" y="20" width="14" height="2.4" rx="1.2" />
        <rect x="22" y="26" width="10" height="2.4" rx="1.2" />
      </g>
      <rect x="6" y="12" width="20" height="26" rx="4" fill="url(#w12-word)" />
      <path d="M10.5 19l2.2 11 2.4-8 2.4 8 2.2-11" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExcelIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Excel">
      <defs>
        <linearGradient id="w12-excel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#21a366" />
          <stop offset="100%" stopColor="#107c41" />
        </linearGradient>
      </defs>
      <path d="M18 8h18a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff" stroke="#cfe6d8" />
      <g stroke="#bfe3cd" strokeWidth="1">
        <path d="M22 14h14M22 19h14M22 24h14M22 29h14M29 14v20" />
      </g>
      <rect x="6" y="12" width="20" height="26" rx="4" fill="url(#w12-excel)" />
      <path d="M11 19l10 12M21 19L11 31" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function PowerPointIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="PowerPoint">
      <defs>
        <linearGradient id="w12-ppt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0613c" />
          <stop offset="100%" stopColor="#c43e1c" />
        </linearGradient>
      </defs>
      <path d="M18 8h18a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill="#fff" stroke="#f0d3c8" />
      <g fill="#f6dfd7">
        <rect x="22" y="24" width="3.4" height="8" rx="1.2" />
        <rect x="27" y="19" width="3.4" height="13" rx="1.2" />
        <rect x="32" y="15" width="3.4" height="17" rx="1.2" />
      </g>
      <rect x="6" y="12" width="20" height="26" rx="4" fill="url(#w12-ppt)" />
      <path d="M12 31V19h4.6a3.6 3.6 0 0 1 0 7.2H14.6" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

export function ChromeIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Browser">
      <circle cx="24" cy="24" r="20" fill="#fff" />
      <path d="M24 4a20 20 0 0 1 17.3 10H24a10 10 0 0 0-8.6 4.9L8.2 7.6A20 20 0 0 1 24 4z" fill="#ea4335" />
      <path d="M6.7 34A20 20 0 0 1 8.2 7.6l7.2 11.3A10 10 0 0 0 15.5 30z" fill="#fbbc05" transform="rotate(0 24 24)" />
      <path d="M24 44a20 20 0 0 1-17.3-10l9.8-5.1A10 10 0 0 0 24 34z" fill="#34a853" />
      <path d="M41.3 14A20 20 0 0 1 24 44v-10a10 10 0 0 0 8.6-15.1z" fill="#4285f4" opacity="0.18" />
      <path d="M24 44a20 20 0 0 0 17.3-30H24a10 10 0 0 1 0 20z" fill="#fbbc05" opacity="0" />
      <circle cx="24" cy="24" r="9" fill="#fff" />
      <circle cx="24" cy="24" r="7.4" fill="#4285f4" />
    </svg>
  );
}

export function ExplorerIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="File Explorer">
      <defs>
        <linearGradient id="w12-folder" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd76e" />
          <stop offset="100%" stopColor="#f2b134" />
        </linearGradient>
      </defs>
      <path d="M6 14a4 4 0 0 1 4-4h9l4 5h15a4 4 0 0 1 4 4v3H6z" fill="#e0a127" />
      <path d="M6 18h36a3 3 0 0 1 3 3.2l-1.8 17A4 4 0 0 1 39.2 42H8.8a4 4 0 0 1-4-3.8l-1.8-17A3 3 0 0 1 6 18z" fill="url(#w12-folder)" />
      <path d="M8 22h32" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.6" />
    </svg>
  );
}

export function FolderIcon({ size = 48, className, style, tint }: IconProps & { tint?: string }) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Folder">
      <path d="M6 14a4 4 0 0 1 4-4h9l4 5h15a4 4 0 0 1 4 4v3H6z" fill={tint ?? '#e0a127'} />
      <path
        d="M6 18h36a3 3 0 0 1 3 3.2l-1.8 17A4 4 0 0 1 39.2 42H8.8a4 4 0 0 1-4-3.8l-1.8-17A3 3 0 0 1 6 18z"
        fill={tint ? tint : '#f7c65b'}
        opacity={tint ? 0.85 : 1}
      />
    </svg>
  );
}

export function ThisPcIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="This PC">
      <rect x="5" y="9" width="38" height="25" rx="3" fill="#334155" />
      <rect x="8" y="12" width="32" height="19" rx="2" fill="#7dd3fc" />
      <path d="M8 12h32v6L24 24 8 18z" fill="#38bdf8" opacity="0.6" />
      <path d="M18 34h12l2 5H16z" fill="#475569" />
      <rect x="12" y="39" width="24" height="2.6" rx="1.3" fill="#64748b" />
    </svg>
  );
}

export function RecycleBinIcon({ size = 48, className, style, full }: IconProps & { full?: boolean }) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Recycle Bin">
      <path d="M12 14h24l-2 26a3 3 0 0 1-3 2.8H17a3 3 0 0 1-3-2.8z" fill="#93c5fd" opacity="0.55" />
      <path d="M12 14h24l-2 26a3 3 0 0 1-3 2.8H17a3 3 0 0 1-3-2.8z" fill="none" stroke="#60a5fa" strokeWidth="1.6" />
      {full ? <path d="M16 26h16l-1.4 14H17.4z" fill="#3b82f6" opacity="0.55" /> : null}
      <rect x="9" y="9.5" width="30" height="4.5" rx="2.2" fill="#60a5fa" />
      <rect x="19" y="5.5" width="10" height="4" rx="2" fill="#93c5fd" />
      <path d="M20 21v16M24 21v16M28 21v16" stroke="#1d4ed8" strokeWidth="1.6" opacity="0.6" strokeLinecap="round" />
    </svg>
  );
}

export function SettingsIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Settings">
      <defs>
        <linearGradient id="w12-gear" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
      </defs>
      <path
        d="M24 6l3.4 3.1 4.5-.9 1.5 4.3 4.2 1.9-1.3 4.4 2.6 3.8-3.3 3 0 4.6-4.5.6-2.3 4-4.3-1.7-4.3 1.7-2.3-4-4.5-.6 0-4.6-3.3-3 2.6-3.8-1.3-4.4 4.2-1.9 1.5-4.3 4.5.9z"
        fill="url(#w12-gear)"
      />
      <circle cx="24" cy="24" r="7" fill="#e2e8f0" />
      <circle cx="24" cy="24" r="3.4" fill="#64748b" />
    </svg>
  );
}

export function CalculatorIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Calculator">
      <rect x="9" y="5" width="30" height="38" rx="5" fill="#334155" />
      <rect x="13" y="9" width="22" height="9" rx="2" fill="#a5f3fc" />
      <g fill="#e2e8f0">
        <rect x="13" y="22" width="6" height="5" rx="1.5" />
        <rect x="21" y="22" width="6" height="5" rx="1.5" />
        <rect x="29" y="22" width="6" height="5" rx="1.5" />
        <rect x="13" y="30" width="6" height="5" rx="1.5" />
        <rect x="21" y="30" width="6" height="5" rx="1.5" />
        <rect x="29" y="30" width="6" height="5" rx="1.5" />
      </g>
      <rect x="13" y="37" width="14" height="4" rx="1.5" fill="#38bdf8" />
    </svg>
  );
}

export function NotepadIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Notepad">
      <rect x="9" y="6" width="30" height="36" rx="3" fill="#f8fafc" stroke="#cbd5e1" />
      <rect x="9" y="6" width="30" height="7" rx="3" fill="#4f7cff" />
      <g stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round">
        <path d="M14 20h20M14 26h20M14 32h13" />
      </g>
    </svg>
  );
}

export function NotesIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Notes">
      <path d="M8 10a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v22l-10 9H11a3 3 0 0 1-3-3z" fill="#fde047" />
      <path d="M40 32l-10 9v-9z" fill="#eab308" />
      <g stroke="#a16207" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        <path d="M14 17h20M14 23h20M14 29h12" />
      </g>
    </svg>
  );
}

export function CalendarIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Calendar">
      <rect x="7" y="9" width="34" height="33" rx="4" fill="#fff" stroke="#cbd5e1" />
      <rect x="7" y="9" width="34" height="9" rx="4" fill="#0ea5e9" />
      <rect x="14" y="5" width="3.4" height="8" rx="1.7" fill="#0369a1" />
      <rect x="30.6" y="5" width="3.4" height="8" rx="1.7" fill="#0369a1" />
      <g fill="#cbd5e1">
        <rect x="12" y="23" width="6" height="5" rx="1.4" />
        <rect x="21" y="23" width="6" height="5" rx="1.4" />
        <rect x="30" y="23" width="6" height="5" rx="1.4" />
        <rect x="12" y="31" width="6" height="5" rx="1.4" />
        <rect x="21" y="31" width="6" height="5" rx="1.4" fill="#0ea5e9" />
      </g>
    </svg>
  );
}

export function ClockIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Clock">
      <circle cx="24" cy="24" r="18" fill="#eef2ff" stroke="#6366f1" strokeWidth="2.4" />
      <path d="M24 13v11l8 5" fill="none" stroke="#4338ca" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="24" cy="24" r="2" fill="#4338ca" />
    </svg>
  );
}

export function PhotosIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Photos">
      <rect x="6" y="10" width="36" height="28" rx="4" fill="#fff" stroke="#d8b4fe" strokeWidth="2" />
      <rect x="9" y="13" width="30" height="22" rx="2" fill="#f3e8ff" />
      <circle cx="17" cy="20" r="3.4" fill="#fbbf24" />
      <path d="M9 33l9-9 6 6 5-4 10 8z" fill="#a855f7" />
    </svg>
  );
}

export function PaintIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Paint">
      <path d="M24 6c10 0 18 7 18 16 0 6-5 8-9 8h-4c-2.5 0-4 1.6-4 3.5 0 1 .4 1.8 1 2.6.7.9.7 2-.2 2.7-.6.4-1.3.6-2 .5C15 38.6 6 31.6 6 22 6 13 14 6 24 6z" fill="#fbcfe8" />
      <circle cx="16" cy="18" r="3.2" fill="#ef4444" />
      <circle cx="25" cy="14" r="3.2" fill="#f59e0b" />
      <circle cx="33" cy="20" r="3.2" fill="#22c55e" />
      <circle cx="28" cy="27" r="3.2" fill="#3b82f6" />
      <path d="M34 30l8 8-4 4-8-8z" fill="#7c3aed" />
    </svg>
  );
}

export function TerminalIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Terminal">
      <rect x="5" y="9" width="38" height="30" rx="4" fill="#0f172a" />
      <rect x="5" y="9" width="38" height="7" rx="4" fill="#1e293b" />
      <circle cx="11" cy="12.5" r="1.6" fill="#f87171" />
      <circle cx="16" cy="12.5" r="1.6" fill="#fbbf24" />
      <circle cx="21" cy="12.5" r="1.6" fill="#34d399" />
      <path d="M12 23l5 4-5 4M22 31h12" stroke="#4ade80" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TaskManagerIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Task Manager">
      <rect x="6" y="8" width="36" height="32" rx="4" fill="#1e293b" />
      <path d="M10 30h6l4-10 5 16 4-12 3 6h6" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#64748b">
        <rect x="10" y="13" width="12" height="2.4" rx="1.2" />
        <rect x="10" y="18" width="8" height="2.4" rx="1.2" />
      </g>
    </svg>
  );
}

export function AccountingIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Accounting">
      <rect x="7" y="7" width="34" height="34" rx="5" fill="#0f766e" />
      <rect x="11" y="12" width="26" height="7" rx="2" fill="#99f6e4" />
      <g fill="#5eead4">
        <rect x="11" y="23" width="7" height="4" rx="1.4" />
        <rect x="20" y="23" width="7" height="4" rx="1.4" />
        <rect x="29" y="23" width="8" height="4" rx="1.4" />
        <rect x="11" y="30" width="7" height="4" rx="1.4" />
        <rect x="20" y="30" width="7" height="4" rx="1.4" />
        <rect x="29" y="30" width="8" height="4" rx="1.4" />
      </g>
      <circle cx="34" cy="35" r="8" fill="#fbbf24" />
      <path d="M34 30.5v9M31.6 32.6h4.8a1.8 1.8 0 0 1 0 3.6h-4.8a1.8 1.8 0 0 0 0 3.6h4.8" stroke="#78350f" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function RunIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Run">
      <rect x="6" y="12" width="36" height="24" rx="4" fill="#334155" />
      <path d="M18 19l9 5-9 5z" fill="#4ade80" />
    </svg>
  );
}

export function StoreIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Store">
      <path d="M10 16h28l-2.5 22a4 4 0 0 1-4 3.5H16.5a4 4 0 0 1-4-3.5z" fill="#38bdf8" />
      <path d="M18 18v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#0369a1" strokeWidth="2.6" />
    </svg>
  );
}

export function TextFileIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Text file">
      <path d="M12 6h17l7 7v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#f8fafc" stroke="#cbd5e1" />
      <path d="M29 6l7 7h-7z" fill="#cbd5e1" />
      <g stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round">
        <path d="M15 21h18M15 27h18M15 33h11" />
      </g>
    </svg>
  );
}

export function ImageFileIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Image file">
      <rect x="8" y="10" width="32" height="28" rx="3" fill="#e0f2fe" stroke="#7dd3fc" />
      <circle cx="17" cy="19" r="3.4" fill="#fbbf24" />
      <path d="M8 34l9-8 6 5 5-4 12 9z" fill="#0ea5e9" />
    </svg>
  );
}

export function ShortcutIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Shortcut">
      <rect x="10" y="10" width="24" height="24" rx="4" fill="#e2e8f0" />
      <path d="M26 26h12v12H26z" fill="#fff" stroke="#94a3b8" />
      <path d="M29 35l4-6 3 3 2-3v7h-9z" fill="#3b82f6" />
    </svg>
  );
}

export function GenericFileIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="File">
      <path d="M12 6h17l7 7v29a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#f1f5f9" stroke="#cbd5e1" />
      <path d="M29 6l7 7h-7z" fill="#cbd5e1" />
    </svg>
  );
}

export function ConceptLogo({ size = 96, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Windows 12 Concept">
      <defs>
        <linearGradient id="w12-logo-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="w12-logo-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="w12-logo-c" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="w12-logo-d" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="19" height="19" rx="3.4" fill="url(#w12-logo-a)" />
      <rect x="25" y="4" width="19" height="19" rx="3.4" fill="url(#w12-logo-b)" />
      <rect x="4" y="25" width="19" height="19" rx="3.4" fill="url(#w12-logo-c)" />
      <rect x="25" y="25" width="19" height="19" rx="3.4" fill="url(#w12-logo-d)" />
    </svg>
  );
}

const APP_ICONS: Record<string, (props: IconProps) => JSX.Element> = {
  explorer: ExplorerIcon,
  chrome: ChromeIcon,
  word: WordIcon,
  excel: ExcelIcon,
  powerpoint: PowerPointIcon,
  notepad: NotepadIcon,
  notes: NotesIcon,
  accounting: AccountingIcon,
  calculator: CalculatorIcon,
  calendar: CalendarIcon,
  clock: ClockIcon,
  photos: PhotosIcon,
  paint: PaintIcon,
  terminal: TerminalIcon,
  taskmanager: TaskManagerIcon,
  settings: SettingsIcon,
  run: RunIcon,
  recyclebin: RecycleBinIcon,
  store: StoreIcon,
};

export function AppIcon({ appId, size = 32, className, style }: IconProps & { appId: string }) {
  const Component = APP_ICONS[appId] ?? GenericFileIcon;
  return <Component size={size} className={className} style={style} />;
}

export function KindIcon({ kind, size = 32, className, style }: IconProps & { kind: FileKind }) {
  switch (kind) {
    case 'folder':
      return <FolderIcon size={size} className={className} style={style} />;
    case 'doc':
      return <WordIcon size={size} className={className} style={style} />;
    case 'sheet':
      return <ExcelIcon size={size} className={className} style={style} />;
    case 'slides':
      return <PowerPointIcon size={size} className={className} style={style} />;
    case 'text':
      return <TextFileIcon size={size} className={className} style={style} />;
    case 'note':
      return <NotesIcon size={size} className={className} style={style} />;
    case 'image':
      return <ImageFileIcon size={size} className={className} style={style} />;
    case 'shortcut':
      return <ShortcutIcon size={size} className={className} style={style} />;
    default:
      return <GenericFileIcon size={size} className={className} style={style} />;
  }
}
