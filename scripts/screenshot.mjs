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
page.on('console', (message) => console.log('[console:' + message.type() + ']', message.text().slice(0, 300)));

console.log('[shoot] goto', BASE);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// 1) Boot animation — skippable with a click.
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/phase-1-boot.png` });
await page.mouse.click(720, 450);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/phase-2-after-skip.png` });
console.log('[shoot] boot skipped; body text:', (await page.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' | '));

// 2) Lock screen — two-step: "click anywhere" first, then the password form.
for (let i = 0; i < 6; i += 1) {
  if (await page.$('input[aria-label="Password"]')) break;
  await page.mouse.click(720, 450);
  await page.waitForTimeout(900);
}
try {
  await page.waitForSelector('input[aria-label="Password"]', { timeout: 30000 });
} catch (error) {
  await page.screenshot({ path: `${OUT}/phase-3-lock-timeout.png` });
  console.error('[shoot] lock timeout; body text:', (await page.evaluate(() => document.body.innerText)).slice(0, 400).replace(/\n/g, ' | '));
  throw error;
}
await page.waitForTimeout(600);
await page.fill('input[aria-label="Password"]', '1234');
await page.press('input[aria-label="Password"]', 'Enter'); // submit button is icon-only
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

// 4) Start menu over the pristine desktop (wallpaper + icons visible).
await page.click('button[aria-label="Start"]');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/start-menu.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
console.log('[shoot] start menu shot taken');

// 5) Two real app windows with real content, snapped left/right.
await launch('excel');
await launch('word');
await page.mouse.click(1200, 780); // empty desktop: blur search, open nothing

async function snap(appName, edgeX) {
  const bar = page.locator(`section[aria-label="${appName} window"] header.titlebar`);
  const box = await bar.boundingBox();
  if (!box) throw new Error(`titlebar not found for ${appName}`);
  const cx = box.x + box.width / 2;
  const cy = box.y + 10;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 5, cy + 4, { steps: 3 }); // engage lazy pointer capture
  await page.mouse.move(edgeX, 450, { steps: 16 });
  await page.waitForTimeout(350);
  await page.mouse.up();
  await page.waitForTimeout(800);
}
await snap('Word', 1437); // front window first, then the exposed one
await snap('Excel', 3);

// type real content: Excel grid (left half) then Word page (right half)
const cell = async (x, y, text) => {
  await page.mouse.click(x, y);
  await page.waitForTimeout(220);
  await page.keyboard.type(text, { delay: 30 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(160);
};
await cell(92, 197, 'Quarter');
await cell(180, 197, 'Revenue');
await cell(92, 217, 'Q1');
await cell(180, 217, '12500');
await cell(92, 237, 'Q2');
await cell(180, 237, '18240');
await cell(92, 257, 'Total');
await cell(180, 257, '=SUM(B2:B3)');
await page.waitForTimeout(400);

await page.locator('section[aria-label="Word window"] [contenteditable]').click();
await page.waitForTimeout(220);
await page.keyboard.type('Windows 12 Concept', { delay: 20 });
await page.keyboard.press('Enter');
await page.keyboard.type('A full desktop that lives inside your browser: windows, files,', { delay: 12 });
await page.keyboard.press('Enter');
await page.keyboard.type('Office documents, games and more - all simulated, all interactive.', { delay: 12 });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/desktop.png` });
console.log('[shoot] hero shot taken');

// 6) A playable game (Minesweeper) for the gallery.
await launch('minesweeper');
await page.mouse.click(1200, 780);
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/games.png` });
console.log('[shoot] games shot taken');

await browser.close();
console.log('[shoot] screenshots written to', OUT);
