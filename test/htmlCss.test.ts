import { describe, expect, it } from 'vitest';
import { resolveLadder } from '../src/lib/htmlCss';
import type { Note } from '../src/schema';

type LadderNote = Extract<Note, { kind: 'ladder' }>;

function ladderNote(target: LadderNote['target']): LadderNote {
  return { id: 'n1', kind: 'ladder', attr: 'fontSize', target };
}

describe('resolveLadder', () => {
  it('現在値32pxにdelta -1で1段小さい24pxへ解決する', () => {
    const r = resolveLadder('fontSize', ladderNote({ delta: -1 }), '32px');
    expect(r).toEqual({ from: '32px', to: '24px' });
  });

  it('範囲外へのdeltaは末尾の段にクランプする', () => {
    const r = resolveLadder('fontSize', ladderNote({ delta: -5 }), '12px');
    expect(r).toEqual({ from: '12px', to: '12px' });
    const r2 = resolveLadder('fontSize', ladderNote({ delta: 5 }), '56px');
    expect(r2).toEqual({ from: '56px', to: '56px' });
  });

  it('現在値がない場合、delta指定は解決できずnullを返す', () => {
    expect(resolveLadder('fontSize', ladderNote({ delta: -1 }), undefined)).toBeNull();
  });

  it('step指定は現在値の有無によらずそのまま採用する', () => {
    const r = resolveLadder('fontSize', ladderNote({ step: 2 }), '32px');
    expect(r).toEqual({ from: '32px', to: '16px' });
  });
});
