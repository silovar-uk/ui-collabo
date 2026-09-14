import { expect, test } from '@playwright/test';
import { baseBoard, seedBoard } from './helpers';

test('HTML iframe keeps captured viewport for media queries', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const html = '<!doctype html><html><head><style>.box{width:100px;height:20px}@media(max-width:500px){.box{width:50px}}</style></head><body><div class="box">responsive</div></body></html>';
  const board = baseBoard([{ id: 'p1', label: 'Responsive', image: null, source: { kind: 'html', html, allowExternal: false, width: 390, height: 844, capture: { viewportWidth: 390, viewportHeight: 844, devicePixelRatio: 3 } } }]);
  await seedBoard(page, board);
  const box = page.frameLocator('iframe.html-frame').locator('.box');
  await expect(box).toBeVisible();
  expect(await box.evaluate((el) => getComputedStyle(el).width)).toBe('50px');
  await expect(page.getByText('VIEWPORT')).toBeVisible();
});
