import type { Board, Spot } from '../schema';

export interface NumericChange {
  from: number;
  to: number;
  delta: number;
}

export interface GeometryChanges {
  x?: NumericChange;
  y?: NumericChange;
  width?: NumericChange;
  height?: NumericChange;
}

const EPSILON = 1e-6;

function change(from: number, to: number): NumericChange | undefined {
  if (Math.abs(from - to) <= EPSILON) return undefined;
  return { from, to, delta: to - from };
}

/**
 * 画面上の「今」と「こうしたい」の矩形差分を、表示文言から独立した意味データへ変換する。
 * x/y/width/height は独立して扱う。出力側で都合よく一つに潰さない。
 */
export function geometryChanges(spot: Spot): GeometryChanges {
  if (!spot.targetRect) return {};
  return {
    x: change(spot.rect.x, spot.targetRect.x),
    y: change(spot.rect.y, spot.targetRect.y),
    width: change(spot.rect.w, spot.targetRect.w),
    height: change(spot.rect.h, spot.targetRect.h),
  };
}

export function hasGeometryChanges(spot: Spot): boolean {
  const changes = geometryChanges(spot);
  return !!(changes.x || changes.y || changes.width || changes.height);
}

/**
 * S9/Product Contract: 「囲っただけ」と「実際に伝える指示」を分ける共通判定。
 * 白紙レイアウトは位置そのものが意味なので呼び出し側で別扱いにする。
 */
export function hasSpecifiedContent(spot: Spot, board: Board): boolean {
  if (spot.notes.length > 0) return true;
  return board.imageRole === 'draft' && hasGeometryChanges(spot);
}
