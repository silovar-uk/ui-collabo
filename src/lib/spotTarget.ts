import type { Board, Rect, Spot } from '../schema';
import { updateBoard } from '../state';

export interface SpotEditTarget {
  rect: Rect;
  /** true = draft画像に対する「こうしたい」の点線コピー。false = 箇所そのものが置きたい位置。 */
  dashed: boolean;
  apply: (next: Rect) => void;
}

/** 選択中の箇所について、動かす対象が targetRect(draft画像あり)か rect そのもの(白紙/参考)かを判定する。 */
export function getSpotEditTarget(board: Board, spot: Spot): SpotEditTarget {
  const page = board.pages.find((p) => p.id === spot.pageId);
  const dashed = board.imageRole === 'draft' && !!page?.image;
  if (dashed) {
    return {
      rect: spot.targetRect ?? spot.rect,
      dashed: true,
      apply: (next) => updateBoard((b) => ({ ...b, spots: b.spots.map((s) => (s.id === spot.id ? { ...s, targetRect: next } : s)) })),
    };
  }
  return {
    rect: spot.rect,
    dashed: false,
    apply: (next) => updateBoard((b) => ({ ...b, spots: b.spots.map((s) => (s.id === spot.id ? { ...s, rect: next } : s)) })),
  };
}
