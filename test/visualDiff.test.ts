import { describe, expect, it } from 'vitest';
import { detectVisualDiffRegions } from '../src/lib/visualDiff';

function blank(width: number, height: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return data;
}

function fillRect(data: Uint8ClampedArray, width: number, x0: number, y0: number, w: number, h: number, rgb: [number, number, number]) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }
}

const options = {
  colorThreshold: 10,
  cellSize: 4,
  cellChangeRatio: 0.1,
  minRegionCells: 1,
  expectedCellOverlap: 0.1,
};

describe('visual diff', () => {
  it('同一画像なら候補を出さない', () => {
    const before = blank(32, 32);
    const after = before.slice();
    const result = detectVisualDiffRegions(before, after, 32, 32, [], options);
    expect(result.regions).toHaveLength(0);
    expect(result.changedRatio).toBe(0);
  });

  it('指示範囲内の変更をexpectedへ分類する', () => {
    const before = blank(32, 32);
    const after = before.slice();
    fillRect(after, 32, 4, 4, 8, 8, [0, 0, 0]);
    const result = detectVisualDiffRegions(before, after, 32, 32, [
      { id: 'spot-1', rect: { x: 0.1, y: 0.1, w: 0.35, h: 0.35 } },
    ], options);
    expect(result.expected).toHaveLength(1);
    expect(result.unexpected).toHaveLength(0);
    expect(result.expected[0].targetIds).toContain('spot-1');
  });

  it('指示範囲外の変更をunexpectedへ分類する', () => {
    const before = blank(32, 32);
    const after = before.slice();
    fillRect(after, 32, 20, 20, 8, 8, [0, 0, 0]);
    const result = detectVisualDiffRegions(before, after, 32, 32, [
      { id: 'spot-1', rect: { x: 0, y: 0, w: 0.25, h: 0.25 } },
    ], options);
    expect(result.expected).toHaveLength(0);
    expect(result.unexpected).toHaveLength(1);
  });

  it('指示内外の変更を別々の候補として残す', () => {
    const before = blank(32, 32);
    const after = before.slice();
    fillRect(after, 32, 4, 4, 8, 8, [0, 0, 0]);
    fillRect(after, 32, 20, 20, 8, 8, [255, 0, 0]);
    const result = detectVisualDiffRegions(before, after, 32, 32, [
      { id: 'spot-1', rect: { x: 0.1, y: 0.1, w: 0.35, h: 0.35 } },
    ], options);
    expect(result.expected).toHaveLength(1);
    expect(result.unexpected).toHaveLength(1);
  });
});
