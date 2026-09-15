import { describe, expect, it } from 'vitest';
import { describeComputed, normalizeText, spotDisplayName } from '../src/lib/describeElement';

describe('S8: describeComputed', () => {
  it('会話語のラベルに変換する', () => {
    const lines = describeComputed({ 'font-size': '56px', 'font-weight': '700', color: '#111111' });
    expect(lines).toEqual(['文字 56px', '太さ 700', '色 #111111']);
  });

  it('透明・0px・既定値は出さない', () => {
    const lines = describeComputed({
      'background-color': 'rgba(0, 0, 0, 0)',
      'border-radius': '0px',
      'border-width': '0px',
      margin: '0px',
      color: '#111111',
    });
    expect(lines).toEqual(['色 #111111']);
  });
});

describe('フェーズB: normalizeText / spotDisplayName', () => {
  it('連続する空白・改行を1つの空白にまとめる', () => {
    expect(normalizeText('リンク集\n- スケッチ風のやつ')).toBe('リンク集 - スケッチ風のやつ');
    expect(normalizeText('  見出し   です  ')).toBe('見出し です');
  });

  it('名前が空なら箇所nを返す', () => {
    expect(spotDisplayName({ n: 3, label: '' })).toBe('箇所3');
    expect(spotDisplayName({ n: 3, label: '  \n ' })).toBe('箇所3');
    expect(spotDisplayName({ n: 3, label: 'ステータス表示' })).toBe('ステータス表示');
  });
});
