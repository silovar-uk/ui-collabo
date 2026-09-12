import { describe, expect, it } from 'vitest';
import { buildHighlightMask } from '../src/lib/highlightMask';

describe('R1-b: buildHighlightMask', () => {
  it('近い画素だけ朱にし、遠い画素は透明にする', () => {
    const data = new Uint8ClampedArray([50, 100, 200, 255, 0, 255, 0, 255]);
    const out = buildHighlightMask(data, '#3266cc', 24);
    expect(out[3]).toBeGreaterThan(0);
    expect(out[7]).toBe(0);
  });
});
