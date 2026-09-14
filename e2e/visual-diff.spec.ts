import { expect, test } from '@playwright/test';
import { baseBoard, seedBoards } from './helpers';

test('revision diff separates instructed and uninstructed changes', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/');

  const images = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 64, 64);
    const before = canvas.toDataURL('image/png');

    ctx.fillStyle = '#000000';
    ctx.fillRect(4, 4, 16, 16);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(44, 44, 16, 16);
    const after = canvas.toDataURL('image/png');

    return { before, after };
  });

  const prevPage = {
    id: 'prev-page',
    label: 'Page',
    image: { dataUrl: images.before, width: 64, height: 64 },
  };
  const currentPage = {
    id: 'current-page',
    label: 'Page',
    image: { dataUrl: images.after, width: 64, height: 64 },
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
  const controls = page.locator('.visual-diff-controls');
  await expect(controls).toHaveAttribute('data-expected-spots', '1');
  await page.getByRole('button', { name: '差分候補を表示' }).click();

  await expect(page.locator('.visual-diff-summary')).toContainText('指示対象 1');
  await expect(page.locator('.visual-diff-region.is-expected')).toHaveCount(1);
  await expect(page.locator('.visual-diff-region.is-unexpected')).toHaveCount(1);
  await expect(page.locator('.visual-diff-summary')).toContainText('指示内 1');
  await expect(page.locator('.visual-diff-summary')).toContainText('想定外 1');
  await expect(page.getByText('候補表示のみ。○/×は人が確認')).toBeVisible();
});
