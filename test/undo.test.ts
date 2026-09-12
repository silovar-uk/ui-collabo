import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/storage', () => ({ kvGet: async () => undefined, kvSet: async () => {} }));

import { createBoard, currentBoard, deleteSpot, redo, toast, undo, updateBoard } from '../src/state';
import type { Spot } from '../src/schema';

function addSpot(label: string): Spot {
  const board = currentBoard.value!;
  const spot: Spot = {
    id: crypto.randomUUID(),
    pageId: 'p1',
    n: board.spots.length + 1,
    label,
    rect: { x: 0, y: 0, w: 0.1, h: 0.1 },
    keep: false,
    notes: [],
  };
  updateBoard((b) => ({ ...b, spots: [...b.spots, spot] }));
  return spot;
}

function setLabel(id: string, label: string): void {
  updateBoard((b) => ({ ...b, spots: b.spots.map((s) => (s.id === id ? { ...s, label } : s)) }));
}

describe('undo/redo(S5: 何度でも取り消せる)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    createBoard({ kind: 'web' });
  });

  it('3つの操作(500ms以上あけて)をCtrl+Z相当のundo()で3回戻せる', () => {
    vi.useFakeTimers();
    try {
      addSpot('A');
      vi.advanceTimersByTime(600);
      addSpot('B');
      vi.advanceTimersByTime(600);
      addSpot('C');
      expect(currentBoard.value!.spots.map((s) => s.label)).toEqual(['A', 'B', 'C']);
      undo();
      expect(currentBoard.value!.spots.map((s) => s.label)).toEqual(['A', 'B']);
      undo();
      expect(currentBoard.value!.spots.map((s) => s.label)).toEqual(['A']);
      undo();
      expect(currentBoard.value!.spots).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('undoしたあとredoでやり直せる', () => {
    addSpot('X');
    undo();
    expect(currentBoard.value!.spots).toEqual([]);
    redo();
    expect(currentBoard.value!.spots.map((s) => s.label)).toEqual(['X']);
  });

  it('500ms以内の連続更新は1段にまとめる(ラベルの打鍵で上書きされない)', () => {
    vi.useFakeTimers();
    try {
      const spot = addSpot('');
      vi.advanceTimersByTime(600); // 直前の積み込みから500msより後 → ここから新しい1段
      setLabel(spot.id, 'h');
      vi.advanceTimersByTime(100);
      setLabel(spot.id, 'he');
      vi.advanceTimersByTime(100);
      setLabel(spot.id, 'hel');
      expect(currentBoard.value!.spots[0].label).toBe('hel');
      undo();
      expect(currentBoard.value!.spots[0].label).toBe(''); // 1文字ずつではなく、まとめて戻る
    } finally {
      vi.useRealTimers();
    }
  });

  it('箇所を削除するとトーストが出て、元に戻すで復元できる', () => {
    vi.useFakeTimers();
    try {
      const spot = addSpot('消える箇所');
      vi.advanceTimersByTime(600); // 追加とは別の1段として積むため、500msより後にする
      deleteSpot(spot.id);
      expect(currentBoard.value!.spots).toEqual([]);
      expect(toast.value?.message).toContain('削除しました');
      toast.value?.onUndo?.();
      expect(currentBoard.value!.spots.map((s) => s.label)).toEqual(['消える箇所']);
    } finally {
      vi.useRealTimers();
    }
  });
});
