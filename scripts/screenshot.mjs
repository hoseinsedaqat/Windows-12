/**
 * Real product screenshots of the simulator, taken by driving the actual UI
 * with Playwright (boot → sign-in → open apps → shoot). Run inside CI:
 *   npm run build && npm run preview &  node scripts/screenshot.mjs
 * Outputs land in docs/screenshots/raw/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = 'docs/screenshots/raw';
mkdirSync(OUT, { recursive: true });

console.log('[shoot] launching chromium');
process.on('unhandledRejection', (error) => {
  console.error('[shoot] fatal', error);
  process.exitCode = 1;
});

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', (error) => console.warn('[pageerror]', error.message));

console.log('[shoot] goto', BASE);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// 1) Boot animation — skippable with a click.
await page.waitForTimeout(1400);
await page.mouse.click(720, 450);
console.log('[shoot] boot skipped');

// 2) Lock screen — demo password 1234.
await page.waitForSelector('input[aria-label="Password"]', { timeout: 45000 });
await page.waitForTimeout(600);
await page.fill('input[aria-label="Password"]', '1234');
await page.click('button:has-text("Sign in")');
console.log('[shoot] signed in');

// 3) Desktop + taskbar.
await page.waitForSelector('nav[aria-label="Taskbar"]', { timeout: 45000 });
await page.waitForTimeout(2200); // seeding, icons, weather chip
console.log('[shoot] desktop ready');

const pill = 'div[data-search-root] input';

async function launch(query) {
  await page.fill(pill, query);
  await page.waitForTimeout(500);
  await page.press(pill, 'Enter');
  await page.waitForTimeout(1600); // lazy app chunk + window open animation
}

// 4) Two real app windows for the hero shot.
await launch('excel');
await launch('word');
await page.mouse.click(720, 860); // blur search, keep windows
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/desktop.png` });

// 5) Start menu open over the desktop.
await page.click('button[aria-label="Start"]');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/start-menu.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// 6) A playable game (Minesweeper) for the gallery.
await launch('minesweeper');
await page.mouse.click(720, 860);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/games.png` });

await browser.close();
console.log('[shoot] screenshots written to', OUT);
