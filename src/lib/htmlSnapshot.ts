import { buildFrameHtml } from './html';
import type { PageSource } from '../schema';

// 2.3のスパイクで確認済み: foreignObject経由のcanvas描画で足りるため、html2canvas等の依存は追加しない
const MAX_CANVAS_EDGE = 16000;
const TIMEOUT_MS = 5000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

/** 4隅+中央の画素がすべて同じ(=真っ白などの無地)なら、描画に失敗したとみなす。 */
function isBlankCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const points: [number, number][] = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), Math.floor(h / 2)],
  ];
  let first: string | null = null;
  for (const [x, y] of points) {
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    const key = `${r},${g},${b},${a}`;
    if (first === null) first = key;
    else if (key !== first) return false;
  }
  return true;
}

async function renderSnapshot(source: PageSource): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  Object.assign(iframe.style, { position: 'fixed', left: '-99999px', top: '0', width: `${source.width}px`, height: `${source.height}px`, border: '0' });
  document.body.appendChild(iframe);

  try {
    const loaded = new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('読み込みに失敗しました'));
    });
    iframe.srcdoc = buildFrameHtml(source);
    await loaded;

    const doc = iframe.contentDocument;
    if (!doc) return null;
    await doc.fonts?.ready?.catch(() => {});

    // 校正紙は「いま」を写す: プレビュー用style・ホバー用styleとCSPのmetaを除く
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('#uic-preview, #uic-hover, #uic-audit-hover, meta[http-equiv="Content-Security-Policy" i]').forEach((el) => el.remove());
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

    const serialized = new XMLSerializer().serializeToString(clone);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height}"><foreignObject width="100%" height="100%">${serialized}</foreignObject></svg>`;
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

    const scale = Math.min(1, MAX_CANVAS_EDGE / source.width, MAX_CANVAS_EDGE / source.height);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    if (isBlankCanvas(ctx, width, height)) return null;
    return { dataUrl: canvas.toDataURL('image/png'), width, height };
  } finally {
    iframe.remove();
  }
}

/** 4.9: HTMLページを「いま」のまま1枚の画像にする。失敗・タイムアウト・真っ白ならnull(送り状は止めない)。 */
export async function snapshotHtmlPage(source: PageSource): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    return await Promise.race([
      renderSnapshot(source),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}
