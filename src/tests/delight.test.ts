import { describe, expect, it } from 'vitest';
import { getWallpaper, pickAutoWallpaperId } from '../data/wallpapers';
import { applyTheme } from '../services/sound';
import { useSettingsStore } from '../stores/settingsStore';

describe('dynamic wallpaper', () => {
  it('picks a wallpaper per time of day', () => {
    expect(pickAutoWallpaperId(3)).toBe('midnight-grid');
    expect(pickAutoWallpaperId(7)).toBe('sunrise');
    expect(pickAutoWallpaperId(13)).toBe('flow-light');
    expect(pickAutoWallpaperId(19)).toBe('forest');
    expect(pickAutoWallpaperId(23)).toBe('midnight-grid');
  });

  it('resolves the auto id to a real wallpaper', () => {
    const morning = getWallpaper('auto', new Date(2026, 0, 1, 8, 0));
    expect(morning.id).toBe('sunrise');
    const night = getWallpaper('auto', new Date(2026, 0, 1, 23, 30));
    expect(night.id).toBe('midnight-grid');
  });
});

describe('sound themes', () => {
  const recipe = { freq: [440, 880], type: 'triangle' as OscillatorType, duration: 0.2, gain: 0.2 };

  it('reshapes recipes per theme', () => {
    expect(applyTheme(recipe, 'classic')).toEqual(recipe);
    const soft = applyTheme(recipe, 'soft');
    expect(soft.type).toBe('sine');
    expect(soft.gain).toBeCloseTo(0.14);
    expect(soft.duration).toBeCloseTo(0.27);
    expect(applyTheme(recipe, 'retro').type).toBe('square');
    expect(applyTheme(recipe, 'minimal').duration).toBeCloseTo(0.11);
  });

  it('defaults to the classic theme with idle settings present', () => {
    const settings = useSettingsStore.getState().settings;
    expect(settings.sound.theme).toBe('classic');
    expect(settings.idle).toEqual({ screensaver: true, screensaverMinutes: 5, lockMinutes: 0 });
  });
});
