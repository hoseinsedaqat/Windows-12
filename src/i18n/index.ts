import { useSettingsStore } from '../stores/settingsStore';
import { en, type TranslationKey, type TranslationDictionary } from './en';
import { fa } from './fa';
import { de } from './de';

export type Lang = 'en' | 'fa' | 'de';

export const dictionaries: Record<Lang, Partial<TranslationDictionary>> = { en, fa, de };

export type { TranslationKey };

/** Translate a key, interpolating `{param}` placeholders. Falls back to English then the key. */
export function translate(
  lang: Lang,
  key: TranslationKey | string,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang] ?? en;
  let value = (dict as Record<string, string>)[key] ?? (en as Record<string, string>)[key] ?? key;
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}

export interface UseTranslation {
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
  lang: Lang;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
  bcp47: string;
}

/** React hook bound to the persisted language setting — switching language needs no reload. */
export function useT(): UseTranslation {
  const language = useSettingsStore((s) => s.settings.locale.language);
  const dir: 'ltr' | 'rtl' = language === 'fa' ? 'rtl' : 'ltr';
  return {
    lang: language,
    dir,
    isRTL: dir === 'rtl',
    bcp47: language === 'fa' ? 'fa-IR' : language === 'de' ? 'de-DE' : 'en-US',
    t: (key, params) => translate(language, key, params),
  };
}

/** Non-React access (used by core services such as the notification manager). */
export function currentLang(): Lang {
  return useSettingsStore.getState().settings.locale.language;
}

export function t(key: TranslationKey | string, params?: Record<string, string | number>): string {
  return translate(currentLang(), key, params);
}
