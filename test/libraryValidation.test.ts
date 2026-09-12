import { describe, expect, it } from 'vitest';
import { emptyLibrary, newBoard } from '../src/schema';
import { parseLibraryJson, repairStoredLibrary, validateLibrary } from '../src/lib/libraryValidation';

function validJson() {
  const lib = emptyLibrary();
  const board = newBoard({ kind: 'web' });
  board.pages = [{ id: 'p1', image: null }];
  board.spots = [{ id: 's1', pageId: 'p1', n: 1, label: '見出し', rect: { x: .1, y: .1, w: .3, h: .1 }, keep: false, notes: [] }];
  board.order = ['s1'];
  lib.boards = [board];
  return JSON.stringify(lib);
}

describe('library runtime validation', () => {
  it('正常なライブラリを受け付ける', () => {
    expect(parseLibraryJson(validJson()).boards).toHaveLength(1);
  });

  it('壊れたJSONを拒否する', () => {
    expect(() => parseLibraryJson('{oops')).toThrow('JSON形式が壊れています');
  });

  it('存在しないpageId参照を拒否する', () => {
    const parsed = JSON.parse(validJson());
    parsed.boards[0].spots[0].pageId = 'missing';
    expect(() => parseLibraryJson(JSON.stringify(parsed))).toThrow('存在しないページ');
  });

  it('重複したSpot番号を拒否する', () => {
    const parsed = JSON.parse(validJson());
    parsed.boards[0].spots.push({ ...parsed.boards[0].spots[0], id: 's2' });
    expect(() => parseLibraryJson(JSON.stringify(parsed))).toThrow('重複しています');
  });
});


describe('stored library repair', () => {
  it('過去の重複した箇所番号を配列順で振り直してから検証できる', () => {
    const lib = emptyLibrary();
    const board = newBoard({ kind: 'web' });
    board.pages = [{ id: 'p1', image: null }];
    board.spots = [
      { id: 's1', pageId: 'p1', n: 1, label: 'A', rect: { x: 0, y: 0, w: 0.2, h: 0.2 }, keep: false, notes: [] },
      { id: 's2', pageId: 'p1', n: 1, label: 'B', rect: { x: 0.3, y: 0, w: 0.2, h: 0.2 }, keep: false, notes: [] },
    ];
    lib.boards = [board];
    const repaired = validateLibrary(repairStoredLibrary(lib));
    expect(repaired.boards[0].spots.map((s) => s.n)).toEqual([1, 2]);
  });
});
