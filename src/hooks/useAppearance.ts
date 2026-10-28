import { useEffect } from 'react';
import { useSettingsStore, prefersReducedMotion, resolvedTheme } from '../stores/settingsStore';
import { useSystemStore } from '../stores/systemStore';

/**
 * Pushes settings into the DOM: theme class, direction, accent colour,
 * transparency, contrast, motion preferences and root font scaling.
 */
export function useAppearance(): void {
  const settings = useSettingsStore((state) => state.settings);
  const accessibility = useSystemStore((state) => state.accessibility);

  useEffect(() => {
    const root = document.documentElement;
    const dark = resolvedTheme(settings.personalization.theme) === 'dark';
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
  }, [settings.personalization.theme]);

  useEffect(() => {
    const root = document.documentElement;
    const language = settings.locale.language;
    root.lang = language;
    root.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [settings.locale.language]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.personalization.accent);
  }, [settings.personalization.accent]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('no-transparency', !settings.personalization.transparency);
    root.classList.toggle('high-contrast', accessibility.highContrast);
    root.classList.toggle('no-animations', !settings.display.animations);
    root.classList.toggle(
      'reduce-motion',
      settings.display.reduceMotion || (settings.display.animations && prefersReducedMotion()),
    );
  }, [
    settings.personalization.transparency,
    accessibility.highContrast,
    settings.display.animations,
    settings.display.reduceMotion,
  ]);

  useEffect(() => {
    const scale = (settings.display.scale / 100) * (accessibility.textSize / 100);
    const clamped = Math.min(1.6, Math.max(0.75, scale));
    document.documentElement.style.fontSize = `${(16 * clamped).toFixed(2)}px`;
  }, [settings.display.scale, accessibility.textSize]);
}

export { useClock } from './useUi';
