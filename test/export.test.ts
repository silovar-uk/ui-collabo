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

describe('boardToExportJson', () => {
  it('画像のdataUrlを含まない', () => {
    const json = boardToExportJson(makeDraftBoard()) as { pages: { image: unknown }[] };
    expect(JSON.stringify(json)).not.toContain('data:image');
    expect(json.pages[0].image).toEqual({ width: 1600, height: 900 });
  });
});
