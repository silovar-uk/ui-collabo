import { describe, expect, it } from 'vitest';
import { parseWish, pickVocab } from '../src/lib/wishParse';

describe('parseWish', () => {
  it('下にボタン「詳しく見る」を足す', () => {
    expect(parseWish('下にボタン「詳しく見る」を足す')).toEqual({
      kind: 'add', part: 'button', place: 'below', label: '詳しく見る', said: '下にボタン「詳しく見る」を足す',
    });
  });

  it('下にボタン(動詞なし・部品名で終わる)', () => {
    expect(parseWish('下にボタン')).toEqual({ kind: 'add', part: 'button', place: 'below', label: undefined, said: '下にボタン' });
  });

  it('ボタンの下に余白を広げたい → null(部品名は位置語より前)', () => {
    expect(parseWish('ボタンの下に余白を広げたい')).toBeNull();
  });

  it('上品なボタンを足したい', () => {
    const r = parseWish('上品なボタンを足したい');
    expect(r).toMatchObject({ kind: 'add', part: 'button', place: 'below' });
  });

  it('右に画像を置きたい', () => {
    expect(parseWish('右に画像を置きたい')).toMatchObject({ kind: 'add', part: 'image', place: 'right' });
  });

  it('見出しの上に小見出しを追加', () => {
    expect(parseWish('見出しの上に小見出しを追加')).toMatchObject({ kind: 'add', part: 'heading', place: 'above' });
  });

  it('右上にアイコンを付けて', () => {
    expect(parseWish('右上にアイコンを付けて')).toMatchObject({ kind: 'add', part: 'icon', place: 'right' });
  });

  it('区切り線を入れたい', () => {
    expect(parseWish('区切り線を入れたい')).toMatchObject({ kind: 'add', part: 'line', place: 'below' });
  });

  it('これ消して / この見出しはいらない → remove', () => {
    expect(parseWish('これ消して')).toEqual({ kind: 'remove', said: 'これ消して' });
    expect(parseWish('この見出しはいらない')).toEqual({ kind: 'remove', said: 'この見出しはいらない' });
  });

  it('消さないで / そのままにしてほしい → null', () => {
    expect(parseWish('消さないで')).toBeNull();
    expect(parseWish('そのままにしてほしい')).toBeNull();
  });

  it('ボタンは足さない / 余白が足りない / 中央に置きたい → null', () => {
    expect(parseWish('ボタンは足さない')).toBeNull();
    expect(parseWish('余白が足りない')).toBeNull();
    expect(parseWish('中央に置きたい')).toBeNull();
  });

  it('足す・消すの両方に当たる文 → null(要望として残す)', () => {
    expect(parseWish('ボタンを消して代わりにリンクを置く')).toBeNull();
  });

  it('もっと目立たせて大きく / ずっと小さく → null(pickVocabの対象)', () => {
    expect(parseWish('もっと目立たせて大きく')).toBeNull();
    expect(parseWish('ずっと小さく')).toBeNull();
  });
});

describe('pickVocab', () => {
  it('ボタンの下に余白を広げたい → 余白+1', () => {
    expect(pickVocab('ボタンの下に余白を広げたい')).toEqual([{ id: 'ladder:spacing:1', label: '余白: 少し広げる' }]);
  });

  it('上品なボタンを足したい → tone:上品に', () => {
    expect(pickVocab('上品なボタンを足したい')).toEqual([{ id: 'tone:上品に', label: 'ひとこと: 上品に' }]);
  });

  it('消さないで / そのままにしてほしい → keep', () => {
    expect(pickVocab('消さないで')).toEqual([{ id: 'keep', label: '変えない(この箇所を固定)' }]);
    expect(pickVocab('そのままにしてほしい')).toEqual([{ id: 'keep', label: '変えない(この箇所を固定)' }]);
  });

  it('もっと目立たせて大きく → tone:主張を強く、fontSize+1、scale+1', () => {
    expect(pickVocab('もっと目立たせて大きく')).toEqual([
      { id: 'tone:主張を強く', label: 'ひとこと: 主張を強く' },
      { id: 'ladder:fontSize:1', label: '文字サイズ: 少し大きく' },
      { id: 'ladder:scale:1', label: '全体の大きさ: 少し大きく' },
    ]);
  });

  it('ずっと小さく → fontSize-2、scale-2', () => {
    expect(pickVocab('ずっと小さく')).toEqual([
      { id: 'ladder:fontSize:-2', label: '文字サイズ: ずっと小さく' },
      { id: 'ladder:scale:-2', label: '全体の大きさ: ずっと小さく' },
    ]);
  });
});
