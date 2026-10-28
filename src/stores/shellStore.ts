import { create } from 'zustand';
import type { ContextMenuItem } from '../types';

/** Shell-level UI state: which flyout is open, context menus and modal dialogs. */

export type ShellPanel = 'start' | 'quick' | 'notifications' | 'taskview' | 'accessibility' | 'calendar' | 'network' | 'sound' | 'weather' | null;

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  /** Optional heading rendered above the items. */
  title?: string;
}

export interface DialogRequest {
  kind: 'confirm' | 'prompt' | 'alert';
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  multiline?: boolean;
  onConfirm?: (value: string) => void | Promise<void>;
  onCancel?: () => void;
}

export interface ShellState {
  panel: ShellPanel;
  contextMenu: ContextMenuState | null;
  dialog: DialogRequest | null;
  /** Node id shown in the Properties dialog. */
  propertiesNodeId: string | null;
  desktopSelection: string[];
  explorerSelection: string[];
  /** True while a drag operation owns the pointer (blocks stray clicks). */
  dragging: boolean;

  /** Inline taskbar search: query text shared by pill + flyout. */
  searchQuery: string;
  searchOpen: boolean;
  /** 'pill' = focused taskbar input (flyout only with a query), 'button' = compact flyout with its own input. */
  searchSource: 'pill' | 'button';
  setSearchQuery: (query: string) => void;
  openSearch: (source: 'pill' | 'button') => void;
  closeSearch: () => void;
  setPanel: (panel: ShellPanel) => void;
  togglePanel: (panel: Exclude<ShellPanel, null>) => void;
  closePanels: () => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  setProperties: (id: string | null) => void;
  openDialog: (dialog: DialogRequest) => void;
  closeDialog: () => void;
  confirmDialog: (value: string) => void;
  cancelDialog: () => void;
  setDesktopSelection: (ids: string[]) => void;
  setExplorerSelection: (ids: string[]) => void;
  setDragging: (dragging: boolean) => void;
}

export const useShellStore = create<ShellState>()((set, get) => ({
  panel: null,
  contextMenu: null,
  dialog: null,
  propertiesNodeId: null,
  desktopSelection: [],
  explorerSelection: [],
  dragging: false,

  searchQuery: '',
  searchOpen: false,
  searchSource: 'pill',
  setSearchQuery: (query) => set({ searchQuery: query, searchOpen: true }),
  openSearch: (source) => set({ searchOpen: true, searchSource: source, panel: null, contextMenu: null }),
  closeSearch: () => set({ searchOpen: false, searchQuery: '' }),
  setPanel: (panel) => set({ panel, contextMenu: null, searchOpen: false }),
  togglePanel: (panel) => set((state) => ({ panel: state.panel === panel ? null : panel, contextMenu: null })),
  closePanels: () => set({ panel: null }),
  openContextMenu: (menu) => set({ contextMenu: menu, panel: null }),
  closeContextMenu: () => set({ contextMenu: null }),

  setProperties: (id) => set({ propertiesNodeId: id }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  confirmDialog: (value) => {
    const dialog = get().dialog;
    set({ dialog: null });
    void dialog?.onConfirm?.(value);
  },
  cancelDialog: () => {
    const dialog = get().dialog;
    set({ dialog: null });
    dialog?.onCancel?.();
  },

  setDesktopSelection: (ids) => set({ desktopSelection: ids }),
  setExplorerSelection: (ids) => set({ explorerSelection: ids }),
  setDragging: (dragging) => set({ dragging }),
}));

/** Close every transient surface — used by Escape and by global pointer-down. */
export function dismissOverlays(): void {
  const state = useShellStore.getState();
  state.closeContextMenu();
  if (state.panel) state.closePanels();
}
