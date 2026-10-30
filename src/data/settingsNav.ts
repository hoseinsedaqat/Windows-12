import type { TranslationKey } from '../i18n/en';

/**
 * Settings navigation model — shared by the Settings app, Start search and the
 * global search panel so a search hit can jump straight to the right page.
 */

export interface SettingsSection {
  id: string;
  group: string;
  labelKey: TranslationKey;
  keywords: string[];
  /** True when the page only simulates the experience. */
  simulated?: boolean;
}

export interface SettingsGroup {
  id: string;
  labelKey: TranslationKey;
  icon: string;
  sections: SettingsSection[];
}

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'system',
    labelKey: 'settings.system',
    icon: 'Monitor',
    sections: [
      { id: 'display', group: 'system', labelKey: 'settings.display', keywords: ['brightness', 'night light', 'scale', 'resolution', 'روشنایی', 'نمایش'] },
      { id: 'sound', group: 'system', labelKey: 'settings.sound', keywords: ['volume', 'mute', 'audio', 'صدا', 'بلندی'] },
      { id: 'notifications', group: 'system', labelKey: 'settings.notifications', keywords: ['notifications', 'toast', 'اعلان'] },
      { id: 'focus', group: 'system', labelKey: 'settings.focus', keywords: ['focus', 'do not disturb', 'تمرکز'] },
      { id: 'power', group: 'system', labelKey: 'settings.power', keywords: ['power', 'boot', 'battery', 'shutdown', 'نیرو', 'باتری'] },
      { id: 'storage', group: 'system', labelKey: 'settings.storage', keywords: ['storage', 'disk', 'space', 'فضا', 'حافظه'] },
      { id: 'multitasking', group: 'system', labelKey: 'settings.multitasking', keywords: ['snap', 'alt tab', 'multitasking', 'پنجره'] },
      { id: 'backup', group: 'system', labelKey: 'settings.backup', keywords: ['backup', 'restore', 'export', 'import', 'win12', 'پشتیبان', 'بازیابی'] },
      { id: 'about', group: 'system', labelKey: 'settings.about', keywords: ['about', 'version', 'device name', 'درباره', 'نگارش'] },
    ],
  },
  {
    id: 'devices',
    labelKey: 'settings.devices',
    icon: 'Mouse',
    sections: [
      { id: 'bluetooth', group: 'devices', labelKey: 'quick.bluetooth', keywords: ['bluetooth', 'pair', 'بلوتوث'], simulated: true },
      { id: 'devices', group: 'devices', labelKey: 'settings.devices', keywords: ['devices', 'usb', 'دستگاه'], simulated: true },
      { id: 'mouse', group: 'devices', labelKey: 'settings.devices', keywords: ['mouse', 'pointer', 'cursor', 'ماوس'], simulated: true },
      { id: 'keyboard', group: 'devices', labelKey: 'settings.keyboard', keywords: ['keyboard', 'shortcuts', 'صفحه کلید', 'میانبر'] },
      { id: 'printers', group: 'devices', labelKey: 'settings.devices', keywords: ['printer', 'scanner', 'چاپگر'], simulated: true },
    ],
  },
  {
    id: 'network',
    labelKey: 'settings.network',
    icon: 'Wifi',
    sections: [
      { id: 'wifi', group: 'network', labelKey: 'quick.wifi', keywords: ['wifi', 'wireless', 'network', 'وای فای', 'شبکه'], simulated: true },
      { id: 'ethernet', group: 'network', labelKey: 'settings.network', keywords: ['ethernet', 'cable', 'کابل'], simulated: true },
      { id: 'vpn', group: 'network', labelKey: 'settings.network', keywords: ['vpn'], simulated: true },
      { id: 'data-usage', group: 'network', labelKey: 'settings.network', keywords: ['data usage', 'مصرف داده'], simulated: true },
      { id: 'proxy', group: 'network', labelKey: 'settings.network', keywords: ['proxy'], simulated: true },
    ],
  },
  {
    id: 'personalization',
    labelKey: 'settings.personalization',
    icon: 'Palette',
    sections: [
      { id: 'background', group: 'personalization', labelKey: 'settings.background', keywords: ['wallpaper', 'background', 'تصویر پس زمینه'] },
      { id: 'colors', group: 'personalization', labelKey: 'settings.colors', keywords: ['accent', 'dark mode', 'رنگ', 'تاریک'] },
      { id: 'themes', group: 'personalization', labelKey: 'settings.themes', keywords: ['theme', 'پوسته'] },
      { id: 'lockscreen', group: 'personalization', labelKey: 'settings.lockScreen', keywords: ['lock screen', 'صفحه قفل'] },
      { id: 'start', group: 'personalization', labelKey: 'settings.startSettings', keywords: ['start menu', 'منوی شروع'] },
      { id: 'taskbar', group: 'personalization', labelKey: 'settings.taskbarSettings', keywords: ['taskbar', 'نوار وظیفه'] },
      { id: 'fonts', group: 'personalization', labelKey: 'settings.fonts', keywords: ['font', 'text size', 'فونت'] },
    ],
  },
  {
    id: 'apps',
    labelKey: 'settings.apps',
    icon: 'Grid',
    sections: [
      { id: 'installed', group: 'apps', labelKey: 'settings.installedApps', keywords: ['installed apps', 'برنامه های نصب شده'] },
      { id: 'default-apps', group: 'apps', labelKey: 'settings.defaultApps', keywords: ['default apps', 'open with', 'برنامه پیش فرض'] },
      { id: 'startup', group: 'apps', labelKey: 'settings.startupApps', keywords: ['startup', 'شروع خودکار'] },
      { id: 'app-management', group: 'apps', labelKey: 'settings.appManagement', keywords: ['app management', 'مدیریت برنامه'] },
    ],
  },
  {
    id: 'accounts',
    labelKey: 'settings.accounts',
    icon: 'User',
    sections: [
      { id: 'profile', group: 'accounts', labelKey: 'settings.profile', keywords: ['profile', 'account', 'name', 'avatar', 'حساب', 'پروفایل'] },
      { id: 'signin', group: 'accounts', labelKey: 'settings.signInOptions', keywords: ['password', 'sign in', 'auto', 'رمز', 'ورود'] },
      { id: 'other-users', group: 'accounts', labelKey: 'settings.otherUsers', keywords: ['other users', 'کاربران دیگر'], simulated: true },
      { id: 'account-info', group: 'accounts', labelKey: 'settings.accountInfo', keywords: ['account info', 'اطلاعات حساب'] },
    ],
  },
  {
    id: 'timelang',
    labelKey: 'settings.timeLang',
    icon: 'Globe',
    sections: [
      { id: 'datetime', group: 'timelang', labelKey: 'settings.dateAndTime', keywords: ['date', 'time', 'timezone', 'تاریخ', 'ساعت'] },
      { id: 'language', group: 'timelang', labelKey: 'settings.languageRegion', keywords: ['language', 'persian', 'english', 'rtl', 'زبان', 'فارسی'] },
      { id: 'keyboard-layout', group: 'timelang', labelKey: 'settings.keyboard', keywords: ['keyboard layout', 'چیدمان صفحه کلید'] },
      { id: 'date-format', group: 'timelang', labelKey: 'settings.dateFormat', keywords: ['calendar', 'jalali', 'persian', 'numbers', 'تقویم', 'شمسی'] },
    ],
  },
  {
    id: 'privacy',
    labelKey: 'settings.privacy',
    icon: 'Shield',
    sections: [
      { id: 'privacy-dashboard', group: 'privacy', labelKey: 'settings.privacyDashboard', keywords: ['privacy', 'حریم خصوصی'] },
      { id: 'permissions', group: 'privacy', labelKey: 'settings.permissions', keywords: ['permissions', 'camera', 'microphone', 'location', 'مجوز'] },
      { id: 'activity', group: 'privacy', labelKey: 'settings.activityHistory', keywords: ['activity history', 'تاریخچه فعالیت'] },
      { id: 'security', group: 'privacy', labelKey: 'settings.securityStatus', keywords: ['security', 'virus', 'امنیت'], simulated: true },
    ],
  },
  {
    id: 'update',
    labelKey: 'settings.update',
    icon: 'RefreshCw',
    sections: [
      { id: 'windows-update', group: 'update', labelKey: 'settings.update', keywords: ['update', 'patch', 'به روز رسانی'], simulated: true },
    ],
  },
];

export const ALL_SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_GROUPS.flatMap((group) => group.sections);

export function findSection(id: string): SettingsSection | undefined {
  return ALL_SETTINGS_SECTIONS.find((section) => section.id === id);
}

export function sectionLabelKey(section: SettingsSection): TranslationKey {
  return section.labelKey;
}
