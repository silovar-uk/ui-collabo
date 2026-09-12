import { describe, expect, it } from 'vitest';
import { describeComputed } from '../src/lib/describeElement';

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
