import { describe, expect, it } from 'vitest';
import { diffRegionKey, diffRegionToSpot } from '../src/lib/diffTriage';
import type { DiffRegion } from '../src/lib/visualDiff';

const region: DiffRegion = {
  kind: 'unexpected',
  rect: { x: 0.125, y: 0.25, w: 0.375, h: 0.5 },
  score: 0.8,
  cells: 4,
  targetIds: [],
};

describe('diff triage', () => {
  it('creates a stable key from the visible region geometry', () => {
    expect(diffRegionKey(region)).toBe('unexpected:0.125:0.25:0.375:0.5:4');
    expect(diffRegionKey({ ...region, score: 0.2 })).toBe(diffRegionKey(region));
  });

  it('promotes an unexpected candidate into a normal editable Spot', () => {
    const spot = diffRegionToSpot({
      region,
      pageId: 'page-2',
      n: 7,
      id: 'spot-from-diff',
    });

    expect(spot).toEqual({
      id: 'spot-from-diff',
      pageId: 'page-2',
      n: 7,
      label: '想定外の変更',
      rect: { x: 0.125, y: 0.25, w: 0.375, h: 0.5 },
      keep: false,
      notes: [],
    });
    expect(spot.carried).toBeUndefined();
    expect(spot.check).toBeUndefined();
  });

  it('copies the region rect rather than sharing the same object', () => {
    const spot = diffRegionToSpot({ region, pageId: 'page-1', n: 1, id: 'spot-1' });
    expect(spot.rect).toEqual(region.rect);
    expect(spot.rect).not.toBe(region.rect);
  });
});
