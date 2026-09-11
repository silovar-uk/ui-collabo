import { hexToRgb } from './color';

export interface PaletteColor {
  hex: string;
  share: number;
}

const MERGE_DISTANCE = 24;
const MIN_SHARE = 0.01;

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => v.toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * R1-b: 画像の色を棚卸しする。事前に短辺200px程度に縮小したdataを渡す想定(呼び出し側の責任)。
 * 各チャンネルの上位4bitで量子化して集計し、近い色(RGB距離24以内)は多い方へまとめる。
 */
export function extractPalette(data: Uint8ClampedArray, max = 8): PaletteColor[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) continue; // ほぼ透明な画素は数えない
    const r = data[i] & 0xf0;
    const g = data[i + 1] & 0xf0;
    const b = data[i + 2] & 0xf0;
    const key = toHex(r, g, b);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total++;
  }
  if (total === 0) return [];

  const entries = Array.from(counts.entries())
    .map(([hex, count]) => ({ hex, count, rgb: hexToRgb(hex) }))
    .sort((a, b) => b.count - a.count);

  const merged: { hex: string; count: number; rgb: [number, number, number] }[] = [];
  for (const entry of entries) {
    const near = merged.find((m) => {
      const [r1, g1, b1] = m.rgb;
      const [r2, g2, b2] = entry.rgb;
      return Math.hypot(r1 - r2, g1 - g2, b1 - b2) <= MERGE_DISTANCE;
    });
    if (near) near.count += entry.count;
    else merged.push(entry);
  }

  return merged
    .sort((a, b) => b.count - a.count)
    .map((m) => ({ hex: m.hex, share: m.count / total }))
    .filter((c) => c.share >= MIN_SHARE)
    .slice(0, max);
}
