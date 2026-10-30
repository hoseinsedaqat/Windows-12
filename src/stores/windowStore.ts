import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SnapPosition, SnapZone, VirtualDesktop, WindowBounds, WindowInstance } from '../types';
import { getApp } from '../core/ApplicationRegistry';
import { uid } from '../services/id';

export const TASKBAR_HEIGHT = 52;

export interface DesktopSize {
  width: number;
  height: number;
}

const DEFAULT_DESKTOP: DesktopSize = { width: 1440, height: 900 };

function clampBounds(bounds: WindowBounds, desktop: DesktopSize, taskbarHeight = TASKBAR_HEIGHT): WindowBounds {
  const maxW = Math.max(280, desktop.width);
  const maxH = Math.max(200, desktop.height - taskbarHeight);
  const width = Math.min(bounds.width, maxW);
  const height = Math.min(bounds.height, maxH);
  // Keep at least 48px of the title bar reachable so a window can never be lost.
  const x = Math.min(Math.max(bounds.x, 48 - width), maxW - 48);
  const y = Math.min(Math.max(bounds.y, 0), maxH - 40);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export function workArea(desktop: DesktopSize, taskbarHeight = TASKBAR_HEIGHT): WindowBounds {
  return { x: 0, y: 0, width: desktop.width, height: Math.max(200, desktop.height - taskbarHeight) };
}

export function snapBounds(position: SnapPosition, desktop: DesktopSize): WindowBounds {
  const area = workArea(desktop);
  const half = Math.round(area.width / 2);
  const quarterH = Math.round(area.height / 2);
  switch (position) {
    case 'left':
      return { x: 0, y: 0, width: half, height: area.height };
    case 'right':
      return { x: area.width - half, y: 0, width: half, height: area.height };
    case 'top-left':
      return { x: 0, y: 0, width: half, height: quarterH };
    case 'top-right':
      return { x: half, y: 0, width: half, height: quarterH };
    case 'bottom-left':
      return { x: 0, y: quarterH, width: half, height: quarterH };
    case 'bottom-right':
      return { x: half, y: quarterH, width: half, height: quarterH };
    case 'maximize':
      return area;
    case 'none':
    default:
      return area;
  }
}

export interface WindowState {
  windows: WindowInstance[];
  zTop: number;
  desktop: DesktopSize;
  showDesktop: boolean;
  /** Window ids hidden by "Show desktop" so they can be restored. */
  hiddenByShowDesktop: string[];
  altTab: { active: boolean; index: number };
  /** Virtual desktops (Windows 11 style workspaces). */
  virtualDesktops: VirtualDesktop[];
  activeVirtualDesktop: string;
  pinnedApps: string[];
  snapPreview: { position: SnapPosition; windowId: string } | null;

  setDesktopSize: (size: DesktopSize) => void;
  openApp: (appId: string, props?: Record<string, unknown>, options?: { title?: string; forceNew?: boolean }) => string | null;
  closeWindow: (id: string) => void;
  closeAllWindows: () => void;
  minimize: (id: string) => void;
  restoreFromMinimize: (id: string) => void;
  toggleMaximize: (id: string) => void;
  maximize: (id: string) => void;
  restore: (id: string) => void;
  focus: (id: string) => void;
  setBounds: (id: string, bounds: Partial<WindowBounds>) => void;
  snapWindow: (id: string, position: SnapPosition) => void;
  /** Snap a window to a fractional zone of the work area (snap layouts). */
  snapToZone: (id: string, zone: SnapZone, groupId?: string) => void;
  /** Focus every window of a snap group (restore the layout together). */
  restoreSnapGroup: (groupId: string) => void;
  setSnapPreview: (preview: { position: SnapPosition; windowId: string } | null) => void;
  setWindowTitle: (id: string, title: string) => void;
  setWindowProps: (id: string, props: Record<string, unknown>) => void;
  toggleShowDesktop: () => void;
  cycle: (direction: 1 | -1) => void;
  setAltTab: (active: boolean, index?: number) => void;
  addVirtualDesktop: () => string;
  removeVirtualDesktop: (id: string) => void;
  switchVirtualDesktop: (id: string) => void;
  moveWindowToDesktop: (windowId: string, desktopId: string) => void;
  togglePin: (appId: string) => void;
  endTask: (appId: string) => void;
  windowsForApp: (appId: string) => WindowInstance[];
}

export const useWindowStore = create<WindowState>()(
  persist(
    (set, get) => ({
      windows: [],
      zTop: 10,
      desktop: DEFAULT_DESKTOP,
      showDesktop: false,
      hiddenByShowDesktop: [],
      altTab: { active: false, index: 0 },
      virtualDesktops: [{ id: 'vd-main', name: 'Desktop 1' }],
      activeVirtualDesktop: 'vd-main',
      pinnedApps: ['explorer', 'chrome', 'word', 'excel', 'vscode', 'accounting', 'settings'],
      snapPreview: null,

      snapToZone: (id, zone, groupId) =>
        set((state) => {
          const area = workArea(state.desktop);
          const bounds = {
            x: Math.round(area.x + area.width * zone.x),
            y: Math.round(area.y + area.height * zone.y),
            width: Math.round(area.width * zone.w),
            height: Math.round(area.height * zone.h),
          };
          return {
            windows: state.windows.map((win) =>
              win.id === id
                ? {
                    ...win,
                    bounds,
                    restoreBounds: win.maximized || win.snap !== 'none' ? win.restoreBounds : win.bounds,
                    maximized: false,
                    snap: 'none' as SnapPosition,
                    snapZone: zone,
                    snapGroup: groupId ?? win.snapGroup,
                    z: state.zTop + 1,
                    minimized: false,
                  }
                : win,
            ),
            zTop: state.zTop + 1,
          };
        }),

      restoreSnapGroup: (groupId) =>
        set((state) => {
          let z = state.zTop;
          return {
            zTop: z + state.windows.filter((win) => win.snapGroup === groupId).length,
            windows: state.windows.map((win) =>
              win.snapGroup === groupId ? { ...win, minimized: false, z: ++z } : win,
            ),
          };
        }),

      setDesktopSize: (desktop) =>
        set((state) => ({
          desktop,
          windows: state.windows.map((win) =>
            win.maximized || win.snap !== 'none'
              ? {
                  ...win,
                  bounds: win.maximized ? workArea(desktop) : snapBounds(win.snap, desktop),
                }
              : { ...win, bounds: clampBounds(win.bounds, desktop) },
          ),
        })),

      openApp: (appId, props = {}, options = {}) => {
        const app = getApp(appId);
        if (!app) {
          console.warn('[Windows 12 Concept] Unknown app', appId);
          return null;
        }
        const state = get();

        if (!options.forceNew && app.singleton) {
          const existing = state.windows.find((win) => win.appId === appId);
          if (existing) {
            // Same file? just focus. Different file? reuse the window.
            const sameTarget = JSON.stringify(existing.props) === JSON.stringify(props);
            set({
              windows: state.windows.map((win) =>
                win.id === existing.id
                  ? { ...win, minimized: false, z: state.zTop + 1, props: sameTarget ? win.props : { ...win.props, ...props } }
                  : win,
              ),
              zTop: state.zTop + 1,
              showDesktop: false,
              activeVirtualDesktop: desktopOf(existing),
            });
            return existing.id;
          }
        }

        const id = uid('win');
        const desktop = state.desktop;
        const width = Math.min(app.defaultSize.width, desktop.width - 40);
        const height = Math.min(app.defaultSize.height, desktop.height - TASKBAR_HEIGHT - 40);
        const count = state.windows.filter((win) => win.appId === appId).length;
        const offset = (count % 6) * 32;
        const bounds = clampBounds(
          {
            x: Math.max(12, Math.round((desktop.width - width) / 2) - 120 + offset),
            y: Math.max(12, Math.round((desktop.height - TASKBAR_HEIGHT - height) / 2) - 40 + offset),
            width,
            height,
          },
          desktop,
        );

        const instance: WindowInstance = {
          virtualDesktop: state.activeVirtualDesktop,
          id,
          appId,
          title: options.title ?? app.name,
          bounds,
          restoreBounds: bounds,
          minimized: false,
          maximized: false,
          snap: 'none',
          z: state.zTop + 1,
          props,
          openedAt: Date.now(),
        };
        set({ windows: [...state.windows, instance], zTop: state.zTop + 1, showDesktop: false });
        return id;
      },

      closeWindow: (id) =>
        set((state) => ({
          windows: state.windows.filter((win) => win.id !== id),
          hiddenByShowDesktop: state.hiddenByShowDesktop.filter((wid) => wid !== id),
        })),

      closeAllWindows: () => set({ windows: [], showDesktop: false, hiddenByShowDesktop: [] }),

      minimize: (id) =>
        set((state) => ({
          windows: state.windows.map((win) => (win.id === id ? { ...win, minimized: true } : win)),
        })),

      restoreFromMinimize: (id) =>
        set((state) => ({
          windows: state.windows.map((win) => (win.id === id ? { ...win, minimized: false, z: state.zTop + 1 } : win)),
          zTop: state.zTop + 1,
          showDesktop: false,
        })),

      toggleMaximize: (id) => {
        const win = get().windows.find((w) => w.id === id);
        if (!win) return;
        if (win.maximized) get().restore(id);
        else get().maximize(id);
      },

      maximize: (id) =>
        set((state) => ({
          windows: state.windows.map((win) =>
            win.id === id
              ? { ...win, maximized: true, snap: 'none', restoreBounds: win.maximized ? win.restoreBounds : win.bounds, bounds: workArea(state.desktop), z: state.zTop + 1 }
              : win,
          ),
          zTop: state.zTop + 1,
        })),

      restore: (id) =>
        set((state) => ({
          windows: state.windows.map((win) =>
            win.id === id
              ? { ...win, maximized: false, snap: 'none', bounds: clampBounds(win.restoreBounds, state.desktop), z: state.zTop + 1 }
              : win,
          ),
          zTop: state.zTop + 1,
        })),

      focus: (id) =>
        set((state) => {
          const target = state.windows.find((win) => win.id === id);
          if (!target) return state;
          if (target.z === state.zTop && !target.minimized) return state;
          return {
            windows: state.windows.map((win) =>
              win.id === id ? { ...win, z: state.zTop + 1, minimized: false } : win,
            ),
            zTop: state.zTop + 1,
          };
        }),

      setBounds: (id, patch) =>
        set((state) => ({
          windows: state.windows.map((win) =>
            win.id === id
              ? { ...win, bounds: clampBounds({ ...win.bounds, ...patch }, state.desktop), maximized: false, snap: 'none' }
              : win,
          ),
        })),

      snapWindow: (id, position) =>
        set((state) => ({
          windows: state.windows.map((win) => {
            if (win.id !== id) return win;
            if (position === 'maximize') {
              return { ...win, maximized: true, snap: 'none', restoreBounds: win.bounds, bounds: workArea(state.desktop), z: state.zTop + 1 };
            }
            if (position === 'none') {
              return { ...win, maximized: false, snap: 'none', bounds: clampBounds(win.restoreBounds, state.desktop), z: state.zTop + 1 };
            }
            return {
              ...win,
              maximized: false,
              snap: position,
              restoreBounds: win.snap === 'none' && !win.maximized ? win.bounds : win.restoreBounds,
              bounds: snapBounds(position, state.desktop),
              z: state.zTop + 1,
            };
          }),
          zTop: state.zTop + 1,
          snapPreview: null,
        })),

      setSnapPreview: (preview) => set({ snapPreview: preview }),

      setWindowTitle: (id, title) =>
        set((state) => ({ windows: state.windows.map((win) => (win.id === id ? { ...win, title } : win)) })),

      setWindowProps: (id, props) =>
        set((state) => ({
          windows: state.windows.map((win) => (win.id === id ? { ...win, props: { ...win.props, ...props } } : win)),
        })),

      toggleShowDesktop: () =>
        set((state) => {
          if (state.showDesktop) {
            return {
              showDesktop: false,
              windows: state.windows.map((win) =>
                state.hiddenByShowDesktop.includes(win.id) ? { ...win, minimized: false } : win,
              ),
              hiddenByShowDesktop: [],
            };
          }
          const visible = windowsOnDesktop(state, state.activeVirtualDesktop)
            .filter((win) => !win.minimized)
            .map((win) => win.id);
          return {
            showDesktop: true,
            hiddenByShowDesktop: visible,
            windows: state.windows.map((win) => (visible.includes(win.id) ? { ...win, minimized: true } : win)),
          };
        }),

      cycle: (direction) => {
        const state = get();
        const candidates = windowsOnDesktop(state, state.activeVirtualDesktop).sort((a, b) => b.z - a.z);
        if (candidates.length === 0) return;
        if (!state.altTab.active) {
          set({ altTab: { active: true, index: candidates.length > 1 ? 1 : 0 } });
          return;
        }
        const next = (state.altTab.index + direction + candidates.length) % candidates.length;
        set({ altTab: { active: true, index: next } });
      },

      setAltTab: (active, index) =>
        set((state) => {
          if (!active) {
            const candidates = windowsOnDesktop(state, state.activeVirtualDesktop).sort((a, b) => b.z - a.z);
            const target = candidates[state.altTab.index];
            if (target) {
              return {
                altTab: { active: false, index: 0 },
                windows: state.windows.map((win) =>
                  win.id === target.id ? { ...win, minimized: false, z: state.zTop + 1 } : win,
                ),
                zTop: state.zTop + 1,
              };
            }
            return { altTab: { active: false, index: 0 } };
          }
          return { altTab: { active: true, index: index ?? state.altTab.index } };
        }),

      addVirtualDesktop: () => {
        const state = get();
        const id = `vd-${Date.now().toString(36)}`;
        const name = translateDesktopName(state.virtualDesktops.length + 1);
        set({ virtualDesktops: [...state.virtualDesktops, { id, name }], activeVirtualDesktop: id });
        return id;
      },

      removeVirtualDesktop: (id) =>
        set((state) => {
          if (state.virtualDesktops.length <= 1) return state;
          const index = state.virtualDesktops.findIndex((desktop) => desktop.id === id);
          if (index < 0) return state;
          const neighbour = state.virtualDesktops[index - 1] ?? state.virtualDesktops[index + 1];
          const windows = state.windows.map((win) =>
            desktopOf(win) === id ? { ...win, virtualDesktop: neighbour.id } : win,
          );
          const virtualDesktops = state.virtualDesktops.filter((desktop) => desktop.id !== id);
          return {
            windows,
            virtualDesktops,
            activeVirtualDesktop: state.activeVirtualDesktop === id ? neighbour.id : state.activeVirtualDesktop,
          };
        }),

      switchVirtualDesktop: (id) =>
        set((state) =>
          state.virtualDesktops.some((desktop) => desktop.id === id)
            ? { activeVirtualDesktop: id, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 } }
            : state,
        ),

      moveWindowToDesktop: (windowId, desktopId) =>
        set((state) => ({
          windows: state.windows.map((win) => (win.id === windowId ? { ...win, virtualDesktop: desktopId } : win)),
        })),

      togglePin: (appId) =>
        set((state) => ({
          pinnedApps: state.pinnedApps.includes(appId)
            ? state.pinnedApps.filter((id) => id !== appId)
            : [...state.pinnedApps, appId],
        })),

      endTask: (appId) => set((state) => ({ windows: state.windows.filter((win) => win.appId !== appId) })),

      windowsForApp: (appId) => get().windows.filter((win) => win.appId === appId),
    }),
    {
      name: 'win12-concept.windows',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        pinnedApps: state.pinnedApps,
        virtualDesktops: state.virtualDesktops,
        activeVirtualDesktop: state.activeVirtualDesktop,
        windows: state.windows.map((win) => ({ ...win, minimized: true, closing: false })),
        zTop: state.zTop,
      }),
      migrate: (persisted, version) => {
        const stored = (persisted ?? {}) as Partial<WindowState>;
        if (version < 2) {
          const pinned = stored.pinnedApps ?? [];
          if (!pinned.includes('vscode')) stored.pinnedApps = [...pinned, 'vscode'];
        }
        return stored;
      },
      merge: (persisted, current) => {
        const stored = persisted as Partial<WindowState> | undefined;
        if (!stored) return current;
        return { ...current, ...stored, showDesktop: false, hiddenByShowDesktop: [], altTab: { active: false, index: 0 } };
      },
    },
  ),
);

