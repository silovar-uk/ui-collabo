import { describe, expect, it } from 'vitest';
import { buildLineages, revisionLabel } from '../src/lib/lineage';
import { SCHEMA, emptyRules, type Board } from '../src/schema';

function board(id: string, round?: { prevBoardId: string; n: number }): Board {
  return {
    schema: SCHEMA,
    id,
    title: round ? 'Landing(再校)' : 'Landing',
    createdAt: `2026-09-1${round?.n ?? 1}T00:00:00.000Z`,
    updatedAt: `2026-09-1${round?.n ?? 1}T00:00:00.000Z`,
    format: { kind: 'web' },
    imageRole: 'draft',
    pages: [],
    spots: [],
    rules: emptyRules(),
    tone: { chips: [], text: '' },
    order: [],
    round,
  };
}

describe('revision lineage', () => {
  it('prevBoardIdで初校・再校・三校を1つに束ねる', () => {
    const first = board('a');
    const second = board('b', { prevBoardId: 'a', n: 2 });
    const third = board('c', { prevBoardId: 'b', n: 3 });
    const groups = buildLineages([third, first, second]);
    expect(groups).toHaveLength(1);
    expect(groups[0].boards.map((b) => b.id)).toEqual(['a', 'b', 'c']);
    expect(groups[0].root.id).toBe('a');
    expect(revisionLabel(first)).toBe('初校');
    expect(revisionLabel(second)).toBe('再校');
    expect(revisionLabel(third)).toBe('第3校');
  });

  it('参照先が無い孤児版は自身をrootとして残す', () => {
    const orphan = board('x', { prevBoardId: 'missing', n: 2 });
    expect(buildLineages([orphan])[0].root.id).toBe('x');
  });
});
