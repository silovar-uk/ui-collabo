import { describe, expect, it } from 'vitest';
import { findRuleDeviations, tally, type ElementRecord } from '../src/lib/audit';
import { emptyRules } from '../src/schema';

function rec(partial: Partial<ElementRecord>): ElementRecord {
  return { selector: 's', area: 100, ...partial };
}

describe('R1-c: tally', () => {
  it('値ごとに件数をまとめ、多い順に並べる', () => {
    const records = [rec({ selector: 'a', fontSize: '16px' }), rec({ selector: 'b', fontSize: '16px' }), rec({ selector: 'c', fontSize: '24px' })];
    const result = tally(records, 'fontSize');
    expect(result).toEqual([
      { value: '16px', count: 2, selectors: ['a', 'b'] },
      { value: '24px', count: 1, selectors: ['c'] },
    ]);
  });

  it('値がない記録は数えない', () => {
    expect(tally([rec({})], 'color')).toEqual([]);
  });
});

describe('R1-c: findRuleDeviations', () => {
  it('本文の文字サイズルールとズレた要素を面積の大きい順に返す', () => {
    const rules = { ...emptyRules(), type: [{ role: 'body' as const, size: 16 }] };
    const records = [
      rec({ selector: 'small', fontSize: '16px', area: 50 }), // 一致
      rec({ selector: 'big', fontSize: '32px', area: 500 }), // ズレ
      rec({ selector: 'mid', fontSize: '30px', area: 200 }), // ズレ(32pxと同じ段)
    ];
    const result = findRuleDeviations(records, rules);
    expect(result.map((r) => r.selector)).toEqual(['big', 'mid']);
    expect(result[0].ruleRef).toBe('type.body.size');
  });

  it('文字色ルールとズレた要素を検出する', () => {
    const rules = { ...emptyRules(), palette: [{ role: 'text' as const, hex: '#111111' }] };
    const records = [rec({ selector: 'ok', color: '#111111' }), rec({ selector: 'ng', color: '#ff0000' })];
    const result = findRuleDeviations(records, rules);
    expect(result.map((r) => r.selector)).toEqual(['ng']);
    expect(result[0].ruleRef).toBe('palette.text');
  });

  it('ルールがなければ何も検出しない', () => {
    expect(findRuleDeviations([rec({ fontSize: '16px' })], emptyRules())).toEqual([]);
  });
});
