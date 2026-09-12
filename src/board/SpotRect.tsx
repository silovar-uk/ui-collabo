import type { ContainRect } from '../lib/geometry';
import { ratioToPx } from '../lib/geometry';
import { hoverSpotId } from '../state';
import type { Spot } from '../schema';

interface Props {
  spot: Spot;
  cr: ContainRect;
  selected: boolean;
  /** 見る順モード中の順番(0始まり)。-1 は未設定/モード外。 */
  orderIndex?: number;
  /** 作成直後200msだけtrue。淡いパルスを表示する。 */
  justCreated?: boolean;
  onSelect: () => void;
}

const LABEL_MIN_HEIGHT = 28;

export function SpotRect({ spot, cr, selected, orderIndex = -1, justCreated = false, onSelect }: Props) {
  const px = ratioToPx(spot.rect, cr);
  const isCompact = px.h < LABEL_MIN_HEIGHT;
  const hovered = hoverSpotId.value === spot.id;
  const label = `箇所${spot.n}${spot.label ? ` ${spot.label}` : ''}${spot.keep ? ' 変えない' : ''}`;
  return (
    <div
      data-spot-id={spot.id}
      class={`spot-rect${selected ? ' is-selected' : ''}${spot.keep ? ' is-kept' : ''}${isCompact ? ' is-compact' : ''}${justCreated ? ' is-new' : ''}${hovered ? ' is-hovered' : ''}`}
      style={{ left: px.x, top: px.y, width: px.w, height: px.h }}
      title={isCompact ? spot.label : undefined}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
    >
      <span class="spot-badge">{spot.n}</span>
      {spot.label && <span class="spot-label">{spot.label}</span>}
      {orderIndex >= 0 && <span class="spot-order-badge">{orderIndex + 1}</span>}
    </div>
  );
}
