import { describe, expect, it } from 'vitest';
import { deriveWorkflowState } from '../src/lib/workflow';
import { SCHEMA, emptyRules, type Board, type Spot } from '../src/schema';

function makeBoard(overrides: Partial<Board> = {}): Board {
  return {
    schema: SCHEMA,
    id: 'b1',
    title: 'Board',
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    format: { kind: 'web' },
    imageRole: 'draft',
    pages: [],
    spots: [],
    rules: emptyRules(),
    tone: { chips: [], text: '' },
    order: [],
    ...overrides,
  };
}

function spot(overrides: Partial<Spot> = {}): Spot {
  return { id: 's1', pageId: 'p1', n: 1, label: '', rect: { x: 0, y: 0, w: .2, h: .2 }, keep: false, notes: [], ...overrides };
}

describe('deriveWorkflowState', () => {
  it('empty → input / page → mark / spot → define', () => {
    expect(deriveWorkflowState(makeBoard())).toBe('input');
    expect(deriveWorkflowState(makeBoard({ pages: [{ id: 'p1', image: null }] }))).toBe('mark');
    expect(deriveWorkflowState(makeBoard({ pages: [{ id: 'p1', image: null }], spots: [spot()] }))).toBe('define');
  });

  it('指示があればhandoff', () => {
    const s = spot({ notes: [{ id: 'n1', kind: 'text', text: '直す', chips: [] }] });
    expect(deriveWorkflowState(makeBoard({ pages: [{ id: 'p1', image: null }], spots: [s] }))).toBe('handoff');
  });

  it('再校の未判定carriedはverify', () => {
    const s = spot({ carried: true, notes: [{ id: 'n1', kind: 'text', text: '直す', chips: [] }] });
    expect(deriveWorkflowState(makeBoard({ round: { prevBoardId: 'prev', n: 2 }, pages: [{ id: 'p1', image: null }], spots: [s] }))).toBe('verify');
  });

  it('再校で×または新規指示があればhandoffへ戻る', () => {
    const ng = spot({ carried: true, check: 'ng', notes: [{ id: 'n1', kind: 'text', text: 'まだ', chips: [] }] });
    expect(deriveWorkflowState(makeBoard({ round: { prevBoardId: 'prev', n: 2 }, pages: [{ id: 'p1', image: null }], spots: [ng] }))).toBe('handoff');
    const fresh = spot({ carried: false, notes: [{ id: 'n2', kind: 'text', text: '追加', chips: [] }] });
    expect(deriveWorkflowState(makeBoard({ round: { prevBoardId: 'prev', n: 2 }, pages: [{ id: 'p1', image: null }], spots: [fresh] }))).toBe('handoff');
  });

  it('すべてのcarriedがokならproofed', () => {
    const done = spot({ carried: true, check: 'ok', keep: true, notes: [] });
    expect(deriveWorkflowState(makeBoard({ round: { prevBoardId: 'prev', n: 2 }, pages: [{ id: 'p1', image: null }], spots: [done] }))).toBe('proofed');
  });
});
