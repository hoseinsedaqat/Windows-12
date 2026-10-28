/** Generated sample imagery (inline SVG) so the OS ships without binary assets. */

function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s{2,}/g, ' ').trim())}`;
}

const frame = (width: number, height: number, inner: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${defs ? `<defs>${defs}</defs>` : ''}${inner}</svg>`;

export interface SampleImage {
  id: string;
  title: string;
  album: string;
  src: string;
  width: number;
  height: number;
  createdAt: number;
}

const day = 86_400_000;
const now = Date.now();

export const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'img-lakeside',
    title: 'Lakeside dawn',
    album: 'Nature',
    width: 1200,
    height: 800,
    createdAt: now - day * 2,
    src: svgUrl(
      frame(
        1200,
        800,
        `<rect width="1200" height="800" fill="url(#sky)"/>
         <circle cx="900" cy="180" r="70" fill="#fff7ed" opacity="0.9"/>
         <path d="M0 520 L220 380 L380 500 L560 340 L760 520 L1200 420 L1200 800 L0 800 Z" fill="#0f172a" opacity="0.85"/>
         <rect y="560" width="1200" height="240" fill="#0ea5e9" opacity="0.35"/>
         <g opacity="0.35" stroke="#e0f2fe" stroke-width="3">
           <line x1="60" y1="620" x2="360" y2="620"/><line x1="500" y1="670" x2="820" y2="670"/><line x1="880" y1="610" x2="1140" y2="610"/>
         </g>`,
        `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fb923c"/><stop offset="45%" stop-color="#f472b6"/><stop offset="100%" stop-color="#312e81"/></linearGradient>`,
      ),
    ),
  },
  {
    id: 'img-dunes',
    title: 'Dune lines',
    album: 'Nature',
    width: 1200,
    height: 800,
    createdAt: now - day * 6,
    src: svgUrl(
      frame(
        1200,
        800,
        `<rect width="1200" height="800" fill="#fde68a"/>
         <path d="M0 480 C 200 400, 420 560, 640 470 S 1000 380, 1200 460 L1200 800 L0 800Z" fill="#f59e0b"/>
         <path d="M0 600 C 260 520, 480 680, 760 590 S 1040 520, 1200 580 L1200 800 L0 800Z" fill="#b45309"/>
         <circle cx="220" cy="170" r="60" fill="#fffbeb" opacity="0.9"/>`,
      ),
    ),
  },
  {
    id: 'img-citynight',
    title: 'City at night',
    album: 'Urban',
    width: 1200,
    height: 800,
    createdAt: now - day * 11,
    src: svgUrl(
      frame(
        1200,
        800,
        `<rect width="1200" height="800" fill="#020617"/>
         <g fill="#0f172a">
           <rect x="40" y="360" width="120" height="440"/><rect x="190" y="280" width="140" height="520"/>
           <rect x="360" y="420" width="110" height="380"/><rect x="500" y="200" width="160" height="600"/>
           <rect x="690" y="330" width="130" height="470"/><rect x="850" y="250" width="150" height="550"/>
           <rect x="1030" y="400" width="130" height="400"/>
         </g>
         <g fill="#fbbf24" opacity="0.85">
           ${Array.from({ length: 120 })
             .map((_, index) => {
               const x = 50 + ((index * 97) % 1100);
               const y = 240 + ((index * 61) % 520);
               return `<rect x="${x}" y="${y}" width="10" height="14"/>`;
             })
             .join('')}
         </g>`,
      ),
    ),
  },
  {
    id: 'img-abstract',
    title: 'Fluid shapes',
    album: 'Abstract',
    width: 1000,
    height: 1000,
    createdAt: now - day * 20,
    src: svgUrl(
      frame(
        1000,
        1000,
        `<rect width="1000" height="1000" fill="#111827"/>
         <circle cx="330" cy="360" r="240" fill="#8b5cf6" opacity="0.8"/>
         <circle cx="660" cy="520" r="270" fill="#06b6d4" opacity="0.65"/>
         <circle cx="480" cy="720" r="200" fill="#f43f5e" opacity="0.55"/>`,
      ),
    ),
  },
  {
    id: 'img-macro',
    title: 'Leaf macro',
    album: 'Nature',
    width: 1000,
    height: 750,
    createdAt: now - day * 30,
    src: svgUrl(
      frame(
        1000,
        750,
        `<rect width="1000" height="750" fill="#052e16"/>
         <path d="M120 640 C 300 200, 700 120, 900 90 C 820 420, 600 620, 120 640Z" fill="#22c55e"/>
         <path d="M160 620 C 420 420, 660 280, 880 110" stroke="#dcfce7" stroke-width="6" fill="none" opacity="0.7"/>
         <g stroke="#dcfce7" stroke-width="2" opacity="0.45">
           ${Array.from({ length: 14 })
             .map((_, index) => `<line x1="${200 + index * 46}" y1="${590 - index * 30}" x2="${250 + index * 46}" y2="${430 - index * 24}"/>`)
             .join('')}
         </g>`,
      ),
    ),
  },
  {
    id: 'img-neon',
    title: 'Neon corridor',
    album: 'Urban',
    width: 900,
    height: 1200,
    createdAt: now - day * 44,
    src: svgUrl(
      frame(
        900,
        1200,
        `<rect width="900" height="1200" fill="#0b0217"/>
         <g fill="none" stroke-width="10">
           <rect x="60" y="60" width="780" height="1080" stroke="#a21caf" opacity="0.7"/>
           <rect x="150" y="170" width="600" height="860" stroke="#22d3ee" opacity="0.6"/>
           <rect x="250" y="290" width="400" height="620" stroke="#f472b6" opacity="0.7"/>
           <rect x="340" y="420" width="220" height="360" stroke="#facc15" opacity="0.6"/>
         </g>`,
      ),
    ),
  },
];

export function sampleImageById(id: string): SampleImage | undefined {
  return SAMPLE_IMAGES.find((image) => image.id === id);
}
