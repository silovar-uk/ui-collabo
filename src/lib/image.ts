const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** 画像ファイルを長辺1600px以内に縮小し、JPEGのdataURLにして返す。 */
export async function fileToImage(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    return bitmapToImage(bitmap);
  } finally {
    bitmap.close();
  }
}

function bitmapToImage(bitmap: ImageBitmap): LoadedImage {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context を取得できませんでした');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
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
      const x = Math.round(ratioX * image.width);
      const y = Math.round(ratioY * image.height);
      resolve(samplePixelAverage(ctx, x, y));
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = image.dataUrl;
  });
}

/** 5x5px の平均色を hex で返す(スポイト用)。 */
export function samplePixelAverage(ctx: CanvasRenderingContext2D, x: number, y: number): string {
  const size = 5;
  const half = Math.floor(size / 2);
  const data = ctx.getImageData(Math.max(0, x - half), Math.max(0, y - half), size, size).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
