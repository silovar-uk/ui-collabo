import type { Board, Page, Spot } from '../schema';

export interface ProtocolPageGroup {
  page: Page;
  pageIndex: number;
  spotIds: string[];
  emptySpots: Spot[];
  active: boolean;
}

/**
 * Protocol pane should follow the specimen the user is currently looking at.
 * Keep page order stable, but move the active page group to the front.
 */
export function protocolPageGroups(
  board: Board,
  activePageId: string | null,
  orderedSpotIds: string[],
  emptySpots: Spot[],
): ProtocolPageGroup[] {
  const pages = board.pages.map((page, pageIndex) => ({ page, pageIndex }));
  const activeIndex = pages.findIndex(({ page }) => page.id === activePageId);
  const orderedPages = activeIndex > 0 ? [pages[activeIndex], ...pages.slice(0, activeIndex), ...pages.slice(activeIndex + 1)] : pages;

  return orderedPages.map(({ page, pageIndex }) => ({
    page,
    pageIndex,
    spotIds: orderedSpotIds.filter((spotId) => board.spots.find((spot) => spot.id === spotId)?.pageId === page.id),
    emptySpots: emptySpots.filter((spot) => spot.pageId === page.id),
    active: page.id === activePageId || (!activePageId && pageIndex === 0),
  }));
}

export function protocolGroupCount(group: ProtocolPageGroup): number {
  return group.spotIds.length + group.emptySpots.length;
}
