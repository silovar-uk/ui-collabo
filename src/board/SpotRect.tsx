import type { ContainRect } from '../lib/geometry';
import { ratioToPx } from '../lib/geometry';
import type { Spot } from '../schema';

interface Props {
  spot: Spot;
  cr: ContainRect;
  selected: boolean;
  /** 見る順モード中の順番(0始まり)。-1 は未設定/モード外。 */
  orderIndex?: number;
  onSelect: (e: MouseEvent) => void;
}

export function SpotRect({ spot, cr, selected, orderIndex = -1, onSelect }: Props) {
  const px = ratioToPx(spot.rect, cr);
  return (
    <div
      class={`spot-rect${selected ? ' is-selected' : ''}${spot.keep ? ' is-kept' : ''}`}
      style={{ left: px.x, top: px.y, width: px.w, height: px.h }}
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
