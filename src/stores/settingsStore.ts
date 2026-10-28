import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  AppsSettings,
  DisplaySettings,
  LanguageCode,
  LocaleSettings,
  MultitaskingSettings,
  NetworkSettings,
  PersonalizationSettings,
  PowerSettings,
  PrivacySettings,
  SoundSettings,
  SystemSettings,
  ThemeMode,
} from '../types';

export const ACCENTS = [
  '#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308',
  '#f97316', '#ef4444', '#ec4899', '#a855f7', '#8b5cf6', '#6366f1',
];

export const defaultSettings: SystemSettings = {
  display: {
    brightness: 100,
    nightLight: false,
    nightLightStrength: 35,
    scale: 100,
    reduceMotion: false,
    animations: true,
  },
  sound: {
    volume: 45,
    muted: false,
    systemSounds: true,
  },
  network: {
    wifiEnabled: true,
    airplaneMode: false,
    bluetoothEnabled: false,
    connectedNetwork: 'Concept-Home-5G',
    status: 'connected',
  },
  personalization: {
    wallpaperId: 'aurora-mesh',
    lockWallpaperId: 'bloom-dark',
    theme: 'dark',
    accent: '#2563eb',
    transparency: true,
    taskbarPosition: 'bottom',
    taskbarAlignment: 'center',
    taskbarIconSize: 'medium',
    autoHideTaskbar: false,
    desktopIconSize: 'medium',
    desktopIconsVisible: true,
    desktopIconLayout: 'free',
  },
  locale: {
    language: 'en',
    calendar: 'gregory',
    numberSystem: 'latn',
    currency: 'USD',
    firstDayOfWeek: 1,
    dateFormat: 'auto',
  },
  power: {
    showBootAnimation: true,
    bootDuration: 'normal',
    screenTimeoutMinutes: 15,
    batterySaver: false,
  },
  privacy: {
    notificationsEnabled: true,
    focusAssist: false,
    activityHistory: true,
    locationEnabled: false,
    cameraEnabled: false,
    microphoneEnabled: false,
    analyticsEnabled: false,
  },
  apps: {
    defaultApps: {},
    startupApps: ['explorer'],
    launchStartupOnSignIn: false,
  },
  multitasking: {
    snapEnabled: true,
    snapAssist: true,
    altTabShowsTabs: false,
    desktopGrouping: true,
  },
  storageQuotaMB: 512,
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function mergeSection<T extends object>(current: T, patch: DeepPartial<T>): T {
  const out = { ...current } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    const existing = out[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object') {
      out[key] = { ...(existing as object), ...(value as object) };
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export interface SettingsState {
  settings: SystemSettings;
  hydrated: boolean;
  setDisplay: (patch: Partial<DisplaySettings>) => void;
  setSound: (patch: Partial<SoundSettings>) => void;
  setNetwork: (patch: Partial<NetworkSettings>) => void;
  setPersonalization: (patch: Partial<PersonalizationSettings>) => void;
  setLocale: (patch: Partial<LocaleSettings>) => void;
  setPower: (patch: Partial<PowerSettings>) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
  setApps: (patch: Partial<AppsSettings>) => void;
  setMultitasking: (patch: Partial<MultitaskingSettings>) => void;
  setDefaultApp: (kind: string, appId: string) => void;
  setLanguage: (language: LanguageCode) => void;
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: string) => void;
  setWallpaper: (wallpaperId: string) => void;
  setLockWallpaper: (wallpaperId: string) => void;
  toggleNightLight: () => void;
  setQuota: (mb: number) => void;
  patch: (patch: DeepPartial<SystemSettings>) => void;
  reset: () => void;
  markHydrated: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      hydrated: false,
      setDisplay: (patch) => set((s) => ({ settings: { ...s.settings, display: mergeSection(s.settings.display, patch) } })),
      setSound: (patch) => set((s) => ({ settings: { ...s.settings, sound: mergeSection(s.settings.sound, patch) } })),
      setNetwork: (patch) =>
        set((s) => {
          const network = mergeSection(s.settings.network, patch);
          // Airplane mode owns the radios; turning Wi-Fi on leaves airplane mode.
          if (patch.wifiEnabled === true) network.airplaneMode = false;
          if (patch.bluetoothEnabled === true) network.airplaneMode = false;
          if (network.airplaneMode) {
            network.wifiEnabled = false;
            network.bluetoothEnabled = false;
            network.status = 'disconnected';
            network.connectedNetwork = null;
          } else if (!network.wifiEnabled) {
            network.status = 'disconnected';
            network.connectedNetwork = null;
          } else if (network.status === 'disconnected') {
            network.status = 'connected';
          }
          return { settings: { ...s.settings, network } };
        }),
      setPersonalization: (patch) =>
        set((s) => ({ settings: { ...s.settings, personalization: mergeSection(s.settings.personalization, patch) } })),
      setLocale: (patch) => set((s) => ({ settings: { ...s.settings, locale: mergeSection(s.settings.locale, patch) } })),
      setPower: (patch) => set((s) => ({ settings: { ...s.settings, power: mergeSection(s.settings.power, patch) } })),
      setPrivacy: (patch) => set((s) => ({ settings: { ...s.settings, privacy: mergeSection(s.settings.privacy, patch) } })),
      setApps: (patch) => set((s) => ({ settings: { ...s.settings, apps: mergeSection(s.settings.apps, patch) } })),
      setMultitasking: (patch) =>
        set((s) => ({ settings: { ...s.settings, multitasking: mergeSection(s.settings.multitasking, patch) } })),
      setDefaultApp: (kind, appId) =>
        set((s) => ({
          settings: { ...s.settings, apps: { ...s.settings.apps, defaultApps: { ...s.settings.apps.defaultApps, [kind]: appId } } },
        })),
      setLanguage: (language) =>
        set((s) => ({
          settings: {
            ...s.settings,
            locale: {
              ...s.settings.locale,
              language,
              numberSystem: language === 'fa' ? 'arabext' : 'latn',
              firstDayOfWeek: language === 'fa' ? 6 : 1,
            },
          },
        })),
      setTheme: (theme) => set((s) => ({ settings: { ...s.settings, personalization: { ...s.settings.personalization, theme } } })),
      setAccent: (accent) => set((s) => ({ settings: { ...s.settings, personalization: { ...s.settings.personalization, accent } } })),
      setWallpaper: (wallpaperId) =>
        set((s) => ({ settings: { ...s.settings, personalization: { ...s.settings.personalization, wallpaperId } } })),
      setLockWallpaper: (lockWallpaperId) =>
        set((s) => ({ settings: { ...s.settings, personalization: { ...s.settings.personalization, lockWallpaperId } } })),
      toggleNightLight: () =>
        set((s) => ({ settings: { ...s.settings, display: { ...s.settings.display, nightLight: !s.settings.display.nightLight } } })),
      setQuota: (mb) => set((s) => ({ settings: { ...s.settings, storageQuotaMB: mb } })),
      patch: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            ...(patch.display ? { display: mergeSection(s.settings.display, patch.display) } : {}),
            ...(patch.sound ? { sound: mergeSection(s.settings.sound, patch.sound) } : {}),
            ...(patch.network ? { network: mergeSection(s.settings.network, patch.network) } : {}),
            ...(patch.personalization ? { personalization: mergeSection(s.settings.personalization, patch.personalization) } : {}),
            ...(patch.locale ? { locale: mergeSection(s.settings.locale, patch.locale) } : {}),
            ...(patch.power ? { power: mergeSection(s.settings.power, patch.power) } : {}),
            ...(patch.privacy ? { privacy: mergeSection(s.settings.privacy, patch.privacy) } : {}),
            ...(patch.apps ? { apps: mergeSection(s.settings.apps, patch.apps) } : {}),
            ...(patch.multitasking ? { multitasking: mergeSection(s.settings.multitasking, patch.multitasking) } : {}),
            ...(patch.storageQuotaMB !== undefined ? { storageQuotaMB: patch.storageQuotaMB } : {}),
          },
        })),
      reset: () => set({ settings: defaultSettings }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'win12-concept.settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ settings: state.settings }),
      merge: (persisted, current) => {
        const stored = (persisted as { settings?: DeepPartial<SystemSettings> } | undefined)?.settings;
        if (!stored) return current;
        return { ...current, settings: { ...defaultSettings, ...stored } as SystemSettings };
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.markHydrated();
        else useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);

/* Convenience selectors ---------------------------------------------------- */

export function selectTheme(state: SettingsState): ThemeMode {
  return state.settings.personalization.theme;
}

export function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolvedTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'auto') return prefersDark() ? 'dark' : 'light';
  return theme;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
