const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.9;

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** UIスクリーンショットの文字・細線を守るため、PNGはPNGのまま。写真系のみJPEG圧縮する。 */
export async function fileToImage(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    return bitmapToImage(bitmap, file.type);
  } finally {
    bitmap.close();
  }
}

function bitmapToImage(bitmap: ImageBitmap, sourceType: string): LoadedImage {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context を取得できませんでした');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const outputType = sourceType === 'image/png' ? 'image/png' : sourceType === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const dataUrl = outputType === 'image/jpeg' ? canvas.toDataURL(outputType, JPEG_QUALITY) : canvas.toDataURL(outputType);
  return { dataUrl, width, height };
}

/** clipboard paste イベントから画像ファイルを抽出する。files / items 両方を見る。 */
export function extractImageFiles(data: DataTransfer): File[] {
  const files: File[] = [];
  for (const f of Array.from(data.files ?? [])) {
    if (f.type.startsWith('image/')) files.push(f);
  }
  if (files.length === 0) {
    for (const item of Array.from(data.items ?? [])) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
  }
  return files;
}

/** 画像端でもgetImageDataがcanvas外へ出ないように、サンプル範囲を内側へ収める。 */
export function sampleBounds(width: number, height: number, x: number, y: number, size = 5) {
  const half = Math.floor(size / 2);
  const x0 = Math.max(0, Math.min(Math.max(0, width - 1), Math.round(x) - half));
  const y0 = Math.max(0, Math.min(Math.max(0, height - 1), Math.round(y) - half));
  const w = Math.max(1, Math.min(size, width - x0));
  const h = Math.max(1, Math.min(size, height - y0));
  return { x: x0, y: y0, w, h };
}

/** 画像の比率座標(0..1)から 5x5px 平均色を hex でサンプルする(スポイト用)。 */
export function sampleImageColor(image: { dataUrl: string; width: number; height: number }, ratioX: number, ratioY: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas 2d context を取得できませんでした'));
      ctx.drawImage(img, 0, 0, image.width, image.height);
      const x = Math.round(ratioX * (image.width - 1));
      const y = Math.round(ratioY * (image.height - 1));
      resolve(samplePixelAverage(ctx, x, y));
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = image.dataUrl;
  });
}

/** 5x5px の平均色を hex で返す(スポイト用)。 */
export function samplePixelAverage(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const bounds = sampleBounds(ctx.canvas.width, ctx.canvas.height, x, y);
  const data = ctx.getImageData(bounds.x, bounds.y, bounds.w, bounds.h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  const toHex = (v: number) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
