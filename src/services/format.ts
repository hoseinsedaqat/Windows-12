import { useSettingsStore } from '../stores/settingsStore';
import type { LocaleSettings } from '../types';

/** Locale-aware formatting helpers. All read the live locale settings so no reload is needed. */

export function localeTag(locale: LocaleSettings): string {
  const base = locale.language === 'fa' ? 'fa-IR' : 'en-US';
  // BCP-47 extensions must all live inside a single `-u-` sequence, in key order.
  // The calendar is always explicit: `fa-IR` defaults to the Persian calendar, so
  // choosing Gregorian while using Persian would otherwise be ignored.
  const extensions: string[] = [locale.calendar === 'persian' ? 'ca-persian' : 'ca-gregory'];
  if (locale.numberSystem === 'arabext') extensions.push('nu-arabext');
  return `${base}-u-${extensions.join('-')}`;
}

export function currentLocaleTag(): string {
  return localeTag(useSettingsStore.getState().settings.locale);
}

/**
 * ISO 8601 (`YYYY-MM-DD`) is a fixed textual format, so it is rendered through
 * `en-CA` while still honouring the chosen calendar and digit system.
 */
export function isoLocaleTag(locale: LocaleSettings): string {
  const extensions = [locale.calendar === 'persian' ? 'ca-persian' : 'ca-gregory'];
  if (locale.numberSystem === 'arabext') extensions.push('nu-arabext');
  return `en-CA-u-${extensions.join('-')}`;
}

export function formatNumber(value: number, opts?: Intl.NumberFormatOptions & { locale?: string }): string {
  const { locale, ...rest } = opts ?? {};
  try {
    return new Intl.NumberFormat(locale ?? currentLocaleTag(), rest).format(value);
  } catch {
    return String(value);
  }
}

export function formatCurrency(value: number, currency?: string): string {
  const locale = useSettingsStore.getState().settings.locale;
  const code = currency ?? locale.currency ?? 'USD';
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

/** Money without a currency symbol — used inside dense tables. */
export function formatMoney(value: number): string {
  return formatNumber(Math.round(value * 100) / 100, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatDate(value: number | string | Date, withTime = false): string {
  const locale = useSettingsStore.getState().settings.locale;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const iso = locale.dateFormat === 'iso';
  const options: Intl.DateTimeFormatOptions = iso
    ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  if (withTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    if (iso) options.hour12 = false;
  }
  try {
    return new Intl.DateTimeFormat(iso ? isoLocaleTag(locale) : localeTag(locale), options).format(date);
  } catch {
    return date.toISOString().slice(0, withTime ? 16 : 10);
  }
}

export function formatTime(value: number | Date = new Date()): string {
  const locale = useSettingsStore.getState().settings.locale;
  try {
    return new Intl.DateTimeFormat(localeTag(locale), { hour: '2-digit', minute: '2-digit' }).format(value);
  } catch {
    return new Date(value).toTimeString().slice(0, 5);
  }
}

export function formatLongDate(value: number | Date = new Date()): string {
  const locale = useSettingsStore.getState().settings.locale;
  try {
    return new Intl.DateTimeFormat(localeTag(locale), {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(value instanceof Date ? value : new Date(value));
  } catch {
    return String(value);
  }
}

export function weekdayNames(style: 'long' | 'short' = 'short'): string[] {
  const locale = useSettingsStore.getState().settings.locale;
  const firstDay = locale.firstDayOfWeek;
  const names: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const dayIndex = (firstDay + i) % 7;
    // 2024-01-07 is a Sunday.
    const date = new Date(Date.UTC(2024, 0, 7 + dayIndex));
    try {
      names.push(new Intl.DateTimeFormat(localeTag(locale), { weekday: style, timeZone: 'UTC' }).format(date));
    } catch {
      names.push(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex]);
    }
  }
  return names;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return formatDate(timestamp);
}

export function isoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}
