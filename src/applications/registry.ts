import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Lazy application loader.
 *
 * Heavy apps (Office suite, Accounting, Browser, Paint) are code-split so the
 * desktop itself starts instantly and only the app you open is downloaded.
 */

export interface AppWindowProps {
  windowId: string;
  props: Record<string, unknown>;
}

type LazyApp = LazyExoticComponent<ComponentType<AppWindowProps>>;

const COMPONENTS: Record<string, LazyApp> = {
  explorer: lazy(() => import('./FileExplorer/FileExplorerApp')),
  recyclebin: lazy(() => import('./FileExplorer/RecycleBinApp')),
  chrome: lazy(() => import('./Browser/BrowserApp')),
  word: lazy(() => import('./Word/WordApp')),
  excel: lazy(() => import('./Excel/ExcelApp')),
  powerpoint: lazy(() => import('./PowerPoint/PowerPointApp')),
  notepad: lazy(() => import('./Notepad/NotepadApp')),
  notes: lazy(() => import('./Notes/NotesApp')),
  accounting: lazy(() => import('./Accounting/AccountingApp')),
  calculator: lazy(() => import('./Calculator/CalculatorApp')),
  calendar: lazy(() => import('./Calendar/CalendarApp')),
  clock: lazy(() => import('./Clock/ClockApp')),
  photos: lazy(() => import('./Photos/PhotosApp')),
  paint: lazy(() => import('./Paint/PaintApp')),
  terminal: lazy(() => import('./Terminal/TerminalApp')),
  taskmanager: lazy(() => import('./TaskManager/TaskManagerApp')),
  settings: lazy(() => import('./Settings/SettingsApp')),
  run: lazy(() => import('./Run/RunApp')),
};

export function getAppComponent(appId: string): LazyApp | null {
  return COMPONENTS[appId] ?? null;
}

export const REGISTERED_APP_IDS = Object.keys(COMPONENTS);
