/**
 * Wallpapers for the simulator.
 *
 * Everything is generated as inline SVG so the build ships no binary assets and
 * works fully offline. Each entry exposes both a `url` (data URI) and a CSS
 * `background` fallback.
 */

export interface Wallpaper {
  id: string;
  name: string;
  /** Dark wallpapers pair better with light taskbar text. */
  tone: 'light' | 'dark';
  url: string;
  accent: string;
  category: 'concept' | 'gradient' | 'abstract' | 'solid' | 'custom';
}

function svgUrl(svg: string): string {
  // encodeURIComponent leaves ( ) ' untouched, but those characters break an
  // *unquoted* CSS url(...) — thumbnails use background-image, so encode them too.
  const encoded = encodeURIComponent(svg.replace(/\s{2,}/g, ' ').trim())
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/'/g, '%27');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

const shell = (inner: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;

const auroraMesh = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="url(#g1)"/>
     <g filter="url(#blur)" opacity="0.85">
       <ellipse cx="420" cy="300" rx="520" ry="380" fill="#3b82f6"/>
       <ellipse cx="1420" cy="260" rx="480" ry="360" fill="#8b5cf6"/>
       <ellipse cx="1180" cy="820" rx="620" ry="420" fill="#06b6d4"/>
       <ellipse cx="320" cy="900" rx="420" ry="320" fill="#2563eb"/>
     </g>
     <g opacity="0.35" fill="none" stroke="#ffffff" stroke-width="1.5">
       <path d="M-50 780 C 380 640, 700 900, 1120 740 S 1800 560, 2000 700"/>
       <path d="M-50 860 C 420 720, 760 980, 1180 820 S 1820 640, 2000 780"/>
     </g>`,
    `<linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stop-color="#050b1f"/><stop offset="55%" stop-color="#0a1636"/><stop offset="100%" stop-color="#03060f"/>
     </linearGradient>
     <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="120"/></filter>`,
  ),
);

const bloomDark = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="#070b18"/>
     <g filter="url(#b2)">
       <circle cx="960" cy="540" r="360" fill="#1d4ed8" opacity="0.55"/>
       <circle cx="700" cy="420" r="260" fill="#0ea5e9" opacity="0.4"/>
       <circle cx="1240" cy="660" r="300" fill="#7c3aed" opacity="0.42"/>
     </g>
     <g opacity="0.25">
       ${Array.from({ length: 44 })
         .map((_, i) => {
           const x = (i * 137.5) % 1920;
           const y = (i * 89.3) % 1080;
           const r = (i % 5) * 0.5 + 0.6;
           return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#e0f2fe"/>`;
         })
         .join('')}
     </g>`,
    `<filter id="b2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="90"/></filter>`,
  ),
);

const sunrise = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="url(#g3)"/>
     <g filter="url(#b3)" opacity="0.9">
       <ellipse cx="1500" cy="300" rx="420" ry="300" fill="#fb923c"/>
       <ellipse cx="500" cy="820" rx="520" ry="300" fill="#f472b6"/>
       <ellipse cx="1100" cy="620" rx="600" ry="240" fill="#fbbf24"/>
     </g>`,
    `<linearGradient id="g3" x1="0" y1="0" x2="0.4" y2="1">
       <stop offset="0%" stop-color="#1e1b4b"/><stop offset="60%" stop-color="#7c2d12"/><stop offset="100%" stop-color="#fde68a"/>
     </linearGradient>
     <filter id="b3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="110"/></filter>`,
  ),
);

const midnightGrid = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="#05070f"/>
     <g stroke="#1e3a8a" stroke-width="1" opacity="0.55">
       ${Array.from({ length: 25 })
         .map((_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="1080"/>`)
         .join('')}
       ${Array.from({ length: 15 })
         .map((_, i) => `<line x1="0" y1="${i * 80}" x2="1920" y2="${i * 80}"/>`)
         .join('')}
     </g>
     <g filter="url(#b4)" opacity="0.7">
       <circle cx="960" cy="480" r="300" fill="#2563eb"/>
       <circle cx="380" cy="880" r="220" fill="#0891b2"/>
     </g>`,
    `<filter id="b4" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="100"/></filter>`,
  ),
);

const flowLight = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="url(#g5)"/>
     <g filter="url(#b5)" opacity="0.75">
       <ellipse cx="500" cy="240" rx="480" ry="300" fill="#93c5fd"/>
       <ellipse cx="1500" cy="760" rx="520" ry="340" fill="#c4b5fd"/>
       <ellipse cx="1100" cy="220" rx="360" ry="240" fill="#a5f3fc"/>
     </g>`,
    `<linearGradient id="g5" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#dbeafe"/>
     </linearGradient>
     <filter id="b5" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="120"/></filter>`,
  ),
);

const conceptHero = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="#020617"/>
     <g opacity="0.9">
       <rect x="760" y="330" width="180" height="180" rx="14" fill="#60a5fa" opacity="0.95"/>
       <rect x="960" y="330" width="180" height="180" rx="14" fill="#38bdf8" opacity="0.85"/>
       <rect x="760" y="530" width="180" height="180" rx="14" fill="#818cf8" opacity="0.8"/>
       <rect x="960" y="530" width="180" height="180" rx="14" fill="#a78bfa" opacity="0.9"/>
     </g>
     <g filter="url(#b6)" opacity="0.55">
       <ellipse cx="960" cy="540" rx="620" ry="360" fill="#1d4ed8"/>
     </g>`,
    `<filter id="b6" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="130"/></filter>`,
  ),
);

