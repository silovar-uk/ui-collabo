import { describe, expect, it } from 'vitest';
import { createRoundBoard, isProofed } from '../src/lib/round';
import { newBoard, type Spot } from '../src/schema';

function makeBoard(): ReturnType<typeof newBoard> {
  const board = newBoard({ kind: 'web' });
  board.imageRole = 'draft';
  board.pages = [{ id: 'p1', image: { dataUrl: 'x', width: 100, height: 100 } }];
  const spots: Spot[] = [
    { id: 's1', pageId: 'p1', n: 1, label: '見出し', rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, keep: false, notes: [{ id: 'n1', kind: 'text', text: '', chips: ['静かに'] }] },
    { id: 's2', pageId: 'p1', n: 2, label: 'ボタン', rect: { x: 0.1, y: 0.3, w: 0.2, h: 0.1 }, keep: false, notes: [{ id: 'n2', kind: 'text', text: '', chips: ['軽く'] }] },
  ];
  board.spots = spots;
  return board;
}

describe('R2: createRoundBoard', () => {
  it('前回の箇所をcarried:trueで複製し、タイトルに(再校)を付ける', () => {
    const prev = makeBoard();
    const next = createRoundBoard(prev, { id: 'p2', image: { dataUrl: 'y', width: 100, height: 100 } });
    expect(next.title).toBe(`${prev.title}(再校)`);
    expect(next.round).toEqual({ prevBoardId: prev.id, n: 2 });
    expect(next.spots).toHaveLength(2);
    expect(next.spots.every((s) => s.carried)).toBe(true);
    expect(next.spots.every((s) => s.check === undefined)).toBe(true);
    // 比率座標のまま複製する
    expect(next.spots[0].rect).toEqual(prev.spots[0].rect);
    expect(next.spots[0].id).not.toBe(prev.spots[0].id);
  });

  it('三校では n が3になる', () => {
    const prev = makeBoard();
    prev.round = { prevBoardId: 'x', n: 2 };
    const next = createRoundBoard(prev, { id: 'p2', image: null });
    expect(next.round?.n).toBe(3);
  });
});

describe('R2: isProofed', () => {
  it('持ち越した箇所がすべて○で、他に指定がなければ校了', () => {
    const board = createRoundBoard(makeBoard(), { id: 'p2', image: { dataUrl: 'y', width: 100, height: 100 } });
    board.spots = board.spots.map((s) => ({ ...s, check: 'ok' as const, notes: [], keep: true }));
    expect(isProofed(board)).toBe(true);
  });

  it('1つでも×なら校了ではない', () => {
    const board = createRoundBoard(makeBoard(), { id: 'p2', image: { dataUrl: 'y', width: 100, height: 100 } });
    board.spots = [
      { ...board.spots[0], check: 'ok', notes: [] },
      { ...board.spots[1], check: 'ng' },
    ];
    expect(isProofed(board)).toBe(false);
  });

  it('roundでないボードは校了にならない', () => {
    expect(isProofed(makeBoard())).toBe(false);
  });
});
