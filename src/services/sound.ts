import { useSettingsStore } from '../stores/settingsStore';

/**
 * Simulated system sounds.
 *
 * A web page cannot change the real device volume, so the "volume" and "mute"
 * settings only scale these synthesised UI sounds. Everything is generated with
 * the WebAudio API — no audio files, no autoplay surprises.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!context) context = new Ctor();
    if (context.state === 'suspended') void context.resume();
    return context;
  } catch {
    return null;
  }
}

export type SoundName =
  | 'click'
  | 'open'
  | 'close'
  | 'minimize'
  | 'maximize'
  | 'notify'
  | 'error'
  | 'startup'
  | 'shutdown'
  | 'snap'
  | 'type';

import type { SoundTheme } from '../types';

interface ThemeMod {
  type?: OscillatorType;
  gain: number;
  duration: number;
}

const THEME_MODS: Record<SoundTheme, ThemeMod> = {
  classic: { gain: 1, duration: 1 },
  soft: { type: 'sine', gain: 0.7, duration: 1.35 },
  retro: { type: 'square', gain: 0.45, duration: 0.75 },
  minimal: { gain: 0.5, duration: 0.55 },
};

/** Pure: reshapes a sound recipe for the selected theme. */
export function applyTheme(
  recipe: { freq: number[]; type: OscillatorType; duration: number; gain: number },
  theme: SoundTheme,
): { freq: number[]; type: OscillatorType; duration: number; gain: number } {
  const mod = THEME_MODS[theme] ?? THEME_MODS.classic;
  return {
    freq: recipe.freq,
    type: mod.type ?? recipe.type,
    duration: recipe.duration * mod.duration,
    gain: recipe.gain * mod.gain,
  };
}

const RECIPES: Record<SoundName, { freq: number[]; type: OscillatorType; duration: number; gain: number }> = {
  click: { freq: [880], type: 'sine', duration: 0.05, gain: 0.12 },
  open: { freq: [523.25, 784], type: 'sine', duration: 0.18, gain: 0.16 },
  close: { freq: [660, 440], type: 'sine', duration: 0.16, gain: 0.14 },
  minimize: { freq: [700, 420], type: 'triangle', duration: 0.14, gain: 0.12 },
  maximize: { freq: [420, 700], type: 'triangle', duration: 0.16, gain: 0.12 },
  notify: { freq: [880, 1174.66], type: 'sine', duration: 0.28, gain: 0.18 },
  error: { freq: [320, 220], type: 'square', duration: 0.24, gain: 0.1 },
  startup: { freq: [392, 523.25, 659.25, 783.99], type: 'sine', duration: 0.9, gain: 0.2 },
  shutdown: { freq: [659.25, 523.25, 392, 261.63], type: 'sine', duration: 0.9, gain: 0.18 },
  snap: { freq: [1046.5], type: 'sine', duration: 0.07, gain: 0.12 },
  type: { freq: [1200], type: 'sine', duration: 0.02, gain: 0.04 },
};

export function playSound(name: SoundName): void {
  const { volume, muted, systemSounds } = useSettingsStore.getState().settings.sound;
  if (!systemSounds || muted || volume <= 0) return;
  const ctx = getContext();
  if (!ctx) return;
  const rawRecipe = RECIPES[name];
  if (!rawRecipe) return;
  const recipe = applyTheme(rawRecipe, useSettingsStore.getState().settings.sound.theme ?? 'classic');
  const scale = volume / 100;

  // Audio is decoration: a blocked or unsupported audio graph must never break
  // the action that triggered the sound (deleting a file, opening a window, ...).
  try {
  const now = ctx.currentTime;
  const step = recipe.duration / recipe.freq.length;

  recipe.freq.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = recipe.type;
    osc.frequency.setValueAtTime(freq, now + index * step);
    gain.gain.setValueAtTime(0.0001, now + index * step);
    gain.gain.exponentialRampToValueAtTime(recipe.gain * scale, now + index * step + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * step + step);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + index * step);
    osc.stop(now + index * step + step + 0.02);
  });
  } catch {
    context = null;
  }
}

/** Used by the Settings → Sound "test sound" button. */
export function playTestSound(): boolean {
  const ctx = getContext();
  if (!ctx) return false;
  playSound('notify');
  return true;
}

export function audioSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
}