const forest = svgUrl(
  shell(
    `<rect width="1920" height="1080" fill="url(#g7)"/>
     <g filter="url(#b7)" opacity="0.85">
       <ellipse cx="420" cy="760" rx="520" ry="320" fill="#065f46"/>
       <ellipse cx="1420" cy="360" rx="460" ry="320" fill="#14b8a6"/>
     </g>`,
    `<linearGradient id="g7" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stop-color="#022c22"/><stop offset="100%" stop-color="#0f766e"/>
     </linearGradient>
     <filter id="b7" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="110"/></filter>`,
  ),
);

const slate = svgUrl(
  shell(`<rect width="1920" height="1080" fill="url(#g8)"/>`, `<linearGradient id="g8" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>`),
);

/**
 * Time-of-day wallpaper selection for the "Dynamic" option: morning,
 * daytime, evening and night each get their own gradient.
 */
export function pickAutoWallpaperId(hour: number): string {
  if (hour >= 5 && hour < 11) return 'sunrise';
  if (hour >= 11 && hour < 17) return 'flow-light';
  if (hour >= 17 && hour < 21) return 'forest';
  return 'midnight-grid';
}

const autoPreview = svgUrl(
  shell(
    `<rect x="0" y="0" width="960" height="540" fill="#f97316"/>
     <rect x="960" y="0" width="960" height="540" fill="#7dd3fc"/>
     <rect x="0" y="540" width="960" height="540" fill="#14b8a6"/>
     <rect x="960" y="540" width="960" height="540" fill="#1e3a8a"/>
     <circle cx="960" cy="540" r="150" fill="#ffffff" opacity="0.85"/>`,
  ),
);

export const WALLPAPERS: Wallpaper[] = [
  { id: 'auto', name: 'Dynamic (by time of day)', tone: 'dark', url: autoPreview, accent: '#38bdf8', category: 'concept' },
  { id: 'aurora-mesh', name: 'Aurora Mesh', tone: 'dark', url: auroraMesh, accent: '#3b82f6', category: 'concept' },
  { id: 'bloom-dark', name: 'Bloom', tone: 'dark', url: bloomDark, accent: '#6366f1', category: 'abstract' },
  { id: 'concept-hero', name: 'Concept Mark', tone: 'dark', url: conceptHero, accent: '#38bdf8', category: 'concept' },
  { id: 'midnight-grid', name: 'Midnight Grid', tone: 'dark', url: midnightGrid, accent: '#2563eb', category: 'abstract' },
  { id: 'sunrise', name: 'Sunrise', tone: 'dark', url: sunrise, accent: '#f97316', category: 'gradient' },
  { id: 'forest', name: 'Forest', tone: 'dark', url: forest, accent: '#14b8a6', category: 'gradient' },
  { id: 'flow-light', name: 'Flow (light)', tone: 'light', url: flowLight, accent: '#2563eb', category: 'gradient' },
  { id: 'slate', name: 'Slate', tone: 'dark', url: slate, accent: '#64748b', category: 'solid' },
];

/**
 * Runtime registry for wallpapers created inside the simulator (for example a
 * photo chosen as background from the Photos app). They live for the session and
 * are referenced by id from settings, so the choice survives a reload as long as
 * the image node itself is still in the virtual file system.
 */
const customWallpapers = new Map<string, Wallpaper>();

export function registerCustomWallpaper(id: string, url: string, name: string): Wallpaper {
  const existing = customWallpapers.get(id);
  if (existing) return existing;
  const wallpaper: Wallpaper = { id, name, tone: 'dark', url, accent: '#38bdf8', category: 'custom' };
  customWallpapers.set(id, wallpaper);
  return wallpaper;
}

export function listWallpapers(): Wallpaper[] {
  return [...WALLPAPERS, ...customWallpapers.values()];
}

export function getWallpaper(id: string, now = new Date()): Wallpaper {
  if (id === 'auto') {
    const resolved = pickAutoWallpaperId(now.getHours());
    return WALLPAPERS.find((wallpaper) => wallpaper.id === resolved) ?? WALLPAPERS[1];
  }
  return customWallpapers.get(id) ?? WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? WALLPAPERS[1];
}
