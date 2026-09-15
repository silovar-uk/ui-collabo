import { describe, expect, it } from 'vitest';
import { fitBoard, pageCanvasSize, palettePosition } from '../src/lib/geometry';
import { newBoard } from '../src/schema';
import type { Page } from '../src/schema';

describe('フェーズA: fitBoard', () => {
  it('作業面より小さいページ(比率が近い)は全体表示になる', () => {
    const fit = fitBoard(700, 440, 1280, 800, null);
    expect(fit.mode).toBe('whole');
    expect(fit.autoMode).toBe('whole');
    expect(fit.width).toBeCloseTo(700, 0);
    expect(fit.height).toBeLessThanOrEqual(440);
  });

  it('縦長のページは自動で幅合わせになる(全体表示が幅合わせの半分未満)', () => {
    const fit = fitBoard(700, 440, 1280, 5000, null);
    expect(fit.autoMode).toBe('width');
    expect(fit.mode).toBe('width');
    expect(fit.width).toBeCloseTo(700, 0);
    expect(fit.height).toBeGreaterThan(440);
  });

  it('手動選択(preferred)は自動判定を上書きする', () => {
    const wide = fitBoard(700, 440, 1280, 5000, 'whole');
    expect(wide.mode).toBe('whole');
    const narrow = fitBoard(700, 440, 1280, 800, 'width');
    expect(narrow.mode).toBe('width');
  });

  it('幅合わせは等倍を超えて拡大しない', () => {
    const fit = fitBoard(2000, 2000, 390, 844, 'width');
    expect(fit.width).toBe(390);
    expect(fit.height).toBe(844);
  });

  it('areaW・pageW・pageHのどれかが0以下なら幅合わせで寸法0を返す', () => {
    expect(fitBoard(0, 440, 1280, 800, null)).toEqual({ mode: 'width', autoMode: 'width', scale: 0, width: 0, height: 0 });
    expect(fitBoard(700, 440, 0, 800, null)).toEqual({ mode: 'width', autoMode: 'width', scale: 0, width: 0, height: 0 });
    expect(fitBoard(700, 440, 1280, 0, null)).toEqual({ mode: 'width', autoMode: 'width', scale: 0, width: 0, height: 0 });
  });

  it('areaHが0以下のときは全体表示を使わない(920px以下相当)', () => {
    const fit = fitBoard(700, 0, 1280, 800, null);
    expect(fit.autoMode).toBe('width');
  });
});

describe('フェーズB: palettePosition', () => {
  const surface = { width: 400, height: 300 };
  const bar = { width: 120, height: 30 };

  it('上に入れば箇所の上に置く', () => {
    const pos = palettePosition({ x: 50, y: 100, w: 60, h: 40 }, surface, bar);
    expect(pos.top).toBe(100 - 6 - 30);
  });

  it('上に入らなければ下に置く', () => {
    const pos = palettePosition({ x: 50, y: 10, w: 60, h: 40 }, surface, bar);
    expect(pos.top).toBe(10 + 40 + 6);
  });

  it('上下どちらも無理なら箇所の内側の上端に置く', () => {
    const pos = palettePosition({ x: 50, y: 0, w: 60, h: 295 }, surface, bar);
    expect(pos.top).toBeGreaterThanOrEqual(0);
    expect(pos.top).toBeLessThanOrEqual(surface.height - bar.height);
  });

  it('左右は作業面の内側に収める', () => {
    const left = palettePosition({ x: -20, y: 100, w: 60, h: 40 }, surface, bar);
    expect(left.left).toBe(0);
    const right = palettePosition({ x: 390, y: 100, w: 60, h: 40 }, surface, bar);
    expect(right.left).toBe(surface.width - bar.width);
  });
});

describe('フェーズA: pageCanvasSize', () => {
  function pageWith(overrides: Partial<Page>): Page {
    return { id: 'p1', image: null, ...overrides };
  }

  it('HTMLページはsourceの寸法を返す', () => {
    const board = newBoard({ kind: 'web' });
    const page = pageWith({ source: { kind: 'html', html: '', allowExternal: false, width: 1280, height: 3600 } });
    expect(pageCanvasSize(board, page)).toEqual({ width: 1280, height: 3600 });
  });

  it('画像ページはimageの寸法を返す', () => {
    const board = newBoard({ kind: 'web' });
    const page = pageWith({ image: { dataUrl: 'x', width: 390, height: 844 } });
    expect(pageCanvasSize(board, page)).toEqual({ width: 390, height: 844 });
  });

  it('白紙ページはnominalCanvasSizeを返す', () => {
    const board = newBoard({ kind: 'slide', aspect: '16:9' });
    const page = pageWith({});
    expect(pageCanvasSize(board, page)).toEqual({ width: 1280, height: 720 });
  });
});
