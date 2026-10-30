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
  // Tricolor pinwheel (red top, yellow bottom-right, green bottom-left) with a
  // white ring and blue core — the recognisable browser mark, redrawn by hand
  // from three rotated copies of one arc segment.
  const segment = 'M4 24A20 20 0 0 1 34 6.68L29 15.34A10 10 0 0 0 14 24Z';
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Browser">
      <circle cx="24" cy="24" r="21" fill="#fff" />
      <path d={segment} fill="#ea4335" />
      <path d={segment} fill="#fbbc05" transform="rotate(120 24 24)" />
      <path d={segment} fill="#34a853" transform="rotate(240 24 24)" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="7.6" fill="#4285f4" />
      <circle cx="21.6" cy="21.6" r="2.6" fill="#a8c7fa" opacity="0.7" />
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
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Settings">
      <defs>
        <linearGradient id="w12-gear" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#aeb9c8" />
          <stop offset="100%" stopColor="#5b6b7f" />
        </linearGradient>
      </defs>
      <g fill="url(#w12-gear)">
        {teeth.map((angle) => (
          <rect key={angle} x="21.2" y="3.6" width="5.6" height="10" rx="2.6" transform={`rotate(${angle} 24 24)`} />
        ))}
        <circle cx="24" cy="24" r="13.6" />
      </g>
      <circle cx="24" cy="24" r="6.8" fill="#eef2f7" />
      <circle cx="24" cy="24" r="3.2" fill="#5b6b7f" />
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

export function VSCodeIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Visual Studio Code">
      <path d="M34.5 5.5 14.8 20.9 8.5 16.1 5 17.8v12.4l3.5 1.7 6.3-4.8L34.5 42.5 43 38.6V9.4Z" fill="#007acc" />
      <path d="M34.5 5.5 43 9.4v29.2l-8.5 3.9Z" fill="#1f9cf0" />
      <path d="M34.5 5.5 14.8 20.9l3.9 3.1L34.5 12Z" fill="#0065a9" />
      <path d="M34.5 13.6 21.6 24l12.9 10.4Z" fill="#fff" />
      <path d="M8.5 20.4v7.2L13.2 24Z" fill="#fff" />
    </svg>
  );
}

export function MinesweeperIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Minesweeper">
      <rect x="6" y="6" width="36" height="36" rx="6" fill="#cbd5e1" />
      <g fill="#94a3b8">
        <rect x="9" y="9" width="14" height="14" rx="2" />
        <rect x="25" y="9" width="14" height="14" rx="2" />
        <rect x="9" y="25" width="14" height="14" rx="2" />
      </g>
      <rect x="25" y="25" width="14" height="14" rx="2" fill="#e2e8f0" />
      <circle cx="32" cy="32" r="6.4" fill="#1e293b" />
      <g stroke="#1e293b" strokeWidth="2" strokeLinecap="round">
        <path d="M32 22.6v3.2M32 38.2v3.2M22.6 32h3.2M38.2 32h3.2M25.4 25.4l2.3 2.3M36.3 36.3l2.3 2.3M38.6 25.4l-2.3 2.3M27.7 36.3l-2.3 2.3" />
      </g>
      <circle cx="29.8" cy="29.8" r="1.7" fill="#f8fafc" />
    </svg>
  );
}

export function SnakeIcon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="Snake">
      <rect x="6" y="6" width="36" height="36" rx="6" fill="#064e3b" />
      <g fill="#0a6b52" opacity="0.55">
        <rect x="10" y="10" width="8" height="8" />
        <rect x="26" y="10" width="8" height="8" />
        <rect x="18" y="18" width="8" height="8" />
        <rect x="10" y="26" width="8" height="8" />
        <rect x="26" y="26" width="8" height="8" />
      </g>
      <path
        d="M12 34h10a4 4 0 0 0 4-4v-8a4 4 0 0 1 4-4h6"
        fill="none"
        stroke="#4ade80"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="37" cy="18" r="4.6" fill="#4ade80" />
      <circle cx="38.4" cy="16.6" r="1.1" fill="#052e16" />
      <circle cx="13" cy="13" r="2.8" fill="#f87171" />
    </svg>
  );
}

export function Game2048Icon({ size = 48, className, style }: IconProps) {
  return (
    <svg {...base(size)} className={className} style={style} role="img" aria-label="2048">
      <rect x="6" y="6" width="36" height="36" rx="6" fill="#bbada0" />
      <rect x="10" y="10" width="13" height="13" rx="2.5" fill="#eee4da" />
      <rect x="25" y="10" width="13" height="13" rx="2.5" fill="#ede0c8" />
      <rect x="10" y="25" width="13" height="13" rx="2.5" fill="#f2b179" />
      <rect x="25" y="25" width="13" height="13" rx="2.5" fill="#ed7c0c" />
      <text x="31.5" y="35.5" textAnchor="middle" fontFamily="Segoe UI, sans-serif" fontSize="9" fontWeight="700" fill="#f9f8f4">
        2048
      </text>
    </svg>
  );
}

function MediaIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#160b14" />
      <rect x="4" y="6" width="24" height="20" rx="4" fill="url(#mediaGrad)" />
      <defs>
        <linearGradient id="mediaGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f43f5e" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d="M13 11.5v9l8-4.5z" fill="#fff" />
    </svg>
  );
}

function TetrisIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0c1a24" />
      <rect x="6" y="6" width="9" height="9" rx="1.5" fill="#22d3ee" />
      <rect x="17" y="6" width="9" height="9" rx="1.5" fill="#facc15" />
      <rect x="6" y="17" width="9" height="9" rx="1.5" fill="#c084fc" />
      <rect x="17" y="17" width="9" height="9" rx="1.5" fill="#4ade80" />
    </svg>
  );
}

function SolitaireIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0b1f14" />
      <rect x="7" y="5" width="13" height="18" rx="2.5" fill="#1e3a8a" transform="rotate(-12 13 14)" />
      <rect x="12" y="8" width="13" height="18" rx="2.5" fill="#f8fafc" transform="rotate(8 18 17)" />
      <text x="18.5" y="20" fontSize="9" fontWeight="bold" fill="#dc2626" textAnchor="middle" transform="rotate(8 18 17)">A♥</text>
    </svg>
  );
}

function MailIcon({ size }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0b1a33" />
      <rect x="4" y="8" width="24" height="16" rx="3" fill="#2563eb" />
      <path d="M5.5 10 16 17.5 26.5 10" fill="none" stroke="#dbeafe" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
  media: MediaIcon,
  mail: MailIcon,
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
  vscode: VSCodeIcon,
  minesweeper: MinesweeperIcon,
  snake: SnakeIcon,
  tetris: TetrisIcon,
  solitaire: SolitaireIcon,
  game2048: Game2048Icon,
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
