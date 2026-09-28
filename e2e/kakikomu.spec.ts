import { expect, test } from '@playwright/test';
import { baseBoard, seedBoard } from './helpers';

const PRICING_HTML = `<!doctype html><html><head><title>料金プラン</title><style>body{font-family:sans-serif;margin:0;background:#fafafa;color:#222}header{background:#1c1b19;color:#fff;padding:18px 40px;font-size:20px}.hero{padding:60px 40px}.hero h1{font-size:44px;margin:0 0 12px}.cards{display:flex;gap:24px;padding:0 40px 60px}.card{flex:1;background:#fff;border:1px solid #ddd;border-radius:6px;padding:24px}.card button{margin-top:16px;padding:10px 18px;background:#3266cc;color:#fff;border:0;border-radius:4px}</style></head><body><header>MyService</header><section class="hero"><h1>シンプルな料金プラン</h1></section><div class="cards"><div class="card"><h2>Free</h2><button>はじめる</button></div><div class="card"><h2>Pro</h2><button>申し込む</button></div><div class="card"><h2>Business</h2><button>相談する</button></div></div></body></html>`;

function htmlBoard() {
  return baseBoard([
    { id: 'p1', image: null, source: { kind: 'html', html: PRICING_HTML, allowExternal: false, width: 1280, height: 500 } },
  ]);
}

/** window.open・clipboard.writeを差し替え、呼ばれた引数を集める(4.10)。 */
async function stubDelivery(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    (window as any).__opens = [];
    (window as any).__clips = [];
    window.open = (...args: unknown[]) => {
      (window as any).__opens.push(args[0]);
      return { closed: false } as unknown as Window;
    };
    if (navigator.clipboard) {
      // @ts-expect-error test stub
      navigator.clipboard.write = async (items: unknown) => {
        (window as any).__clips.push(items);
      };
    }
  });
}

test('書くと、部品が生えて渡る(03書く→04渡す)', async ({ page }) => {
  await seedBoard(page, htmlBoard());
  const frame = page.frameLocator('iframe.html-frame');
  await frame.getByText('申し込む', { exact: true }).click();

  const write = page.getByPlaceholder('書き込む 例: 下にボタン「詳しく見る」を足す');
  await expect(write).toBeVisible();

  // 読み取り: 「下にボタン「詳しく見る」を足す」→ Enterで実線の部品になる
  await write.fill('下にボタン「詳しく見る」を足す');
  await expect(page.locator('.write-row', { hasText: '下に ボタン「詳しく見る」' })).toBeVisible();
  await write.press('Enter');
  await expect(page.locator('.add-part').filter({ hasText: '詳しく見る' })).toBeVisible();
  await expect(page.getByText('足す: 下に ボタン「詳しく見る」')).toBeVisible();
  await expect(write).toHaveValue('');

  // そのまま: 読み取れない文はEnterで要望になる
  await write.fill('もっと親しみやすい雰囲気にしたい');
  await write.press('Enter');
  await expect(page.getByText('要望: 「もっと親しみやすい雰囲気にしたい」')).toBeVisible();

  // 04 渡す: 送り状を開く
  await page.getByRole('button', { name: /AIに渡す/ }).click();
  await expect(page.getByText('AIに届く校正紙')).toBeVisible();
  await expect(page.getByText('送り状')).toBeVisible();

  // 1回の押下で、クリップボードへ書いてから新しいタブを開く(4.10)
  await stubDelivery(page);
  await page.getByRole('button', { name: 'ChatGPTで開く' }).click();
  await expect(page.getByText('届けました。')).toBeVisible();
  const opens = await page.evaluate(() => (window as any).__opens as string[]);
  expect(opens).toHaveLength(1);
  expect(opens[0]).toContain('https://chatgpt.com/?prompt=');
  expect(decodeURIComponent(opens[0])).toContain('下にボタン「詳しく見る」を足す');

  // Escで作業面へ戻る
  await page.keyboard.press('Escape');
  await expect(page.getByText('AIに届く校正紙')).toHaveCount(0);
});

test('聞き返し: まだ指示がない箇所は先回りで出て、答えると消える', async ({ page }) => {
  await seedBoard(page, htmlBoard());
  const frame = page.frameLocator('iframe.html-frame');

  // 「AIに渡す」を押せる状態にするため、別の箇所には指示を入れておく
  await frame.getByText('申し込む', { exact: true }).click();
  await page.getByRole('button', { name: 'もっと目立たせたい' }).click();

  // 指示を入れないまま選択解除して、指示なしの箇所として残す
  await frame.getByText('はじめる', { exact: true }).click();
  await page.getByRole('button', { name: '選択を解除' }).click();

  await page.getByRole('button', { name: /AIに渡す/ }).click();
  await expect(page.getByText('まだ指示がありません(このままでは渡されません)')).toBeVisible();

  await page.getByRole('button', { name: '変えない' }).click();
  await expect(page.getByText('まだ指示がありません(このままでは渡されません)')).toHaveCount(0);
});
