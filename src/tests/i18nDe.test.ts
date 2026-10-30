import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { en } from '../i18n/en';
import { translate } from '../i18n';

describe('German locale', () => {
  it('ships a substantial dictionary with valid keys', () => {
    expect(Object.keys(de).length).toBeGreaterThanOrEqual(250);
    for (const key of Object.keys(de)) {
      expect(en).toHaveProperty(key);
    }
  });

  it('translates shell keys into German', () => {
    expect(translate('de', 'common.cancel')).toBe('Abbrechen');
    expect(translate('de', 'start.shutdown')).toBe('Herunterfahren');
    expect(translate('de', 'window.snapLayouts')).toBe('Snap-Layouts');
  });

  it('falls back to English for untranslated keys and interpolates params', () => {
    expect(translate('de', 'excel.cf')).toBe((en as Record<string, string>)['excel.cf']);
    expect(translate('de', 'weather.feels', { temp: 21 })).toBe('Gefühlt 21°');
  });
});
