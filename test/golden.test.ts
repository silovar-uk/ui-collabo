import { describe, expect, it } from 'vitest';
import { boardToMarkdown } from '../src/export';
import { SAMPLES } from '../src/samples';
import { newBoard, type Spot } from '../src/schema';

/**
 * 出力の金型。以降、出力が変わってよいのは意図した項目(S7・S9・S10・H2・R2)だけ。
 * その場合はスナップショットを見直して更新する(`vitest run -u`)。
 */
describe('golden: boardToMarkdown', () => {
  it('サンプル: Webページ', () => {
    expect(boardToMarkdown(SAMPLES[0].board)).toMatchSnapshot();
  });

  it('サンプル: スライド', () => {
    expect(boardToMarkdown(SAMPLES[1].board)).toMatchSnapshot();
  });

  it('HTMLページの箇所を持つボード', () => {
    const board = newBoard({ kind: 'web' });
    board.title = 'HTMLサンプル';
    board.pages = [
      {
        id: 'p1',
        image: null,
        source: { kind: 'html', html: '<h1>Hi</h1>', allowExternal: false, width: 1280, height: 800 },
      },
    ];
    const spots: Spot[] = [
      {
        id: 's1',
        pageId: 'p1',
        n: 1,
        label: '見出し',
        rect: { x: 0.1, y: 0.1, w: 0.5, h: 0.1 },
        keep: false,
        notes: [{ id: 'n1', kind: 'ladder', attr: 'fontSize', target: { delta: -1 } }],
        element: { selector: '.hero > h1', tag: 'h1', text: 'Hi', computed: { 'font-size': '32px' } },
      },
    ];
    board.spots = spots;
    expect(boardToMarkdown(board)).toMatchSnapshot();
  });
});