/* Selectors ---------------------------------------------------------------- */

/** Virtual desktop a window belongs to (legacy windows default to the first). */
export function desktopOf(win: WindowInstance): string {
  return win.virtualDesktop ?? 'vd-main';
}

function translateDesktopName(n: number): string {
  return `Desktop ${n}`;
}

export function windowsOnDesktop(state: WindowState, desktopId: string): WindowInstance[] {
  return state.windows.filter((win) => desktopOf(win) === desktopId);
}

export function selectActiveWindow(state: WindowState): WindowInstance | null {
  const visible = state.windows.filter((win) => !win.minimized && desktopOf(win) === state.activeVirtualDesktop);
  if (!visible.length) return null;
  return visible.reduce((top, win) => (win.z > top.z ? win : top), visible[0]);
}

export interface TaskbarAppGroup {
  appId: string;
  windows: WindowInstance[];
  pinned: boolean;
  active: boolean;
}

/**
 * Derived selectors handed to zustand must return a *stable* reference,
 * otherwise `useSyncExternalStore` re-renders forever ("getSnapshot should be
 * cached"). The grouping only depends on `windows`, `pinnedApps` and the active
 * window, so the previous result is reused while those references are unchanged.
 */
let taskbarCache: {
  windows: WindowInstance[];
  pinnedApps: string[];
  activeId: string | null;
  activeMinimized: boolean;
  result: TaskbarAppGroup[];
} | null = null;

