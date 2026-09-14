import { expect, test, type Page } from '@playwright/test';
import { baseBoard, seedBoards } from './helpers';

async function seedVisualDiffReview(page: Page) {
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
  await page.getByRole('button', { name: '差分候補を表示' }).click();
}

test('revision diff separates instructed and actionable changes', async ({ page }) => {
  await seedVisualDiffReview(page);

  const controls = page.locator('.visual-diff-controls');
  await expect(controls).toHaveAttribute('data-expected-spots', '1');
  await expect(controls).toHaveAttribute('data-pending-unexpected', '1');
  await expect(page.locator('.visual-diff-summary')).toContainText('指示対象 1');
  await expect(page.locator('.visual-diff-region.is-expected')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '要確認の差分候補 1' })).toBeVisible();
  await expect(page.locator('.visual-diff-summary')).toContainText('指示内 1');
  await expect(page.locator('.visual-diff-summary')).toContainText('要確認 1');
  await expect(page.getByText('要確認候補を押すと修正指示にできます。○/×は人が確認')).toBeVisible();
});

test('unexpected diff can become a normal Spot and continue the existing workflow', async ({ page }) => {
  await seedVisualDiffReview(page);

  await page.getByRole('button', { name: '要確認の差分候補 1' }).click();
  await expect(page.getByText('この変化をどうする？')).toBeVisible();
  await page.getByRole('button', { name: '修正指示にする' }).click();

  await expect(page.locator('.visual-diff-controls')).toHaveAttribute('data-pending-unexpected', '0');
  await expect(page.getByRole('button', { name: '要確認の差分候補 1' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '箇所2 想定外の変更' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.visual-diff-summary')).toContainText('要確認 0');
  await expect(page.getByText('指示化 1')).toBeVisible();
});

test('unexpected diff can be ignored only for the current screen session', async ({ page }) => {
  await seedVisualDiffReview(page);

  await page.getByRole('button', { name: '要確認の差分候補 1' }).click();
  await page.getByRole('button', { name: '今回は無視' }).click();

  await expect(page.locator('.visual-diff-controls')).toHaveAttribute('data-pending-unexpected', '0');
  await expect(page.locator('.visual-diff-summary')).toContainText('要確認 0');
  await expect(page.getByText('無視 1（再読み込みで戻る）')).toBeVisible();
});
