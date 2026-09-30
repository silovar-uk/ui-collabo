import type { AddPart, AddPlace, Rect } from '../schema';
import { clampRect } from './geometry';

/** 4.3: 部品の既定の大きさ(ページpx)。0は「箇所の幅を使う」の印。 */
const PART_SIZE_PX: Record<AddPart, [number, number]> = {
  button: [160, 44],
  link: [120, 26],
  heading: [420, 40],
  text: [420, 56],
  image: [300, 170],
  icon: [44, 44],
  input: [320, 42],
  line: [0, 3],
  box: [0, 110],
};

const GAP_PX = 14;

export interface PageSize {
  width: number;
  height: number;
}

/** 部品の既定位置。箇所から14px離して置き、ページ外にはみ出さないよう丸める。 */
export function defaultAddRect(part: AddPart, place: AddPlace, spotRect: Rect, pageSize: PageSize): Rect {
  const spotPx = { x: spotRect.x * pageSize.width, y: spotRect.y * pageSize.height, w: spotRect.w * pageSize.width, h: spotRect.h * pageSize.height };
  const [w0, h0] = PART_SIZE_PX[part];
  let w = w0 || spotPx.w;
  const h = part === 'box' ? Math.min(Math.max(spotPx.h, 60), 140) : h0;
  w = Math.min(w, Math.max(spotPx.w, 120));

  const positions: Record<AddPlace, [number, number]> = {
    below: [spotPx.x, spotPx.y + spotPx.h + GAP_PX],
    above: [spotPx.x, spotPx.y - GAP_PX - h],
    left: [spotPx.x - GAP_PX - w, spotPx.y],
    right: [spotPx.x + spotPx.w + GAP_PX, spotPx.y],
    inside: [spotPx.x + 8, spotPx.y + spotPx.h - h - 8],
  };
  const [rawX, rawY] = positions[place];
  const x = Math.max(0, Math.min(pageSize.width - w, rawX));
  const y = Math.max(0, Math.min(pageSize.height - h, rawY));
  return clampRect({ x: x / pageSize.width, y: y / pageSize.height, w: w / pageSize.width, h: h / pageSize.height });
}

/** 部品の中心が箇所に対してどちら側にあるかを判定する(ratio空間でも同じ比較で成り立つ)。 */
export function placeOf(rect: Rect, spotRect: Rect): AddPlace {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (cy > spotRect.y + spotRect.h) return 'below';
  if (cy < spotRect.y) return 'above';
  if (cx < spotRect.x) return 'left';
  if (cx > spotRect.x + spotRect.w) return 'right';
  return 'inside';
}
