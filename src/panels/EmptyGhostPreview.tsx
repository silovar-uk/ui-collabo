import { cloneAndOpenBoard } from '../state';
import { hasGhostEffect } from '../lib/ghost';
import { Ghost } from '../board/Ghost';
import { SAMPLES } from '../samples';

const PREVIEW_W = 280;
const CROP_RATIO = 0.5; // 上半分だけ見せる

/** H6: 入口画面で、見本の上半分を縮小した小窓の中でH1の透かしを演じておく(自動再生、操作は受け付けない)。 */
export function EmptyGhostPreview() {
  const sample = SAMPLES[0];
  const board = sample.board;
  const page = board.pages[0];
  if (!page.image) return null;

  const fullH = Math.round(PREVIEW_W * (page.image.height / page.image.width));
  const previewH = Math.round(fullH * CROP_RATIO);
  const cr = { left: 0, top: 0, width: PREVIEW_W, height: fullH };

  return (
    <button
      class="empty-ghost-preview"
      style={{ width: PREVIEW_W, height: previewH }}
      onClick={() => cloneAndOpenBoard(board)}
      aria-label={sample.label}
    >
      <div class="empty-ghost-inner" style={{ width: cr.width, height: cr.height }}>
        <img class="board-image" src={page.image.dataUrl} draggable={false} alt="" />
        {board.spots
          .filter((s) => s.pageId === page.id && hasGhostEffect(s))
          .map((spot) => (
            <Ghost key={spot.id} spot={spot} page={page} cr={cr} />
          ))}
      </div>
    </button>
  );
}
