import type { Page } from '@playwright/test';

type SeedBoard = Record<string, unknown>;

export async function seedBoard(page: Page, board: SeedBoard) {
  await page.goto('/');
  await page.locator('#app').waitFor();
  await page.evaluate(async (seed) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('ui-collabo', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const put = (key: string, value: unknown) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await put('library', { schema: 'ui-collabo/1', boards: [seed], templates: [], ruleSets: [] });
    await put('lastBoardId', String(seed.id));
    db.close();
  }, board);
  await page.reload();
}

export function baseBoard(pages: unknown[]) {
  return {
    schema: 'ui-collabo/1',
    id: 'e2e-board',
    title: 'E2E Board',
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    format: { kind: 'web' },
    imageRole: 'draft',
    pages,
    spots: [],
    rules: { palette: [], type: [], motion: [], tone: [] },
    tone: { chips: [], text: '' },
    order: [],
  };
}
