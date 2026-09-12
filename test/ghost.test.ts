import { describe, expect, it } from 'vitest';
import { ghostStyle, hasGhostEffect, recolor } from '../src/lib/ghost';
import type { Spot } from '../src/schema';

function baseSpot(overrides: Partial<Spot> = {}): Spot {
  return { id: 's1', pageId: 'p1', n: 1, label: '', rect: { x: 0, y: 0, w: 0.1, h: 0.1 }, keep: false, notes: [], ...overrides };
}

describe('ghostStyle', () => {
  it('currentがあるfontSizeは段の比で拡縮する', () => {
    const spot = baseSpot({ notes: [{ id: 'n1', kind: 'ladder', attr: 'fontSize', current: 6, target: { delta: -1 } }] });
    // steps: [12,14,16,18,20,24,32,40,56] -> current=6(32px) -> delta-1 => step5(24px)
    const style = ghostStyle(spot, 1);
    expect(style.transform).toBe(`scale(${24 / 32})`);
  });

  it('currentがない相対チップは固定比を使う', () => {
    const spot = baseSpot({ notes: [{ id: 'n1', kind: 'ladder', attr: 'fontSize', target: { delta: -1 } }] });
    const style = ghostStyle(spot, 1);
    expect(style.transform).toBe('scale(0.88)');
  });

  it('角丸は1280基準pxを表示倍率でスケールする', () => {
    const spot = baseSpot({ notes: [{ id: 'n1', kind: 'ladder', attr: 'radius', target: { step: 4 } }] });
    // steps: [0,2,4,8,12,16,24,'full'] -> step4 = 12
    const style = ghostStyle(spot, 0.5);
    expect(style.borderRadius).toBe('6px');
  });

  it('余白を増やす方向は外側の朱いbox-shadowになる', () => {
    const spot = baseSpot({ notes: [{ id: 'n1', kind: 'ladder', attr: 'spacing', target: { delta: 1 } }] });
    const style = ghostStyle(spot, 1);
    expect(style.boxShadow).toContain('0 0 0');
    expect(style.boxShadow).not.toContain('inset');
  });

  it('動きノートはmotion-*クラスと速さになる', () => {
    const spot = baseSpot({ notes: [{ id: 'n1', kind: 'motion', motion: 'pop', trigger: 'enter', speed: 0.6 }] });
    const style = ghostStyle(spot, 1);
    expect(style.motionClass).toBe('motion-pop');
    expect(style.animationDuration).toBe('0.6s');
  });
});

describe('hasGhostEffect', () => {
  it('targetRectだけでも透かしが必要と判定する', () => {
    expect(hasGhostEffect(baseSpot({ targetRect: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } }))).toBe(true);
  });

  it('currentのない色ノートだけでは透かしを出さない', () => {
    expect(hasGhostEffect(baseSpot({ notes: [{ id: 'n1', kind: 'color', target: '#fff' }] }))).toBe(false);
  });

  it('currentのある色ノートは透かしが必要', () => {
    expect(hasGhostEffect(baseSpot({ notes: [{ id: 'n1', kind: 'color', current: '#000', target: '#fff' }] }))).toBe(true);
  });

  it('何もなければ不要', () => {
    expect(hasGhostEffect(baseSpot())).toBe(false);
  });
});

describe('recolor', () => {
  it('今の色に近い画素だけを目標色へずらす', () => {
    // 1px: #3266cc, 1px: 遠い色(#00ff00)
    const data = new Uint8ClampedArray([0x32, 0x66, 0xcc, 255, 0x00, 0xff, 0x00, 255]);
    const out = recolor(data, '#3266cc', '#c94a1d', 40);
    expect(out[0]).toBe(0xc9);
    expect(out[1]).toBe(0x4a);
    expect(out[2]).toBe(0x1d);
    // 遠い画素は変化しない
    expect(out[4]).toBe(0x00);
    expect(out[5]).toBe(0xff);
    expect(out[6]).toBe(0x00);
  });
});
