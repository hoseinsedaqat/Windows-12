/**
 * Visual regression: pixel-diff the freshly captured screenshots in
 * docs/screenshots against the committed references in docs/screenshots/ref.
 *
 * Usage:
 *   node scripts/visual_diff.mjs            # compare; exit 1 when a shot drifts
 *   node scripts/visual_diff.mjs --update   # accept current shots as the new refs
 *
 * A SHOT_THRESHOLD percent of differing pixels per image is tolerated
 * (anti-aliasing, font hinting, cursor blink). Diff images and a report land
 * in docs/screenshots/diff/ so CI can commit them back as evidence.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const SHOTS_DIR = 'docs/screenshots';
const REF_DIR = join(SHOTS_DIR, 'ref');
const DIFF_DIR = join(SHOTS_DIR, 'diff');
const THRESHOLD_PERCENT = Number(process.env.VISUAL_THRESHOLD_PERCENT ?? 1.5);
const update = process.argv.includes('--update');

const shots = readdirSync(SHOTS_DIR).filter((file) => file.endsWith('.png'));
if (shots.length === 0) {
  console.error('No screenshots found in ' + SHOTS_DIR);
  process.exit(1);
}

if (update) {
  mkdirSync(REF_DIR, { recursive: true });
  for (const shot of shots) {
    writeFileSync(join(REF_DIR, shot), readFileSync(join(SHOTS_DIR, shot)));
    console.log(`ref updated: ${shot}`);
  }
  process.exit(0);
}

if (!existsSync(REF_DIR) || readdirSync(REF_DIR).filter((file) => file.endsWith('.png')).length === 0) {
  console.error('No reference images in ' + REF_DIR + ' — run with --update once to seed them.');
  process.exit(1);
}

mkdirSync(DIFF_DIR, { recursive: true });
const report = [];
let failures = 0;

for (const shot of shots) {
  const refPath = join(REF_DIR, shot);
  if (!existsSync(refPath)) {
    report.push({ shot, status: 'new (no reference)' });
    continue;
  }
  const current = PNG.sync.read(readFileSync(join(SHOTS_DIR, shot)));
  const reference = PNG.sync.read(readFileSync(refPath));
  if (current.width !== reference.width || current.height !== reference.height) {
    report.push({ shot, status: `size changed ${reference.width}x${reference.height} -> ${current.width}x${current.height}` });
    failures += 1;
    continue;
  }
  const diff = new PNG({ width: current.width, height: current.height });
  const mismatched = pixelmatch(reference.data, current.data, diff.data, current.width, current.height, {
    threshold: 0.12,
    alpha: 0.25,
  });
  const percent = (mismatched / (current.width * current.height)) * 100;
  const ok = percent <= THRESHOLD_PERCENT;
  if (!ok) failures += 1;
  report.push({ shot, status: `${ok ? 'ok' : 'DRIFT'} ${percent.toFixed(2)}% different (${mismatched}px)` });
  if (!ok) writeFileSync(join(DIFF_DIR, shot), PNG.sync.write(diff));
}

console.log('— visual regression report —');
for (const line of report) console.log(`  ${line.shot}: ${line.status}`);
if (failures > 0) {
  console.error(`${failures} screenshot(s) drifted beyond ${THRESHOLD_PERCENT}% threshold.`);
  process.exit(1);
}
console.log('All screenshots within tolerance.');
