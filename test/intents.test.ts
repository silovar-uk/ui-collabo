import { describe, expect, it } from 'vitest';
import { intentSuggestions } from '../src/lib/intents';
import { newBoard, type Spot } from '../src/schema';
import { boardToMarkdown } from '../src/export';

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: 's1',
    pageId: 'p1',
    n: 1,
    label: '見出し',
    rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
    keep: false,
    notes: [],
    ...overrides,
  };
}

function makeBoard(spot: Spot) {
  const board = newBoard({ kind: 'web' });
  board.imageRole = 'draft';
  board.pages = [{ id: 'p1', image: { dataUrl: 'x', width: 100, height: 100 } }];
  board.spots = [spot];
  return board;
}

describe('intentSuggestions', () => {
  it('空入力では人の意図から始められる候補を返す', () => {
    const labels = intentSuggestions('').map((item) => item.label);
    expect(labels).toContain('もっと目立たせたい');
    expect(labels).toContain('少し弱めたい');
    expect(labels).toContain('ここは変えたくない');
  });

  it('検索入力は既存command検索へつなぐ', () => {
    const labels = intentSuggestions('ちいさ').map((item) => item.label);
    expect(labels).toContain('文字サイズ: 少し小さく');
  });

  it('意図候補を適用しても既存のexport contractを使う', () => {
    const spot = makeSpot();
    const suggestion = intentSuggestions('').find((item) => item.label === '少し大きくしたい');
    expect(suggestion).toBeDefined();
    const board = suggestion!.command.apply(makeBoard(spot), spot);
    expect(boardToMarkdown(board)).toContain('全体の大きさ: 少し大きく');
  });

  it('変えたくない意図はkeepへ変換される', () => {
    const spot = makeSpot();
    const suggestion = intentSuggestions('').find((item) => item.label === 'ここは変えたくない');
    const board = suggestion!.command.apply(makeBoard(spot), spot);
    expect(board.spots[0].keep).toBe(true);
  });
});
