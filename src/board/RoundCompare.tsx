import { useState } from 'preact/hooks';
import { library } from '../state';
import type { Board } from '../schema';

/** R2: 表示中ページに対応する前回画像を重ねる。複数ページでもindex対応を崩さない。 */
export function RoundCompare({ board, pageId }: { board: Board; pageId: string }) {
  const [opacity, setOpacity] = useState(0);
  if (!board.round) return null;
  const pageIndex = board.pages.findIndex((p) => p.id === pageId);
  if (pageIndex < 0) return null;
  const prev = library.value.boards.find((b) => b.id === board.round!.prevBoardId);
  const prevImage = prev?.pages[pageIndex]?.image;
  if (!prevImage) return null;

  return (
    <div class="round-compare">
      <img class="round-compare-image" src={prevImage.dataUrl} style={{ opacity: opacity / 100 }} draggable={false} />
      <div class="round-compare-slider">
        <span>今回</span>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          aria-label="前回画像の重ね合わせ"
          onInput={(e) => setOpacity(Number((e.target as HTMLInputElement).value))}
        />
        <span>前回</span>
      </div>
    </div>
  );
}
