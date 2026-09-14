import { activePageId, selectedSpotId } from '../state';
import type { Board } from '../schema';

export function PagePager({ board, currentPageId }: { board: Board; currentPageId: string | null }) {
  if (board.pages.length <= 1) return null;
  const index = Math.max(0, board.pages.findIndex((page) => page.id === currentPageId));

  function move(delta: number) {
    const nextIndex = Math.max(0, Math.min(board.pages.length - 1, index + delta));
    const next = board.pages[nextIndex];
    if (!next || next.id === currentPageId) return;
    activePageId.value = next.id;
    selectedSpotId.value = null;
  }

  return (
    <div
      class="mobile-page-pager"
      aria-label="ページを切り替える"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') move(-1);
        if (e.key === 'ArrowRight') move(1);
      }}
    >
      <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label="前のページ">‹</button>
      <span class="mobile-page-pager-label">
        <b>p.{index + 1} / {board.pages.length}</b>
        {board.pages[index]?.label && <small>{board.pages[index].label}</small>}
      </span>
      <button type="button" onClick={() => move(1)} disabled={index === board.pages.length - 1} aria-label="次のページ">›</button>
    </div>
  );
}
