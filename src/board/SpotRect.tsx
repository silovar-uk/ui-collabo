import type { ContainRect } from '../lib/geometry';
import { ratioToPx } from '../lib/geometry';
import type { Spot } from '../schema';

interface Props {
  spot: Spot;
  cr: ContainRect;
  selected: boolean;
  /** 見る順モード中の順番(0始まり)。-1 は未設定/モード外。 */
  orderIndex?: number;
  /** 作成直後200msだけtrue。淡いパルスを表示する。 */
  justCreated?: boolean;
  onSelect: (e: MouseEvent) => void;
}

const LABEL_MIN_HEIGHT = 28;

export function SpotRect({ spot, cr, selected, orderIndex = -1, justCreated = false, onSelect }: Props) {
  const px = ratioToPx(spot.rect, cr);
  const isCompact = px.h < LABEL_MIN_HEIGHT;
  return (
    <div
      class={`spot-rect${selected ? ' is-selected' : ''}${spot.keep ? ' is-kept' : ''}${isCompact ? ' is-compact' : ''}${justCreated ? ' is-new' : ''}`}
      style={{ left: px.x, top: px.y, width: px.w, height: px.h }}
      title={isCompact ? spot.label : undefined}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(e as unknown as MouseEvent);
      }}
    >
      <span class="spot-badge">{spot.n}</span>
      {spot.label && <span class="spot-label">{spot.label}</span>}
      {orderIndex >= 0 && <span class="spot-order-badge">{orderIndex + 1}</span>}
    </div>
  );
}
