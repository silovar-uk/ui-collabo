import { expect, test } from '@playwright/test';
import { baseBoard, seedBoard } from './helpers';

const pages = [
  { id: 'p1', label: 'First', image: null },
  { id: 'p2', label: 'Second', image: null },
];

test('mobile can switch pages without specimen rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedBoard(page, baseBoard(pages));
  await expect(page.locator('.specimen-rail')).toBeHidden();
  await expect(page.locator('.mobile-page-pager')).toBeVisible();
  await expect(page.getByText('First', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '次のページ' }).click();
  await expect(page.getByText('Second', { exact: true })).toBeVisible();
});

test('desktop keeps specimen rail and hides compact pager', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedBoard(page, baseBoard(pages));
  await expect(page.locator('.specimen-rail')).toBeVisible();
  await expect(page.locator('.mobile-page-pager')).toBeHidden();
});
