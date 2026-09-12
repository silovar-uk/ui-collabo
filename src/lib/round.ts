import { hasSpecifiedContent } from '../export';
import type { Board, Page } from '../schema';

/**
 * R2: 直った版を貼って照合するための、新しいボード(再校)を作る。
 * 前回すでに「残す」だった(指示のない)箇所は、確かめる対象がないため持ち越さない。
 * 指示があった箇所だけをcarried:trueで複製する(比率座標のまま)。
 */
export function createRoundBoard(prev: Board, newPage: Page): Board {
  const now = new Date().toISOString();
  const carrySpots = prev.spots.filter((s) => hasSpecifiedContent(s, prev));
  return {
    ...prev,
    id: crypto.randomUUID(),
    title: `${prev.title}(再校)`,
    createdAt: now,
    updatedAt: now,
    round: { prevBoardId: prev.id, n: (prev.round?.n ?? 1) + 1 },
    pages: [{ ...newPage, id: newPage.id }],
    spots: carrySpots.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      pageId: newPage.id,
      carried: true,
      check: undefined,
      keep: false,
      targetRect: undefined,
    })),
    order: [],
  };
}

/** R2: 持ち越した箇所がすべて○になり、ほかに指定もないとき「校了」。 */
export function isProofed(board: Board): boolean {
  if (!board.round) return false;
  const carried = board.spots.filter((s) => s.carried);
  if (carried.length === 0) return false;
  if (!carried.every((s) => s.check === 'ok')) return false;
  const others = board.spots.filter((s) => !s.carried);
  return others.every((s) => !hasSpecifiedContent(s, board));
}
