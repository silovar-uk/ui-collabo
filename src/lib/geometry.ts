import type { Board, Format, Page, Rect } from '../schema';

/** 白紙ページの見た目上のアスペクト比を決める仮の寸法(実データには保存しない)。 */
export function nominalCanvasSize(format: Format): { width: number; height: number } {
  if (format.kind === 'slide') {
    return format.aspect === '16:9' ? { width: 1280, height: 720 } : { width: 1280, height: 960 };
  }
  if (format.kind === 'web') return { width: 1280, height: 1600 };
  return { width: 1280, height: 800 };
}

/** ページの基準寸法。HTMLはsource、画像はimage、白紙はnominalCanvasSizeを返す。 */
export function pageCanvasSize(board: Board, page: Page): { width: number; height: number } {
  if (page.source) return { width: page.source.width, height: page.source.height };
  if (page.image) return { width: page.image.width, height: page.image.height };
  return nominalCanvasSize(board.format);
}

export type FitMode = 'whole' | 'width';

export interface FitResult {
  mode: FitMode;
  autoMode: FitMode;
  scale: number;
  width: number;
  height: number;
}

// ponytail: 全体/幅の自動切替のしきい値。0.5は目安、実機で不自然なら調整してdocs/DECISIONS.mdに理由を書く
const WHOLE_RATIO_THRESHOLD = 0.5;

/** 作業面の内側(areaW×areaH)にページ(pageW×pageH)をどう収めるか決める。 */
export function fitBoard(areaW: number, areaH: number, pageW: number, pageH: number, preferred: FitMode | null): FitResult {
  if (areaW <= 0 || pageW <= 0 || pageH <= 0) {
    return { mode: 'width', autoMode: 'width', scale: 0, width: 0, height: 0 };
  }
  const wide = Math.min(areaW / pageW, 1);
  const whole = areaH > 0 ? Math.min(areaW / pageW, areaH / pageH) : 0;
  const autoMode: FitMode = areaH > 0 && whole / wide >= WHOLE_RATIO_THRESHOLD ? 'whole' : 'width';
  const mode = preferred ?? autoMode;
  const scale = mode === 'whole' ? whole : wide;
  return { mode, autoMode, scale, width: pageW * scale, height: pageH * scale };
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
