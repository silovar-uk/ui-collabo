import { describe, expect, it } from 'vitest';
import { boardToMarkdown, boardToExportJson } from '../src/export';
import { newBoard, type Spot } from '../src/schema';

function makeDraftBoard() {
  const board = newBoard({ kind: 'slide', aspect: '16:9' });
  board.imageRole = 'draft';
  board.pages = [{ id: 'p1', image: { dataUrl: 'data:image/jpeg;base64,x', width: 1600, height: 900 } }];
  const spots: Spot[] = [
    {
      id: 's1',
      pageId: 'p1',
      n: 1,
      label: '見出し',
      rect: { x: 0.08, y: 0.12, w: 0.6, h: 0.1 },
      targetRect: { x: 0.08, y: 0.08, w: 0.6, h: 0.1 },
      keep: false,
      notes: [],
    },
    {
      id: 's2',
      pageId: 'p1',
      n: 2,
      label: 'ロゴ',
      rect: { x: 0.8, y: 0.8, w: 0.15, h: 0.1 },
      keep: true,
      notes: [],
    },
  ];
  board.spots = spots;
  return board;
}

describe('boardToMarkdown', () => {
  it('draft: 位置の差分と変えないものを出力する', () => {
    const md = boardToMarkdown(makeDraftBoard());
    expect(md).toContain('種類: 修正指示(初校に対して)');
    expect(md).toContain('## 箇所ごと');
    expect(md).toContain('上へ');
    expect(md).toContain('## 変えないもの');
    expect(md).toContain('2 ロゴ');
  });

  it('白紙: レイアウト節にゾーン付きで出力する', () => {
    const board = newBoard({ kind: 'web' });
    board.pages = [{ id: 'p1', image: null }];
    board.spots = [
      { id: 's1', pageId: 'p1', n: 1, label: 'タイトル', rect: { x: 0.08, y: 0.1, w: 0.6, h: 0.12 }, keep: false, notes: [] },
    ];
    const md = boardToMarkdown(board);
    expect(md).toContain('種類: 制作前の指定');
    expect(md).toContain('## レイアウト');
    expect(md).toContain('左上');
  });
});

describe('S7: 今を出力に届ける', () => {
  it('currentがあるラダーは「今 → こうしたい」の形で出す(deltaはcurrent起点)', () => {
    const board = makeDraftBoard();
    // fontSize steps: [12,14,16,18,20,24,32,40,56] -> current=5(24px)、delta-1 → 20px
    board.spots[0].notes = [{ id: 'n1', kind: 'ladder', attr: 'fontSize', current: 5, target: { delta: -1 } }];
    const md = boardToMarkdown(board);
    expect(md).toContain('文字サイズ: 24px → 20px(少し小さく)');
  });

  it('currentがなければ従来どおり相対チップの言葉だけを出す', () => {
    const board = makeDraftBoard();
    board.spots[0].notes = [{ id: 'n1', kind: 'ladder', attr: 'fontSize', target: { delta: -1 } }];
    const md = boardToMarkdown(board);
    expect(md).toContain('- 文字サイズ: 少し小さく');
  });
});

describe('S9: 中身のない箇所を渡さない', () => {
  it('draft: ノートなし・位置差分なしの箇所は出力に含めない', () => {
    const board = makeDraftBoard();
    board.spots[0].notes = [];
    board.spots[0].targetRect = undefined;
    const md = boardToMarkdown(board);
    expect(md).not.toContain('1 見出し');
    expect(md).not.toContain('## 箇所ごと');
  });

  it('白紙(レイアウト)はノートがなくても位置そのものが内容として出力する', () => {
    const board = newBoard({ kind: 'web' });
    board.pages = [{ id: 'p1', image: null }];
    board.spots = [
      { id: 's1', pageId: 'p1', n: 1, label: 'タイトル', rect: { x: 0.08, y: 0.1, w: 0.6, h: 0.12 }, keep: false, notes: [] },
    ];
    const md = boardToMarkdown(board);
    expect(md).toContain('## レイアウト');
    expect(md).toContain('1 タイトル');
  });
});

describe('S10: 複数ページを取り違えない', () => {
  it('3枚のスライドで、箇所がページごとの見出しに分かれる', () => {
    const board = newBoard({ kind: 'slide', aspect: '16:9' });
    board.imageRole = 'draft';
    board.pages = [
      { id: 'p1', image: { dataUrl: 'x', width: 1280, height: 720 } },
      { id: 'p2', image: { dataUrl: 'x', width: 1280, height: 720 } },
      { id: 'p3', image: { dataUrl: 'x', width: 1280, height: 720 } },
    ];
    board.spots = [
      { id: 's1', pageId: 'p1', n: 1, label: '1枚目の見出し', rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 }, keep: false, notes: [{ id: 'n1', kind: 'text', text: '', chips: ['静かに'] }] },
      { id: 's2', pageId: 'p2', n: 2, label: '2枚目の見出し', rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 }, keep: false, notes: [{ id: 'n2', kind: 'text', text: '', chips: ['軽く'] }] },
      { id: 's3', pageId: 'p3', n: 3, label: '3枚目の見出し', rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 }, keep: false, notes: [{ id: 'n3', kind: 'text', text: '', chips: ['遊びを'] }] },
    ];
    const md = boardToMarkdown(board);
    expect(md).toContain('## p.1');
    expect(md).toContain('## p.2');
    expect(md).toContain('## p.3');
    // p.1の見出しがp.2の見出しより前にある
    expect(md.indexOf('## p.1')).toBeLessThan(md.indexOf('1枚目の見出し'));
    expect(md.indexOf('1枚目の見出し')).toBeLessThan(md.indexOf('## p.2'));
    expect(md).toContain('、3ページ');
  });

  it('1ページのときは従来どおり「## 箇所ごと」で、p.見出しは付かない', () => {
    const md = boardToMarkdown(makeDraftBoard());
    expect(md).toContain('## 箇所ごと');
    expect(md).not.toContain('## p.1');
  });
});

describe('boardToExportJson', () => {
  it('画像のdataUrlを含まない', () => {
    const json = boardToExportJson(makeDraftBoard()) as { pages: { image: unknown }[] };
    expect(JSON.stringify(json)).not.toContain('data:image');
    expect(json.pages[0].image).toEqual({ width: 1600, height: 900 });
  });
});
