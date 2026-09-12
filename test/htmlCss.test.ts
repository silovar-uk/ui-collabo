import { describe, expect, it } from 'vitest';
import { resolveLadder, spotsToCss } from '../src/lib/htmlCss';
import type { Note, Spot } from '../src/schema';

function ladderNote(target: { step: number } | { delta: number }): Extract<Note, { kind: 'ladder' }> {
  return { id: 'n1', kind: 'ladder', attr: 'fontSize', target };
}

describe('resolveLadder', () => {
  it('delta: 現在値32pxから最も近い段を探し、-1段の24pxを採用する', () => {
    const resolved = resolveLadder('fontSize', ladderNote({ delta: -1 }), { 'font-size': '32px' });
    expect(resolved).toEqual({ from: '32px', to: '24px' });
  });

  it('delta: 段の範囲を超える場合は端にクランプする', () => {
    const resolved = resolveLadder('fontSize', ladderNote({ delta: -2 }), { 'font-size': '12px' });
    expect(resolved).toEqual({ from: '12px', to: '12px' });
  });

  it('delta: 実測値がない場合は null', () => {
    expect(resolveLadder('fontSize', ladderNote({ delta: -1 }), {})).toBeNull();
  });

  it('step: 実測値の有無にかかわらず、指定した段をそのまま採用する', () => {
    const resolved = resolveLadder('fontSize', ladderNote({ step: 5 }), { 'font-size': '32px' });
    expect(resolved).toEqual({ from: '32px', to: '24px' });
  });

  it('radius: full は 9999px に置き換える', () => {
    const resolved = resolveLadder('radius', { id: 'n2', kind: 'ladder', attr: 'radius', target: { step: 7 } }, {});
    expect(resolved).toEqual({ from: null, to: '9999px' });
  });
});

describe('spotsToCss', () => {
  it('elementを持つ箇所のノートをCSSに変換する', () => {
    const spot: Spot = {
      id: 's1',
      pageId: 'p1',
      n: 1,
      label: '見出し',
      rect: { x: 0, y: 0, w: 0.1, h: 0.1 },
      keep: false,
      notes: [ladderNote({ delta: -1 })],
      element: { selector: '.hero > h1', tag: 'h1', computed: { 'font-size': '32px' } },
    };
    expect(spotsToCss([spot])).toBe('.hero > h1 { font-size: 24px !important; }');
  });

  it('elementを持たない箇所は無視する', () => {
    const spot: Spot = { id: 's1', pageId: 'p1', n: 1, label: '', rect: { x: 0, y: 0, w: 0.1, h: 0.1 }, keep: false, notes: [] };
    expect(spotsToCss([spot])).toBe('');
  });
});
