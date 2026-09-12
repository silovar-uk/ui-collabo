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

describe('Product Contract: multi-page round', () => {
  it('複数ページのSpotを対応する新ページへ維持する', () => {
    const prev = newBoard({ kind: 'slide', aspect: '16:9' });
    prev.imageRole = 'draft';
    prev.pages = [
      { id: 'old1', image: { dataUrl: 'a', width: 100, height: 100 } },
      { id: 'old2', image: { dataUrl: 'b', width: 100, height: 100 } },
    ];
    prev.spots = [
      { id: 's1', pageId: 'old1', n: 1, label: 'p1', rect: { x: .1, y: .1, w: .2, h: .2 }, keep: false, notes: [{ id: 'n1', kind: 'text', text: 'A', chips: [] }] },
      { id: 's2', pageId: 'old2', n: 2, label: 'p2', rect: { x: .2, y: .2, w: .2, h: .2 }, keep: false, notes: [{ id: 'n2', kind: 'text', text: 'B', chips: [] }] },
    ];
    const next = createRoundBoard(prev, [
      { id: 'new1', image: { dataUrl: 'c', width: 100, height: 100 } },
      { id: 'new2', image: { dataUrl: 'd', width: 100, height: 100 } },
    ]);
    expect(next.pages.map((p) => p.id)).toEqual(['new1', 'new2']);
    expect(next.spots.find((s) => s.n === 1)?.pageId).toBe('new1');
    expect(next.spots.find((s) => s.n === 2)?.pageId).toBe('new2');
  });

  it('ページ数が違う再校は拒否する', () => {
    const prev = makeBoard();
    expect(() => createRoundBoard(prev, [
      { id: 'a', image: null },
      { id: 'b', image: null },
    ])).toThrow('1ページ必要');
  });

  it('位置だけの未反映指示はtargetRectを失わない', () => {
    const prev = makeBoard();
    prev.spots[0].notes = [];
    prev.spots[0].targetRect = { ...prev.spots[0].rect, x: 0.2 };
    const next = createRoundBoard(prev, { id: 'p2', image: { dataUrl: 'y', width: 100, height: 100 } });
    expect(next.spots[0].targetRect?.x).toBe(0.2);
  });

  it('元からkeepの箇所と○済みの箇所を次の再校でも固定として維持する', () => {
    const prev = makeBoard();
    prev.spots.push({ id: 'keep', pageId: 'p1', n: 3, label: 'ロゴ', rect: { x: .7, y: .1, w: .2, h: .1 }, keep: true, notes: [] });
    prev.spots[0].carried = true;
    prev.spots[0].check = 'ok';
    prev.spots[0].keep = true;
    const next = createRoundBoard(prev, { id: 'p2', image: { dataUrl: 'y', width: 100, height: 100 } });
    const verified = next.spots.find((s) => s.n === 1)!;
    const immutable = next.spots.find((s) => s.n === 3)!;
    expect(verified.keep).toBe(true);
    expect(verified.check).toBe('ok');
    expect(verified.notes).toEqual([]);
    expect(immutable.keep).toBe(true);
    expect(immutable.carried).toBe(false);
  });
});
