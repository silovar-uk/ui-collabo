import { describe, expect, it } from 'vitest';
import { extractPalette } from '../src/lib/palette';

function pixels(colors: [number, number, number][]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return data;
}

describe('R1-b: extractPalette', () => {
  it('多い色ほど先頭に来る', () => {
    const data = pixels([
      ...Array(6).fill([255, 255, 255]),
      ...Array(3).fill([0, 0, 0]),
      [51, 102, 204],
    ]);
    const result = extractPalette(data);
    expect(result[0].hex).toBe('#f0f0f0');
    expect(result[0].share).toBeCloseTo(0.6, 1);
    expect(result[1].hex).toBe('#000000');
  });

  it('近い色(距離24以内)は多い方へまとめる', () => {
    const data = pixels([...Array(5).fill([200, 200, 200]), ...Array(5).fill([210, 205, 202])]);
    const result = extractPalette(data);
    expect(result.length).toBe(1);
  });

  it('1%未満は捨てる', () => {
    const many = Array(200).fill([255, 255, 255] as [number, number, number]);
    const data = pixels([...many, [0, 0, 0]]);
    const result = extractPalette(data);
    expect(result.find((c) => c.hex === '#000000')).toBeUndefined();
  });

  it('透明な画素は数えない', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 255]);
    const result = extractPalette(data);
    expect(result).toEqual([{ hex: '#00f000', share: 1 }]);
  });
});
