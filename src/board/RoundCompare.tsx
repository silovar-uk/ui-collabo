import { useState } from 'preact/hooks';
import { library } from '../state';
import type { Board } from '../schema';

/** R2: ボード上端の「前回⇄今回」スライダー。前回の画像を半透明で重ねる。 */
export function RoundCompare({ board }: { board: Board }) {
  const [opacity, setOpacity] = useState(0);
  if (!board.round) return null;
  const prev = library.value.boards.find((b) => b.id === board.round!.prevBoardId);
  const prevImage = prev?.pages[0]?.image;
  if (!prevImage) return null;

  return (
    <div class="round-compare">
      <img class="round-compare-image" src={prevImage.dataUrl} style={{ opacity: opacity / 100 }} draggable={false} />
      <div class="round-compare-slider">
        <span>今回</span>
        <input type="range" min={0} max={100} value={opacity} onInput={(e) => setOpacity(Number((e.target as HTMLInputElement).value))} />
        <span>前回</span>
      </div>
    </div>
  );
}
