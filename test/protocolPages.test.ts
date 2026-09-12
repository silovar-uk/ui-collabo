import { describe, expect, it } from 'vitest';
import { newBoard, type Spot } from '../src/schema';
import { protocolGroupCount, protocolPageGroups } from '../src/lib/protocolPages';

function spot(id: string, pageId: string, n: number): Spot {
  return {
    id,
    pageId,
    n,
    label: `spot-${n}`,
    rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 },
    keep: false,
    notes: [],
  };
}

function boardFixture() {
  const board = newBoard({ kind: 'web' });
  board.pages = [
    { id: 'p1', label: 'Home', image: null },
    { id: 'p2', label: 'Detail', image: null },
    { id: 'p3', label: 'Form', image: null },
  ];
  board.spots = [spot('s1', 'p1', 1), spot('s2', 'p2', 2), spot('s3', 'p2', 3), spot('s4', 'p3', 4)];
  return board;
}

describe('protocolPageGroups', () => {
  it('moves the active page to the front without changing the remaining page order', () => {
    const board = boardFixture();
    const groups = protocolPageGroups(board, 'p2', ['s1', 's2', 's3', 's4'], []);
    expect(groups.map((group) => group.page.id)).toEqual(['p2', 'p1', 'p3']);
    expect(groups[0].active).toBe(true);
  });

  it('keeps instructions and empty spots inside their own page group', () => {
    const board = boardFixture();
    const groups = protocolPageGroups(board, 'p1', ['s1', 's2'], [board.spots[2], board.spots[3]]);
    const p2 = groups.find((group) => group.page.id === 'p2')!;
    const p3 = groups.find((group) => group.page.id === 'p3')!;
    expect(p2.spotIds).toEqual(['s2']);
    expect(p2.emptySpots.map((item) => item.id)).toEqual(['s3']);
    expect(protocolGroupCount(p2)).toBe(2);
    expect(protocolGroupCount(p3)).toBe(1);
  });

  it('falls back to page order when the active page is missing', () => {
    const board = boardFixture();
    const groups = protocolPageGroups(board, 'missing', ['s1'], []);
    expect(groups.map((group) => group.page.id)).toEqual(['p1', 'p2', 'p3']);
    expect(groups.every((group) => !group.active)).toBe(true);
  });
});
