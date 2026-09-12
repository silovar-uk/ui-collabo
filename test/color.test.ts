import { describe, expect, it } from 'vitest';
import { hexToHsl, hslToHex, rgbStringToHex } from '../src/lib/color';

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

describe('rgbStringToHex', () => {
  it('rgb()をhexに変換する', () => {
    expect(rgbStringToHex('rgb(228, 87, 46)')).toBe('#e4572e');
  });

  it('S8: 完全透明(alpha=0)はnullにする(不透明な黒と区別が付かなくなるため)', () => {
    expect(rgbStringToHex('rgba(0, 0, 0, 0)')).toBeNull();
  });

  it('半透明はalphaを無視してhexにする', () => {
    expect(rgbStringToHex('rgba(0, 0, 0, 0.5)')).toBe('#000000');
  });
});
