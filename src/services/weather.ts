/**
 * Simulated weather for the taskbar widget.
 *
 * There is no network call and no real forecast: conditions are derived
 * deterministically from the calendar day, so the chip and the flyout always
 * agree and the same day always shows the same weather. The UI labels it as
 * simulated.
 */

export type WeatherCondition = 'sunny' | 'partly' | 'cloudy' | 'rain' | 'storm' | 'snow';

export interface WeatherDay {
  date: Date;
  condition: WeatherCondition;
  tempC: number;
  lowC: number;
  humidity: number;
  windKmh: number;
}

export interface WeatherReport {
  location: string;
  now: WeatherDay;
  forecast: WeatherDay[];
  generatedAt: number;
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CONDITIONS: WeatherCondition[] = ['sunny', 'partly', 'partly', 'cloudy', 'rain', 'storm', 'snow'];

function dayFor(date: Date, location: string): WeatherDay {
  const key = `${location}|${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  const rng = rngFrom(hashString(key));
  const month = date.getMonth();
  // Seasonal baseline for a temperate climate (cool winters, mild summers).
  const seasonal = 11 + 11 * Math.sin(((month - 3) / 12) * Math.PI * 2);
  const tempC = Math.round(seasonal + rng() * 8 - 2);
  const pool = CONDITIONS.filter((condition) => condition !== 'snow' || tempC <= 3);
  const condition = pool[Math.floor(rng() * pool.length)];
  return {
    date,
    condition,
    tempC,
    lowC: tempC - Math.round(3 + rng() * 5),
    humidity: Math.round(45 + rng() * 50),
    windKmh: Math.round(4 + rng() * 26),
  };
}

export function getWeather(location: string, now: number = Date.now()): WeatherReport {
  const forecast = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() + index);
    return dayFor(date, location);
  });
  return { location, now: forecast[0], forecast, generatedAt: now };
}

export function toFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}
