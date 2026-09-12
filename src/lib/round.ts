import { hasSpecifiedContent } from './instructions';
import type { Board, Page, Spot } from '../schema';

function normalizePages(prev: Board, next: Page | Page[]): Page[] {
  const pages = Array.isArray(next) ? next : [next];
  if (pages.length !== prev.pages.length) {
    throw new Error(`再校画像は前回と同じ${prev.pages.length}ページ必要です(選択: ${pages.length}ページ)`);
  }
  return pages.map((page, index) => ({
    ...page,
    label: page.label ?? prev.pages[index]?.label,
  }));
}

/**
 * R2/Product Contract: 直った版を貼って照合するための再校ボードを作る。
 * - ページはindex対応を維持し、全Spotを1ページへ潰さない
 * - 未反映の指示はnotes/targetRectごと持ち越す
 * - ○済みは「前回修正済み」として固定し、次のAI指示へ再登場させない
 * - 元からkeepの箇所も制約として持ち越す
 */
export function createRoundBoard(prev: Board, next: Page | Page[]): Board {
  const pages = normalizePages(prev, next);
  const pageIdMap = new Map(prev.pages.map((page, index) => [page.id, pages[index].id]));
  const now = new Date().toISOString();
  const spotIdMap = new Map<string, string>();

  const carrySpots = prev.spots.filter((spot) => spot.keep || hasSpecifiedContent(spot, prev));
  const spots: Spot[] = carrySpots.map((spot) => {
    const id = crypto.randomUUID();
    spotIdMap.set(spot.id, id);
    const verified = spot.carried && spot.check === 'ok';
    const immutable = spot.keep && !spot.carried;
    const pending = !spot.keep && hasSpecifiedContent(spot, prev);

    return {
      ...spot,
      id,
      pageId: pageIdMap.get(spot.pageId) ?? pages[0].id,
      carried: verified || pending ? true : immutable ? false : spot.carried,
      check: verified ? 'ok' : pending ? undefined : spot.check,
      keep: verified || immutable || (spot.keep && !pending),
      notes: verified ? [] : spot.notes,
      targetRect: verified ? undefined : spot.targetRect,
    };
  });

  const baseTitle = prev.title.replace(/(?:\(再校\))+$/, '');
  return {
    ...prev,
    id: crypto.randomUUID(),
    title: `${baseTitle}(再校)`,
    createdAt: now,
    updatedAt: now,
    round: { prevBoardId: prev.id, n: (prev.round?.n ?? 1) + 1 },
    pages,
    spots,
    order: prev.order.map((id) => spotIdMap.get(id)).filter((id): id is string => !!id),
  };
}

/** R2: 持ち越した修正対象がすべて○で、新しい未解決指示もなければ「校了」。 */
export function isProofed(board: Board): boolean {
  if (!board.round) return false;
  const carried = board.spots.filter((s) => s.carried);
  if (carried.length === 0) return false;
  if (!carried.every((s) => s.check === 'ok')) return false;
  const others = board.spots.filter((s) => !s.carried && !s.keep);
  return others.every((s) => !hasSpecifiedContent(s, board));
}
