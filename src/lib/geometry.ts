import type { Format, Rect } from '../schema';

/** 白紙ページの見た目上のアスペクト比を決める仮の寸法(実データには保存しない)。 */
export function nominalCanvasSize(format: Format): { width: number; height: number } {
  if (format.kind === 'slide') {
    return format.aspect === '16:9' ? { width: 1280, height: 720 } : { width: 1280, height: 960 };
  }
  if (format.kind === 'web') return { width: 1280, height: 1600 };
  return { width: 1280, height: 800 };
}

export interface ContainRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** object-fit: contain で画像を container 内に描画したときの実表示矩形(container内座標)。 */
export function containRect(containerW: number, containerH: number, imageW: number, imageH: number): ContainRect {
  if (imageW <= 0 || imageH <= 0 || containerW <= 0 || containerH <= 0) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / imageW, containerH / imageH);
  const width = imageW * scale;
  const height = imageH * scale;
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}

/** container内のピクセル座標(px)を、表示画像に対する 0..1 の比率矩形へ変換する。 */
export function pxToRatio(px: Rect, cr: ContainRect): Rect {
  return {
    x: (px.x - cr.left) / cr.width,
    y: (px.y - cr.top) / cr.height,
    w: px.w / cr.width,
    h: px.h / cr.height,
  };
}

/** 0..1 の比率矩形を、container内のピクセル座標(px)へ変換する。 */
export function ratioToPx(ratio: Rect, cr: ContainRect): Rect {
  return {
    x: ratio.x * cr.width + cr.left,
    y: ratio.y * cr.height + cr.top,
    w: ratio.w * cr.width,
    h: ratio.h * cr.height,
  };
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function clampRect(r: Rect): Rect {
  const x = clamp01(r.x);
  const y = clamp01(r.y);
  const w = Math.min(1 - x, Math.max(0, r.w));
  const h = Math.min(1 - y, Math.max(0, r.h));
  return { x, y, w, h };
}
