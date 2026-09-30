import { describe, expect, it } from 'vitest';
import { askBack } from '../src/lib/askBack';
import { newBoard, type Note, type Spot } from '../src/schema';

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 's1',
    pageId: 'p1',
    n: 1,
    label: '',
    rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
    keep: false,
    notes: [],
    ...overrides,
  };
}

function makeBoard(spots: Spot[], imageRole: 'draft' | 'reference' | null = 'draft') {
  const board = newBoard({ kind: 'web' });
  board.imageRole = imageRole;
  board.pages = [{ id: 'p1', image: { dataUrl: 'x', width: 100, height: 100 } }];
  board.spots = spots;
  return board;
}

describe('A1: 指示のない箇所', () => {
  it('出る: keepでなく、指示のない箇所', () => {
    const board = makeBoard([makeSpot()]);
    const items = askBack(board);
    expect(items.some((i) => i.type === 'empty' && i.spotId === 's1')).toBe(true);
  });

  it('出ない: 白紙レイアウト(imageRole===null)は対象外', () => {
    const board = makeBoard([makeSpot()], null);
    expect(askBack(board).some((i) => i.type === 'empty')).toBe(false);
  });

  it('答えると消える: 変えないを付ける、または指示を入れる', () => {
    const board = makeBoard([makeSpot({ keep: true })]);
    expect(askBack(board).some((i) => i.type === 'empty')).toBe(false);

    const specified = makeBoard([makeSpot({ notes: [{ id: 'n1', kind: 'wish', text: 'x' }] }) as Spot]);
    expect(askBack(specified).some((i) => i.type === 'empty')).toBe(false);
  });
});

describe('A2: 雰囲気チップだけ', () => {
  const toneNote: Note = { id: 'n1', kind: 'text', text: '', chips: ['主張を強く'] };

  it('出る: notesが雰囲気チップだけのtextノート1件', () => {
    const board = makeBoard([makeSpot({ notes: [toneNote] })]);
    const items = askBack(board);
    const item = items.find((i) => i.type === 'tone-only');
    expect(item).toMatchObject({ chip: '主張を強く' });
  });

  it('出ない: 自由文が添えてある、または他のノートも一緒にある', () => {
    const withText: Note = { id: 'n1', kind: 'text', text: 'もっと目立たせて', chips: ['主張を強く'] };
    expect(askBack(makeBoard([makeSpot({ notes: [withText] })])).some((i) => i.type === 'tone-only')).toBe(false);

    const withLadder: Note = { id: 'n2', kind: 'ladder', attr: 'fontSize', target: { step: 3 } };
    expect(askBack(makeBoard([makeSpot({ notes: [toneNote, withLadder] })])).some((i) => i.type === 'tone-only')).toBe(false);
  });

  it('答えると消える: 具体チップを適用して雰囲気だけでなくなる', () => {
    const board = makeBoard([
      makeSpot({ notes: [toneNote, { id: 'n2', kind: 'ladder', attr: 'fontSize', target: { delta: 1 } }] }),
    ]);
    expect(askBack(board).some((i) => i.type === 'tone-only')).toBe(false);
  });
});

describe('A3: 足す部品の文言が未定', () => {
  it('出る: label===undefinedのボタン・リンク・見出し', () => {
    const note: Note = { id: 'n1', kind: 'add', part: 'button', place: 'below' };
    const items = askBack(makeBoard([makeSpot({ notes: [note] })]));
    expect(items.find((i) => i.type === 'label')).toMatchObject({ part: 'button' });
  });

  it('出ない: 画像・アイコン等の部品、またはlabelが既にある', () => {
    const imageNote: Note = { id: 'n1', kind: 'add', part: 'image', place: 'below' };
    expect(askBack(makeBoard([makeSpot({ notes: [imageNote] })])).some((i) => i.type === 'label')).toBe(false);

    const labeled: Note = { id: 'n2', kind: 'add', part: 'button', place: 'below', label: '詳しく見る' };
    expect(askBack(makeBoard([makeSpot({ notes: [labeled] })])).some((i) => i.type === 'label')).toBe(false);
  });

  it('答えると消える: 文言を決める、またはおまかせにする', () => {
    const decided: Note = { id: 'n1', kind: 'add', part: 'button', place: 'below', label: '詳しく見る' };
    expect(askBack(makeBoard([makeSpot({ notes: [decided] })])).some((i) => i.type === 'label')).toBe(false);

    const left: Note = { id: 'n2', kind: 'add', part: 'button', place: 'below', label: '' };
    expect(askBack(makeBoard([makeSpot({ notes: [left] })])).some((i) => i.type === 'label')).toBe(false);
  });
});

describe('A4: 色の役割が未定', () => {
  it('出る: roleがないcolorノート', () => {
    const note: Note = { id: 'n1', kind: 'color', target: '#ff0000' };
    const items = askBack(makeBoard([makeSpot({ notes: [note] })]));
    expect(items.some((i) => i.type === 'color-role')).toBe(true);
  });

  it('出ない: roleが決まっているcolorノート', () => {
    const note: Note = { id: 'n1', kind: 'color', target: '#ff0000', role: 'text' };
    expect(askBack(makeBoard([makeSpot({ notes: [note] })])).some((i) => i.type === 'color-role')).toBe(false);
  });

  it('答えると消える: 役割を選ぶ', () => {
    const note: Note = { id: 'n1', kind: 'color', target: '#ff0000', role: 'bg' };
    expect(askBack(makeBoard([makeSpot({ notes: [note] })])).some((i) => i.type === 'color-role')).toBe(false);
  });
});

describe('A5: セレクタが頼りない要素', () => {
  function htmlSpot(overrides: Partial<Spot> = {}): Spot {
    return makeSpot({ element: { selector: 'div:nth-child(2)', tag: 'div', computed: {} }, ...overrides });
  }

  it('出る: nth-childのセレクタで、文字列も名前もない', () => {
    expect(askBack(makeBoard([htmlSpot()])).some((i) => i.type === 'selector')).toBe(true);
  });

  it('出ない: 要素に文字列がある、または名前が付いている', () => {
    expect(askBack(makeBoard([htmlSpot({ element: { selector: 'div:nth-child(2)', tag: 'div', text: '申し込む', computed: {} } })])).some((i) => i.type === 'selector')).toBe(false);
    expect(askBack(makeBoard([htmlSpot({ label: 'CTAボタン' })])).some((i) => i.type === 'selector')).toBe(false);
  });

  it('答えると消える: 名前を付ける', () => {
    expect(askBack(makeBoard([htmlSpot({ label: '申し込みボタン' })])).some((i) => i.type === 'selector')).toBe(false);
  });
});
