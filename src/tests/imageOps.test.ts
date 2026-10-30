import { describe, expect, it } from 'vitest';
import { clampCrop, editedFileName, isEdited, nextRotation, NO_EDITS } from '../core/imageOps';

describe('imageOps', () => {
  it('cycles rotation through 90 degree steps', () => {
    expect(nextRotation(0, 1)).toBe(90);
    expect(nextRotation(0, -1)).toBe(270);
    expect(nextRotation(270, 1)).toBe(0);
  });

  it('derives the saved-copy file name', () => {
    expect(editedFileName('Sunrise.png')).toBe('Sunrise-edited.png');
    expect(editedFileName('noext')).toBe('noext-edited.png');
  });

  it('clamps a crop rectangle inside image bounds', () => {
    const crop = clampCrop({ x: -20, y: 90, w: 400, h: 40 }, 200, 100);
    expect(crop).toEqual({ x: 0, y: 60, w: 200, h: 40 });
  });

  it('knows when edits are dirty', () => {
    expect(isEdited(NO_EDITS)).toBe(false);
    expect(isEdited({ ...NO_EDITS, filter: 'sepia' })).toBe(true);
  });
});
