import { describe, expect, it } from 'vitest';
import { intentSuggestions, isIntentApplied, toggleIntent } from '../src/lib/intents';
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

  it('要素付き(HTML)の箇所には位置(position:*)を出さない', () => {
    const htmlSpot = makeSpot({ element: { selector: 'h1', tag: 'h1', computed: {} } });
    const labels = intentSuggestions('', htmlSpot).map((item) => item.label);
    expect(labels).not.toContain('左右中央に置きたい');
    const searchLabels = intentSuggestions('中央', htmlSpot).map((item) => item.label);
    expect(searchLabels.every((l) => !l.includes('位置'))).toBe(true);

    const imageSpot = makeSpot();
    expect(intentSuggestions('', imageSpot).map((item) => item.label)).toContain('左右中央に置きたい');
  });
});

describe('フェーズC: isIntentApplied / toggleIntent', () => {
  it('keepは適用済みならspot.keepで判定し、トグルで外れる', () => {
    const spot = makeSpot({ keep: true });
    expect(isIntentApplied('keep', spot)).toBe(true);
    const board = toggleIntent(makeBoard(spot), spot, 'keep');
    expect(board.spots[0].keep).toBe(false);
  });

  it('tone:*はひとことのchipsに含まれるかで判定し、トグルで追加・除去する', () => {
    const spot = makeSpot();
    expect(isIntentApplied('tone:主張を強く', spot)).toBe(false);
    const added = toggleIntent(makeBoard(spot), spot, 'tone:主張を強く');
    const addedSpot = added.spots[0];
    expect(isIntentApplied('tone:主張を強く', addedSpot)).toBe(true);
    const removed = toggleIntent(added, addedSpot, 'tone:主張を強く');
    expect(isIntentApplied('tone:主張を強く', removed.spots[0])).toBe(false);
  });

  it('ladder:attr:deltaは同じ属性のtarget.deltaが一致するかで判定し、トグルで外れる', () => {
    const spot = makeSpot();
    expect(isIntentApplied('ladder:scale:1', spot)).toBe(false);
    const added = toggleIntent(makeBoard(spot), spot, 'ladder:scale:1');
    const addedSpot = added.spots[0];
    expect(isIntentApplied('ladder:scale:1', addedSpot)).toBe(true);
    expect(isIntentApplied('ladder:scale:-1', addedSpot)).toBe(false);
    const removed = toggleIntent(added, addedSpot, 'ladder:scale:1');
    expect(removed.spots[0].notes.some((n) => n.kind === 'ladder' && n.attr === 'scale')).toBe(false);
  });
});
