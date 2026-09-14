import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const emptySource = readFileSync(new URL('../src/panels/Empty.tsx', import.meta.url), 'utf8');

describe('lab home layout contract', () => {
  it('旧empty-screenの880px制約をLABトップへ再適用しない', () => {
    expect(emptySource).toContain('<div class="lab-home">');
    expect(emptySource).not.toContain('empty-screen lab-home');
  });

  it('旧empty-intakeのgrid制約を新intake gridへ再適用しない', () => {
    expect(emptySource).toContain('<div class="lab-intake-grid">');
    expect(emptySource).not.toContain('empty-intake lab-intake-grid');
  });
});
