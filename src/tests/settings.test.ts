import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, useSettingsStore } from '../stores/settingsStore';
import { translate } from '../i18n';
import { currentLocaleTag, formatCurrency, formatDate, formatNumber } from '../services/format';
import { getWallpaper, listWallpapers } from '../data/wallpapers';

const STORAGE_KEY = 'win12-concept.settings';

function store() {
  return useSettingsStore.getState();
}

beforeEach(() => {
  localStorage.clear();
  useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
});

describe('settings store', () => {
  it('starts from sane defaults', () => {
    const { settings } = store();
    expect(settings.display.brightness).toBe(100);
    expect(settings.display.nightLight).toBe(false);
    expect(settings.sound.volume).toBeGreaterThan(0);
    expect(settings.sound.muted).toBe(false);
    expect(settings.locale.language).toBe('en');
    expect(settings.storageQuotaMB).toBeGreaterThan(0);
    expect(settings.multitasking.snapEnabled).toBe(true);
  });

  it('merges partial section updates without dropping siblings', () => {
    store().setDisplay({ brightness: 30 });
    expect(store().settings.display.brightness).toBe(30);
    expect(store().settings.display.scale).toBe(defaultSettings.display.scale);

    store().setDisplay({ nightLightStrength: 70 });
    expect(store().settings.display.brightness).toBe(30);
    expect(store().settings.display.nightLightStrength).toBe(70);

    store().toggleNightLight();
    expect(store().settings.display.nightLight).toBe(true);
    store().toggleNightLight();
    expect(store().settings.display.nightLight).toBe(false);

    store().setSound({ muted: true });
    store().setSound({ volume: 42 });
    expect(store().settings.sound).toMatchObject({ muted: true, volume: 42 });
    expect(store().settings.sound.systemSounds).toBe(defaultSettings.sound.systemSounds);
  });

  it('lets airplane mode own the radios', () => {
    store().setNetwork({ wifiEnabled: true, connectedNetwork: 'Concept-5G' });
    expect(store().settings.network.status).toBe('connected');

    store().setNetwork({ airplaneMode: true });
    let network = store().settings.network;
    expect(network.airplaneMode).toBe(true);
    expect(network.wifiEnabled).toBe(false);
    expect(network.bluetoothEnabled).toBe(false);
    expect(network.status).toBe('disconnected');
    expect(network.connectedNetwork).toBeNull();

    // Turning Wi-Fi back on leaves airplane mode.
    store().setNetwork({ wifiEnabled: true });
    network = store().settings.network;
    expect(network.airplaneMode).toBe(false);
    expect(network.wifiEnabled).toBe(true);

    store().setNetwork({ wifiEnabled: false });
    network = store().settings.network;
    expect(network.status).toBe('disconnected');
    expect(network.connectedNetwork).toBeNull();
  });

  it('switches language together with the number system and week start', () => {
    store().setLanguage('fa');
    expect(store().settings.locale.language).toBe('fa');
    expect(store().settings.locale.numberSystem).toBe('arabext');
    expect(store().settings.locale.firstDayOfWeek).toBe(6);

    store().setLanguage('en');
    expect(store().settings.locale).toMatchObject({ language: 'en', numberSystem: 'latn', firstDayOfWeek: 1 });

    // Locale choices survive an explicit override.
    store().setLocale({ calendar: 'persian', currency: 'SEK' });
    expect(store().settings.locale).toMatchObject({ calendar: 'persian', currency: 'SEK', language: 'en' });
  });

  it('keeps appearance choices coherent', () => {
    store().setTheme('dark');
    store().setAccent('#22c55e');
    const wallpaper = listWallpapers()[2].id;
    store().setWallpaper(wallpaper);
    store().setLockWallpaper(listWallpapers()[0].id);
    store().setPersonalization({ taskbarPosition: 'top', autoHideTaskbar: true, transparency: false });

    const personalization = store().settings.personalization;
    expect(personalization.theme).toBe('dark');
    expect(personalization.accent).toBe('#22c55e');
    expect(personalization.wallpaperId).toBe(wallpaper);
    expect(getWallpaper(wallpaper)).toBeTruthy();
    expect(personalization.taskbarPosition).toBe('top');
    expect(personalization.autoHideTaskbar).toBe(true);
    expect(personalization.transparency).toBe(false);
  });

  it('stores default apps, startup apps and the storage quota', () => {
    store().setDefaultApp('doc', 'notepad');
    expect(store().settings.apps.defaultApps.doc).toBe('notepad');
    expect(store().settings.apps.defaultApps.sheet).toBe(defaultSettings.apps.defaultApps.sheet);

    store().setApps({ startupApps: ['clock', 'notes'], launchStartupOnSignIn: true });
    expect(store().settings.apps.startupApps).toEqual(['clock', 'notes']);
    expect(store().settings.apps.launchStartupOnSignIn).toBe(true);
    expect(store().settings.apps.defaultApps.doc).toBe('notepad');

    store().setQuota(128);
    expect(store().settings.storageQuotaMB).toBe(128);
  });

  it('applies deep patches and multitasking toggles', () => {
    store().patch({ display: { brightness: 55 }, locale: { currency: 'EUR' } });
    expect(store().settings.display.brightness).toBe(55);
    expect(store().settings.display.scale).toBe(defaultSettings.display.scale);
    expect(store().settings.locale.currency).toBe('EUR');
    expect(store().settings.locale.language).toBe('en');

    store().setMultitasking({ snapEnabled: false });
    expect(store().settings.multitasking).toMatchObject({ snapEnabled: false, snapAssist: defaultSettings.multitasking.snapAssist });
  });

  it('persists to localStorage and rehydrates the same values', async () => {
    store().setDisplay({ brightness: 30, nightLight: true });
    store().setSound({ muted: true, volume: 15 });
    store().setTheme('dark');
    store().setLanguage('fa');
    store().setQuota(64);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw!) as { state: { settings: typeof defaultSettings } };
    expect(saved.state.settings.display.brightness).toBe(30);
    expect(saved.state.settings.sound.muted).toBe(true);
    expect(saved.state.settings.locale.language).toBe('fa');

    // Simulate a reload: drop in-memory state, put the saved payload back, rehydrate.
    useSettingsStore.setState({ settings: defaultSettings });
    localStorage.setItem(STORAGE_KEY, raw!);
    await useSettingsStore.persist.rehydrate();
    const rehydrated = store().settings;
    expect(rehydrated.display).toMatchObject({ brightness: 30, nightLight: true });
    expect(rehydrated.sound).toMatchObject({ muted: true, volume: 15 });
    expect(rehydrated.personalization.theme).toBe('dark');
    expect(rehydrated.locale.language).toBe('fa');
    expect(rehydrated.storageQuotaMB).toBe(64);
  });

  it('resets back to the defaults', () => {
    store().setDisplay({ brightness: 10 });
    store().setTheme('dark');
    store().reset();
    expect(store().settings).toEqual(defaultSettings);
  });
});

