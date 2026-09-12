import { hexToRgb } from './color';

const VERMILION: [number, number, number] = [228, 87, 46];

/** R1-b: 画素データのうち、hexに近い(距離tolerance以内)画素だけを朱で残し、他は透明にする。 */
export function buildHighlightMask(data: Uint8ClampedArray, hex: string, tolerance = 24): Uint8ClampedArray {
  const [tr, tg, tb] = hexToRgb(hex);
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - tr;
    const dg = data[i + 1] - tg;
    const db = data[i + 2] - tb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tolerance) {
      out[i] = VERMILION[0];
      out[i + 1] = VERMILION[1];
      out[i + 2] = VERMILION[2];
      out[i + 3] = 220;
    }
  }
  return out;
}
