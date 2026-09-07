import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex } from '../src/lib/color';

describe('color', () => {
  it('既知の色をHSLへ変換できる', () => {
    const [h, s, l] = hexToHsl('#e4572e');
    expect(Math.round(h)).toBe(14);
    expect(Math.round(s)).toBe(77);
    expect(Math.round(l)).toBe(54);
  });

  it('hex→HSL→hexが往復する', () => {
    for (const hex of ['#000000', '#ffffff', '#3266cc', '#e4572e']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });
});