describe('locale aware formatting', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.setState({ settings: defaultSettings, hydrated: true });
  });

  it('follows the configured language, digits and currency', () => {
    expect(currentLocaleTag()).toMatch(/^en-US-u-ca-gregory$/);
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 })).toBe('1,234.5');

    store().setLanguage('fa');
    expect(currentLocaleTag()).toMatch(/^fa/);
    expect(formatNumber(1234)).toBe('۱٬۲۳۴');

    store().setLocale({ currency: 'SEK' });
    const sek = formatCurrency(1500);
    expect(sek).toContain('SEK');
    expect(sek).toMatch(/۵۰۰/);

    store().setLanguage('en');
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatCurrency(10, 'USD')).toContain('$');
  });

  it('formats dates in both calendars', () => {
    const date = new Date(2026, 9, 27);
    expect(formatDate(date)).toMatch(/2026/);
    store().setLocale({ calendar: 'persian', language: 'fa' });
    expect(formatDate(date)).toMatch(/۱۴۰۵/);
    // The Gregorian calendar still renders Gregorian years in Persian digits.
    store().setLocale({ calendar: 'gregory' });
    expect(formatDate(date)).toMatch(/۲۰۲۶/);
    store().setLocale({ dateFormat: 'iso' });
    expect(formatDate(date)).toBe('2026-10-27');
  });

  it('translates with parameter interpolation and falls back to English', () => {
    expect(translate('en', 'acc.overdueAlert', { count: 3 })).toContain('3');
    expect(translate('fa', 'acc.overdueAlert', { count: 3 })).toContain('3');
    expect(translate('fa', 'common.save')).not.toBe('common.save');
    // Unknown keys fall back to the key itself rather than crashing.
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist');
    // Every Persian key exists for the English key set.
    expect(translate('fa', 'settings.aboutDisclaimer')).not.toBe('settings.aboutDisclaimer');
  });
});
