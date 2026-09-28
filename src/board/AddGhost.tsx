import { useRef, useState } from 'preact/hooks';
import { ratioToPx, clampRect, type ContainRect } from '../lib/geometry';
import { placeOf, defaultAddRect, type PageSize } from '../lib/addParts';
import { PART_LABEL, PLACE_LABEL } from '../lib/wishParse';
import * as notes from '../lib/notes';
import { updateBoard } from '../state';
import type { AddPart, AddPlace, Board, Note, Rect, Spot } from '../schema';

type AddNote = Extract<Note, { kind: 'add' }>;

function partInner(part: AddPart, label?: string) {
  if (part === 'text') {
    return (
      <span class="add-part-lines">
        <i />
        <i />
        <i class="is-short" />
      </span>
    );
  }
  if (part === 'line' || part === 'image' || part === 'icon') return null;
  return label || (part === 'input' ? '入力欄' : PART_LABEL[part]);
}

/** 確定した「足す」部品。ドラッグで移動、右下のつまみで大きさを変える(4.3)。 */
export function AddedPart({ note, spot, cr }: { note: AddNote; board: Board; spot: Spot; cr: ContainRect }) {
  const drag = useRef<{ resize: boolean; startX: number; startY: number; base: Rect; startPlace: AddPlace } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const rect = note.rect ?? { x: spot.rect.x, y: Math.min(0.98, spot.rect.y + spot.rect.h + 0.02), w: Math.max(0.06, spot.rect.w), h: 0.05 };
  const px = ratioToPx(rect, cr);

  function down(e: PointerEvent, resize: boolean) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { resize, startX: e.clientX, startY: e.clientY, base: rect, startPlace: note.place };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGrabbing(true);
  }
  function move(e: PointerEvent) {
    e.stopPropagation();
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / cr.width;
    const dy = (e.clientY - d.startY) / cr.height;
    const next = clampRect(
      d.resize
        ? { ...d.base, w: Math.max(0.01, d.base.w + dx), h: note.part === 'line' ? d.base.h : Math.max(0.01, d.base.h + dy) }
        : { ...d.base, x: d.base.x + dx, y: d.base.y + dy },
    );
    updateBoard(notes.patchAddNote(spot.id, note.id, { rect: next }));
  }
  function up(e: PointerEvent) {
    e.stopPropagation();
    const d = drag.current;
    drag.current = null;
    setGrabbing(false);
    if (!d || d.resize) return;
    const place = placeOf(rect, spot.rect);
    if (place !== d.startPlace) updateBoard(notes.patchAddNote(spot.id, note.id, { place, said: undefined }));
  }

  return (
    <div
      class={`add-part add-part-${note.part}${grabbing ? ' is-grabbing' : ''}`}
      style={{ left: px.x, top: px.y, width: px.w, height: px.h }}
      onPointerDown={(e) => down(e as unknown as PointerEvent, false)}
      onPointerMove={(e) => move(e as unknown as PointerEvent)}
      onPointerUp={(e) => up(e as unknown as PointerEvent)}
    >
      <span class="add-part-inner">{partInner(note.part, note.label)}</span>
      <span class="add-part-tag">
        {spot.n} に足す: {PLACE_LABEL[note.place]}
      </span>
      {note.part !== 'line' && (
        <span
          class="add-part-grip"
          onPointerDown={(e) => down(e as unknown as PointerEvent, true)}
          onPointerMove={(e) => move(e as unknown as PointerEvent)}
          onPointerUp={(e) => up(e as unknown as PointerEvent)}
        />
      )}
    </div>
  );
}

/** 書き込む欄が「足す」と読めている間の下書き。確定していないため操作は受け付けない。 */
export function DraftAddPart({
  part,
  place,
  label,
  spot,
  pageSize,
  cr,
}: {
  part: AddPart;
  place: AddPlace;
  label?: string;
  spot: Spot;
  pageSize: PageSize;
  cr: ContainRect;
}) {
  const rect = defaultAddRect(part, place, spot.rect, pageSize);
  const px = ratioToPx(rect, cr);
  return (
    <div class={`add-part add-part-${part} is-draft`} style={{ left: px.x, top: px.y, width: px.w, height: px.h }}>
      <span class="add-part-inner">{partInner(part, label)}</span>
      <span class="add-part-tag">下書き・Enterで確定</span>
    </div>
  );
}

/** 「消す」の朱の斜線と札(4.3)。 */
export function RemoveVeil({ spot, cr }: { spot: Spot; cr: ContainRect }) {
  const px = ratioToPx(spot.rect, cr);
  return (
    <div class="remove-veil" style={{ left: px.x, top: px.y, width: px.w, height: px.h }}>
      <span class="remove-veil-tag">消す</span>
    </div>
  );
}
