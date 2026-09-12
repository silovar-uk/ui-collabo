import { describe, expect, it } from 'vitest';
import { buildHandoffManifest } from '../src/lib/handoff';
import { newBoard } from '../src/schema';

describe('Handoff Product Contract', () => {
  it('複数画像ページを1ページ目だけに潰さない', () => {
    const board = newBoard({ kind: 'slide', aspect: '16:9' });
    board.imageRole = 'draft';
    board.pages = [1, 2, 3].map((n) => ({ id: `p${n}`, image: { dataUrl: `img${n}`, width: 1280, height: 720 } }));
    const manifest = buildHandoffManifest(board);
    expect(manifest.imagePageIds).toEqual(['p1', 'p2', 'p3']);
    expect(manifest.htmlPageIds).toEqual([]);
  });

  it('HTMLページはソース添付対象として識別する', () => {
    const board = newBoard({ kind: 'web' });
    board.imageRole = 'draft';
    board.pages = [{ id: 'html1', image: null, source: { kind: 'html', html: '<html></html>', allowExternal: false, width: 1280, height: 800 } }];
    const manifest = buildHandoffManifest(board);
    expect(manifest.htmlPageIds).toEqual(['html1']);
    expect(manifest.imagePageIds).toEqual([]);
  });
});
