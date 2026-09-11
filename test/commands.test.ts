import { describe, expect, it } from 'vitest';
import { buildCommands, searchCommands } from '../src/lib/commands';
import { newBoard, type Spot } from '../src/schema';
import { boardToMarkdown } from '../src/export';

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return { id: 's1', pageId: 'p1', n: 1, label: '見出し', rect: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, keep: false, notes: [], ...overrides };
}

function makeBoard(spot: Spot) {
  const board = newBoard({ kind: 'web' });
  board.imageRole = 'draft';
  board.pages = [{ id: 'p1', image: { dataUrl: 'x', width: 100, height: 100 } }];
  board.spots = [spot];
  return board;
}

describe('R4: searchCommands', () => {
  const commands = buildCommands();

  it('「ちいさ」でヒットした候補を適用すると、文字サイズ: 少し小さくの行が増える', () => {
    const hits = searchCommands(commands, 'ちいさ');
    const cmd = hits.find((c) => c.label === '文字サイズ: 少し小さく');
    expect(cmd).toBeDefined();
    const spot = makeSpot();
    const board = cmd!.apply(makeBoard(spot), spot);
    expect(boardToMarkdown(board)).toContain('文字サイズ: 少し小さく');
  });

  it('「ふわ」で下からふわっとが候補に出る', () => {
    const hits = searchCommands(commands, 'ふわ');
    expect(hits.some((c) => c.label.includes('下からふわっと'))).toBe(true);
  });

  it('表記でもkanaでも一致する', () => {
    expect(searchCommands(commands, '静かに').length).toBeGreaterThan(0);
    expect(searchCommands(commands, 'しずかに').length).toBeGreaterThan(0);
  });

  it('空文字では何も返さない', () => {
    expect(searchCommands(commands, '')).toEqual([]);
  });

  it('残すコマンドはkeepを反転する', () => {
    const cmd = commands.find((c) => c.id === 'keep')!;
    const spot = makeSpot({ keep: false });
    const board = cmd.apply(makeBoard(spot), spot);
    expect(board.spots[0].keep).toBe(true);
  });
});
