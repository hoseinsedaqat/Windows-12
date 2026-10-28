import type { AppDefinition, FileKind } from '../types';

/**
 * Application Registry — the single source of truth for what can be launched.
 *
 * Start, Search, Run, the desktop, "Open with" and Task Manager all read from
 * here, so registering an app once makes it available everywhere.
 */

export const APPS: AppDefinition[] = [
  {
    id: 'explorer',
    name: 'File Explorer',
    keywords: ['file explorer', 'files', 'folders', 'this pc', 'مدیریت فایل', 'فایل', 'پوشه', 'رایانه من'],
    defaultSize: { width: 980, height: 620 },
    minSize: { width: 620, height: 400 },
    listed: true,
    category: 'system',
    accent: '#f6c445',
    handles: ['folder'],
  },
  {
    id: 'chrome',
    name: 'Google Chrome',
    keywords: ['chrome', 'browser', 'web', 'internet', 'کروم', 'مرورگر', 'اینترنت'],
    defaultSize: { width: 1120, height: 700 },
    minSize: { width: 640, height: 420 },
    listed: true,
    category: 'web',
    accent: '#4285f4',
  },
  {
    id: 'word',
    name: 'Word',
    keywords: ['word', 'document', 'writer', 'doc', 'ورد', 'سند', 'نویسنده'],
    singleton: true,
    defaultSize: { width: 1040, height: 720 },
    minSize: { width: 700, height: 460 },
    listed: true,
    category: 'productivity',
    accent: '#2b579a',
    handles: ['doc'],
  },
  {
    id: 'excel',
    name: 'Excel',
    keywords: ['excel', 'spreadsheet', 'sheet', 'table', 'اکسل', 'صفحه گسترده', 'جدول'],
    singleton: true,
    defaultSize: { width: 1100, height: 700 },
    minSize: { width: 720, height: 440 },
    listed: true,
    category: 'productivity',
    accent: '#217346',
    handles: ['sheet'],
  },
  {
    id: 'powerpoint',
    name: 'PowerPoint',
    keywords: ['powerpoint', 'presentation', 'slides', 'پاورپوینت', 'ارائه', 'اسلاید'],
    singleton: true,
    defaultSize: { width: 1120, height: 700 },
    minSize: { width: 760, height: 480 },
    listed: true,
    category: 'productivity',
    accent: '#d24726',
    handles: ['slides'],
  },
  {
    id: 'notepad',
    name: 'Notepad',
    keywords: ['notepad', 'text', 'txt', 'دفترچه', 'متن'],
    defaultSize: { width: 780, height: 560 },
    minSize: { width: 420, height: 320 },
    listed: true,
    category: 'productivity',
    accent: '#4f7cff',
    handles: ['text'],
  },
  {
    id: 'notes',
    name: 'Notes',
    keywords: ['notes', 'sticky', 'note', 'یادداشت'],
    singleton: true,
    defaultSize: { width: 900, height: 620 },
    minSize: { width: 520, height: 380 },
    listed: true,
    category: 'productivity',
    accent: '#f2b705',
    handles: ['note'],
  },
  {
    id: 'accounting',
    name: 'Accounting',
    keywords: ['accounting', 'invoice', 'ledger', 'finance', 'حسابداری', 'فاکتور', 'مالی'],
    singleton: true,
    defaultSize: { width: 1180, height: 740 },
    minSize: { width: 820, height: 520 },
    listed: true,
    category: 'business',
    accent: '#0f766e',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    keywords: ['calculator', 'calc', 'ماشین حساب', 'حسابگر'],
    singleton: true,
    defaultSize: { width: 380, height: 620 },
    minSize: { width: 320, height: 460 },
    listed: true,
    category: 'utilities',
    accent: '#3b82f6',
  },
  {
    id: 'calendar',
    name: 'Calendar',
    keywords: ['calendar', 'events', 'تقویم', 'رویداد'],
    singleton: true,
    defaultSize: { width: 980, height: 680 },
    minSize: { width: 620, height: 440 },
    listed: true,
    category: 'productivity',
    accent: '#0ea5e9',
  },
  {
    id: 'clock',
    name: 'Clock',
    keywords: ['clock', 'timer', 'stopwatch', 'alarm', 'ساعت', 'تایمر', 'کرونومتر', 'زنگ'],
    singleton: true,
    defaultSize: { width: 820, height: 600 },
    minSize: { width: 520, height: 400 },
    listed: true,
    category: 'utilities',
    accent: '#6366f1',
  },
  {
    id: 'photos',
    name: 'Photos',
    keywords: ['photos', 'pictures', 'gallery', 'تصاویر', 'عکس', 'گالری'],
    singleton: true,
    defaultSize: { width: 1020, height: 680 },
    minSize: { width: 600, height: 420 },
    listed: true,
    category: 'media',
    accent: '#a855f7',
    handles: ['image'],
  },
  {
    id: 'paint',
    name: 'Paint',
    keywords: ['paint', 'draw', 'canvas', 'نقاشی', 'طراحی'],
    singleton: true,
    defaultSize: { width: 1000, height: 700 },
    minSize: { width: 620, height: 440 },
    listed: true,
    category: 'media',
    accent: '#ec4899',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    keywords: ['terminal', 'console', 'shell', 'command', 'ترمینال', 'کنسول', 'فرمان'],
    defaultSize: { width: 820, height: 520 },
    minSize: { width: 460, height: 300 },
    listed: true,
    category: 'system',
    accent: '#111827',
  },
  {
    id: 'taskmanager',
    name: 'Task Manager',
    keywords: ['task manager', 'processes', 'performance', 'مدیر وظایف', 'فرایندها'],
    singleton: true,
    defaultSize: { width: 860, height: 620 },
    minSize: { width: 520, height: 380 },
    listed: true,
    category: 'system',
    accent: '#334155',
  },
  {
    id: 'settings',
    name: 'Settings',
    keywords: ['settings', 'preferences', 'control panel', 'تنظیمات'],
    singleton: true,
    defaultSize: { width: 1020, height: 700 },
    minSize: { width: 700, height: 480 },
    listed: true,
    category: 'system',
    accent: '#64748b',
  },
  {
    id: 'run',
    name: 'Run',
    keywords: ['run', 'launch', 'اجرا'],
    singleton: true,
    defaultSize: { width: 480, height: 240 },
    minSize: { width: 420, height: 220 },
    listed: false,
    category: 'system',
    accent: '#475569',
  },
  {
    id: 'recyclebin',
    name: 'Recycle Bin',
    keywords: ['recycle bin', 'trash', 'deleted', 'سطل بازیافت', 'زباله'],
    singleton: true,
    defaultSize: { width: 900, height: 580 },
    minSize: { width: 560, height: 380 },
    listed: false,
    category: 'system',
    accent: '#38bdf8',
  },
];

