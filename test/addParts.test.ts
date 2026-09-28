import { describe, expect, it } from 'vitest';
import { defaultAddRect, placeOf } from '../src/lib/addParts';

const PAGE = { width: 1280, height: 760 };
// 料金プランのProカード程度の箇所を想定(px: x160,y400,w300,h44 相当)
const SPOT = { x: 160 / 1280, y: 400 / 760, w: 300 / 1280, h: 44 / 760 };

describe('defaultAddRect', () => {
  it('below: 箇所の下、14px離れた位置にボタンの既定サイズで置く', () => {
    const rect = defaultAddRect('button', 'below', SPOT, PAGE);
    expect(Math.round(rect.x * PAGE.width)).toBe(160);
    expect(Math.round(rect.y * PAGE.height)).toBe(400 + 44 + 14);
    expect(Math.round(rect.w * PAGE.width)).toBe(160);
    expect(Math.round(rect.h * PAGE.height)).toBe(44);
  });

  it('right: 箇所の右、14px離れた位置に置く', () => {
    const rect = defaultAddRect('image', 'right', SPOT, PAGE);
    expect(Math.round(rect.x * PAGE.width)).toBe(160 + 300 + 14);
    expect(Math.round(rect.y * PAGE.height)).toBe(400);
  });

  it('line: 幅は箇所の幅を使い、高さは3px', () => {
    const rect = defaultAddRect('line', 'below', SPOT, PAGE);
    expect(Math.round(rect.w * PAGE.width)).toBe(300);
    expect(Math.round(rect.h * PAGE.height)).toBe(3);
  });

  it('box: 高さは箇所の高さを60〜140pxに丸めたもの', () => {
    const tall = defaultAddRect('box', 'below', { x: 0.1, y: 0.1, w: 0.2, h: 200 / 760 }, PAGE);
    expect(Math.round(tall.h * PAGE.height)).toBe(140);
    const short = defaultAddRect('box', 'below', { x: 0.1, y: 0.1, w: 0.2, h: 10 / 760 }, PAGE);
    expect(Math.round(short.h * PAGE.height)).toBe(60);
  });

  it('ページ外にはみ出さないよう丸める', () => {
    const rect = defaultAddRect('button', 'right', { x: 0.95, y: 0.1, w: 0.04, h: 0.05 }, PAGE);
    expect(rect.x + rect.w).toBeLessThanOrEqual(1.0001);
  });
});

describe('placeOf', () => {
  const spot = { x: 0.3, y: 0.3, w: 0.2, h: 0.1 };

  it('中心が箇所の下なら below', () => {
    expect(placeOf({ x: 0.3, y: 0.45, w: 0.1, h: 0.05 }, spot)).toBe('below');
  });

  it('中心が箇所の上なら above', () => {
    expect(placeOf({ x: 0.3, y: 0.1, w: 0.1, h: 0.05 }, spot)).toBe('above');
  });

  it('中心が箇所より左なら left、右なら right', () => {
    expect(placeOf({ x: 0.0, y: 0.32, w: 0.1, h: 0.05 }, spot)).toBe('left');
    expect(placeOf({ x: 0.55, y: 0.32, w: 0.1, h: 0.05 }, spot)).toBe('right');
  });

  it('箇所に重なれば inside', () => {
    expect(placeOf({ x: 0.35, y: 0.32, w: 0.05, h: 0.03 }, spot)).toBe('inside');
  });
});
