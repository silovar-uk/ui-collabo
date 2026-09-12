import { describe, expect, it } from 'vitest';
import { sampleBounds } from '../src/lib/image';

describe('sampleBounds', () => {
  it('右下端でもcanvas外へ出ない', () => {
    const b = sampleBounds(100, 80, 99, 79);
    expect(b.x + b.w).toBeLessThanOrEqual(100);
    expect(b.y + b.h).toBeLessThanOrEqual(80);
    expect(b.w).toBeGreaterThan(0);
    expect(b.h).toBeGreaterThan(0);
  });

  it('左上端でもcanvas内に収める', () => {
    expect(sampleBounds(10, 10, 0, 0)).toEqual({ x: 0, y: 0, w: 5, h: 5 });
  });
});
