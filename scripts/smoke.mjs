/**
 * E2E smoke check (Playwright): boot → lock → sign in → desktop →
 * start menu → launch Notepad → type real text → assert it landed.
 * Expects `npm run preview` to be serving the production build on :4173.
 * Exit code 0 = pass; anything else = fail (CI marks the check red).
 */
import { chromium } from 'playwright';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:4173/';
const OUT = '/tmp/smoke';
const { mkdirSync } = await import('node:fs');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

try {
  console.log('[smoke] goto', BASE);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // boot -> lock (click skips boot; lock is two-step)
  await page.waitForTimeout(1400);
  await page.mouse.click(720, 450);
  for (let i = 0; i < 6 && !(await page.$('input[aria-label="Password"]')); i += 1) {
    await page.mouse.click(720, 450);
    await page.waitForTimeout(900);
  }
  await page.waitForSelector('input[aria-label="Password"]', { timeout: 30000 });
  await page.fill('input[aria-label="Password"]', '1234');
  await page.press('input[aria-label="Password"]', 'Enter');
  console.log('[smoke] signed in');

  // desktop + taskbar
  await page.waitForSelector('nav[aria-label="Taskbar"]', { timeout: 45000 });
  await page.waitForTimeout(2000);
  console.log('[smoke] desktop ready');

  // start menu opens and closes
  await page.click('button[aria-label="Start"]');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  console.log('[smoke] start menu ok');

  // launch Notepad through taskbar search
  const pill = 'div[data-search-root] input';
  await page.fill(pill, 'notepad');
  await page.waitForTimeout(500);
  await page.press(pill, 'Enter');
  await page.waitForSelector('section[aria-label="Notepad window"]', { timeout: 20000 });
  console.log('[smoke] notepad open');

  // type real text into the editor and verify it is rendered
  await page.click('section[aria-label="Notepad window"] textarea');
  await page.keyboard.type('smoke test line 12345', { delay: 25 });
  await page.waitForTimeout(600);
  const typed = await page.locator('section[aria-label="Notepad window"] textarea').inputValue();
  if (!typed.includes('smoke test line 12345')) throw new Error(`typed text not found, got: ${JSON.stringify(typed)}`);
  console.log('[smoke] typing verified');

  // close the window with the titlebar button
  await page.click('section[aria-label="Notepad window"] header.titlebar button[aria-label="Close"]');
  await page.waitForTimeout(600);
  if (await page.$('section[aria-label="Notepad window"]')) throw new Error('window did not close');
  console.log('[smoke] close verified');

  if (errors.length > 0) {
    throw new Error(`page errors during smoke run: ${errors.slice(0, 3).join(' | ')}`);
  }
  console.log('[smoke] PASS');
  await browser.close();
  process.exit(0);
} catch (error) {
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => undefined);
  console.error('[smoke] FAIL:', error.message);
  console.error('[smoke] body text:', (await page.evaluate(() => document.body.innerText).catch(() => '')).slice(0, 400).replace(/\\n/g, ' | '));
  if (errors.length) console.error('[smoke] page errors:', errors.slice(0, 5).join(' | '));
  await browser.close();
  process.exit(1);
}