export function selectTaskbarApps(state: WindowState): TaskbarAppGroup[] {
  const active = selectActiveWindow(state);
  const activeId = active?.id ?? null;
  const activeMinimized = active?.minimized ?? false;
  if (
    taskbarCache &&
    taskbarCache.windows === state.windows &&
    taskbarCache.pinnedApps === state.pinnedApps &&
    taskbarCache.activeId === activeId &&
    taskbarCache.activeMinimized === activeMinimized
  ) {
    return taskbarCache.result;
  }

  const order: string[] = [];
  const grouped = new Map<string, WindowInstance[]>();

  for (const appId of state.pinnedApps) {
    if (!grouped.has(appId)) {
      grouped.set(appId, []);
      order.push(appId);
    }
  }
  for (const win of state.windows) {
    if (desktopOf(win) !== state.activeVirtualDesktop) continue;
    const list = grouped.get(win.appId) ?? [];
    list.push(win);
    grouped.set(win.appId, list);
    if (!order.includes(win.appId)) order.push(win.appId);
  }

  const result = order
    .map((appId) => ({
      appId,
      windows: grouped.get(appId) ?? [],
      pinned: state.pinnedApps.includes(appId),
      active: activeId === appId && !activeMinimized,
    }))
    .filter((entry) => entry.windows.length > 0 || entry.pinned);

  taskbarCache = { windows: state.windows, pinnedApps: state.pinnedApps, activeId, activeMinimized, result };
  return result;
}