const BY_ID = new Map(APPS.map((app) => [app.id, app]));

export function getApp(appId: string): AppDefinition | undefined {
  return BY_ID.get(appId);
}

export function requireApp(appId: string): AppDefinition {
  const app = BY_ID.get(appId);
  if (!app) throw new Error(`Unknown application: ${appId}`);
  return app;
}

export function listedApps(): AppDefinition[] {
  return APPS.filter((app) => app.listed !== false);
}

export function appsByCategory(): Record<string, AppDefinition[]> {
  const grouped: Record<string, AppDefinition[]> = {};
  for (const app of listedApps()) {
    const key = app.category ?? 'utilities';
    grouped[key] = grouped[key] ?? [];
    grouped[key].push(app);
  }
  return grouped;
}

/** Which apps can open a given file kind. */
export function appsForKind(kind: FileKind): AppDefinition[] {
  return APPS.filter((app) => app.handles?.includes(kind));
}

export function defaultAppForKind(kind: FileKind): string | null {
  switch (kind) {
    case 'folder':
      return 'explorer';
    case 'doc':
      return 'word';
    case 'sheet':
      return 'excel';
    case 'slides':
      return 'powerpoint';
    case 'text':
      return 'notepad';
    case 'note':
      return 'notes';
    case 'image':
      return 'photos';
    default:
      return 'notepad';
  }
}

export interface AppSearchHit {
  app: AppDefinition;
  score: number;
}

/** Fuzzy-ish search used by Start, Search panel, Run and Settings. */
export function searchApps(query: string): AppSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return listedApps().map((app) => ({ app, score: 0 }));
  const hits: AppSearchHit[] = [];
  for (const app of APPS) {
    const name = app.name.toLowerCase();
    let score = -1;
    if (name === needle) score = 100;
    else if (name.startsWith(needle)) score = 80;
    else if (name.includes(needle)) score = 60;
    else if (app.keywords?.some((keyword) => keyword.toLowerCase().includes(needle))) score = 40;
    else if (app.id.includes(needle)) score = 30;
    if (score >= 0) hits.push({ app, score });
  }
  return hits.sort((a, b) => b.score - a.score);
}
