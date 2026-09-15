import { expect, test } from '@playwright/test';
import { baseBoard, seedBoard } from './helpers';

// PLAN-FIT-FLOW.md 第11章の合成HTML。本物のメモの取り込みデータは使わない。
const APP_HTML = `<!doctype html><html lang="ja"><head><style>
*{box-sizing:border-box}body{margin:0;overflow:hidden;background:#07090C;color:#E6EDF5;font:14px system-ui,sans-serif}
.vault{height:100dvh;display:grid;grid-template-rows:36px 1fr 28px}
.content{display:grid;grid-template-columns:288px 1fr;min-height:0}
.side{overflow:auto;border-right:1px solid #223}.item{padding:10px 14px}.item b{display:block}
.editor{padding:40px 32px}.status{display:flex;gap:24px;padding:0 12px;border-top:1px solid #223;font:10px monospace}
</style></head><body><main class="vault">
<header class="bar">PRIVATE MEMO</header>
<section class="content"><aside class="side"><div class="item"><b>リンク集</b><span>- スケッチ風のやつ</span></div></aside>
<article class="editor"><h1>AIでやること</h1></article></section>
<footer class="status"><button id="save-status">◇ IDLE</button> <button>↶ 0</button></footer>
</main></body></html>`;

function memoBoard() {
  return baseBoard([
    {
      id: 'p1',
      label: 'Memo',
      image: null,
      source: { kind: 'html', html: APP_HTML, allowExternal: false, width: 1280, height: 64, capture: { viewportWidth: 1280, viewportHeight: 800 } },
    },
  ]);
}

test.describe('フェーズA: 作業面の全体表示', () => {
  test('overflow指定のないアプリ画面は、iframeの高さが800pxになり作業列に縦スクロールが出ない', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    await seedBoard(page, memoBoard());
    const iframe = page.locator('iframe.html-frame');
    await expect(iframe).toBeVisible();
    await expect.poll(() => iframe.evaluate((el) => (el as HTMLIFrameElement).style.height)).toBe('800px');
    const column = page.locator('.board-column.lab-bench');
    await expect.poll(() => column.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });

  test('縦長のページは幅合わせでスクロールし、「全体」を押すとスクロールなしになる', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    const tallHtml = '<!doctype html><html><body style="margin:0"><div style="height:3600px"></div></body></html>';
    const board = baseBoard([{ id: 'p1', label: 'Tall', image: null, source: { kind: 'html', html: tallHtml, allowExternal: false, width: 1280, height: 3600 } }]);
    await seedBoard(page, board);
    const column = page.locator('.board-column.lab-bench');
    await expect.poll(() => column.evaluate((el) => el.scrollHeight > el.clientHeight + 1)).toBe(true);
    await page.getByRole('button', { name: '全体', exact: true }).click();
    await expect.poll(() => column.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });
});

test.describe('フェーズB/C: 選択・細かく指定・選択中パネル', () => {
  test('iframe内の要素を選ぶと選択中の枠が出て、Escで外れる', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    await seedBoard(page, memoBoard());
    // iframeをtransform:scaleで縮めているため、座標クリックではなくdispatchEventで選ぶ(B8関連)
    await page.frameLocator('iframe.html-frame').locator('h1').dispatchEvent('click');
    await expect(page.getByRole('button', { name: '選択を解除' })).toBeVisible();
    const focusedSpotId = await page.evaluate(() => document.activeElement?.getAttribute('data-spot-id'));
    expect(focusedSpotId).toBeTruthy();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '選択を解除' })).toBeHidden();
  });

  test('候補「もっと目立たせたい」を押すと、行が増えて✓が付く。もう一度押すと外れる', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    await seedBoard(page, memoBoard());
    await page.frameLocator('iframe.html-frame').locator('h1').dispatchEvent('click');
    const chip = page.locator('.selected-spot .intent-chip', { hasText: 'もっと目立たせたい' });
    await chip.click();
    const line = page.locator('.selected-spot .sheet-line', { hasText: '主張を強く' });
    await expect(line).toBeInViewport();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await expect(line).toBeHidden();
  });

  test('最上部の要素を選んでも、細かく指定バーが作業面の内側に収まる', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 640 });
    await seedBoard(page, memoBoard());
    await page.frameLocator('iframe.html-frame').locator('header.bar').dispatchEvent('click');
    const bar = page.locator('.palette-bar');
    const surface = page.locator('.board-surface');
    await expect(bar).toBeVisible();
    const barBox = await bar.boundingBox();
    const surfaceBox = await surface.boundingBox();
    expect(barBox).not.toBeNull();
    expect(surfaceBox).not.toBeNull();
    expect(barBox!.y).toBeGreaterThanOrEqual(surfaceBox!.y - 1);
    expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(surfaceBox!.y + surfaceBox!.height + 1);
    expect(barBox!.x).toBeGreaterThanOrEqual(surfaceBox!.x - 1);
    expect(barBox!.x + barBox!.width).toBeLessThanOrEqual(surfaceBox!.x + surfaceBox!.width + 1);
  });
});
