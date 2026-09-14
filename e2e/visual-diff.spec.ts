import { expect, test } from '@playwright/test';
import { baseBoard, seedBoards } from './helpers';

function svgDataUrl(body: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/>${body}</svg>`)}`;
}

test('revision diff separates instructed and uninstructed changes', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });

  const prevPage = {
    id: 'prev-page',
    label: 'Page',
    image: { dataUrl: svgDataUrl(''), width: 64, height: 64 },
  };
  const currentPage = {
    id: 'current-page',
    label: 'Page',
    image: {
      dataUrl: svgDataUrl('<rect x="4" y="4" width="16" height="16" fill="black"/><rect x="44" y="44" width="16" height="16" fill="red"/>'),
      width: 64,
      height: 64,
    },
  };

  const previous = { ...baseBoard([prevPage]), id: 'prev', title: 'Visual Review' };
  const current = {
    ...baseBoard([currentPage]),
    id: 'current',
    title: 'Visual Review(再校)',
    round: { prevBoardId: 'prev', n: 2 },
    spots: [
      {
        id: 'spot-1',
        pageId: 'current-page',
        n: 1,
        label: 'expected change',
        rect: { x: 0.02, y: 0.02, w: 0.38, h: 0.38 },
        keep: false,
        carried: true,
        notes: [{ id: 'note-1', kind: 'text', text: 'ここを変更', chips: [] }],
      },
    ],
    order: ['spot-1'],
  };

  await seedBoards(page, [previous, current], 'current');
  await page.getByRole('button', { name: '差分候補を表示' }).click();

  await expect(page.locator('.visual-diff-region.is-expected')).toHaveCount(1);
  await expect(page.locator('.visual-diff-region.is-unexpected')).toHaveCount(1);
  await expect(page.locator('.visual-diff-summary')).toContainText('指示内 1');
  await expect(page.locator('.visual-diff-summary')).toContainText('想定外 1');
  await expect(page.getByText('候補表示のみ。○/×は人が確認')).toBeVisible();
});
