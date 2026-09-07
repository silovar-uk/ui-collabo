import { useEffect, useRef, useState } from 'preact/hooks';
import {
  activePageId,
  colorPickRequest,
  currentBoard,
  nextSpotNumber,
  orderMode,
  selectedSpotId,
  toggleOrderSpot,
  undo,
  updateBoard,
} from '../state';
import { containRect, nominalCanvasSize, pxToRatio, ratioToPx, clampRect, type ContainRect } from '../lib/geometry';
import { getSpotEditTarget } from '../lib/spotTarget';
import { sampleImageColor } from '../lib/image';
import type { Rect, Spot } from '../schema';
import { SpotRect } from './SpotRect';

const MIN_DRAG_PX = 8;
const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const;
type Handle = (typeof HANDLES)[number];

function isTypingTarget(el: EventTarget | null): boolean {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

export function Board() {
  const board = currentBoard.value;
  const containerRef = useRef<HTMLDivElement>(null);
  const [draftPx, setDraftPx] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const drag = useRef<{ mode: 'create' | 'move' | 'resize'; startX: number; startY: number; handle?: Handle; base?: Rect } | null>(null);
  const [, force] = useState(0);

  const page = board?.pages.find((p) => p.id === activePageId.value) ?? null;
  const canvasSize = page?.image ? { width: page.image.width, height: page.image.height } : nominalCanvasSize(board?.format ?? { kind: 'web' });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (!board) return;
      if (e.key === 'Escape') {
        selectedSpotId.value = null;
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSpotId.value) {
        const id = selectedSpotId.value;
        updateBoard((b) => ({ ...b, spots: b.spots.filter((s) => s.id !== id) }));
        selectedSpotId.value = null;
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        undo();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedSpotId.value) {
        e.preventDefault();
        const step = e.shiftKey ? 0.05 : 0.01;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudgeSelected(dx, dy);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!board || !page) return null;

  const cr = containRect(1000, 1000, canvasSize.width, canvasSize.height);

  function getCr(): ContainRect {
    const el = containerRef.current;
    if (!el) return cr;
    return containRect(el.clientWidth, el.clientHeight, canvasSize.width, canvasSize.height);
  }

  function nudgeSelected(dx: number, dy: number) {
    const spot = board!.spots.find((s) => s.id === selectedSpotId.value);
    if (!spot) return;
    const t = getSpotEditTarget(board!, spot);
    t.apply(clampRect({ x: t.rect.x + dx, y: t.rect.y + dy, w: t.rect.w, h: t.rect.h }));
  }

  function onSurfacePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.spot-rect, .edit-box')) return;
    const el = containerRef.current;
    if (!el) return;
    const rectBox = el.getBoundingClientRect();
    const startX = e.clientX - rectBox.left;
    const startY = e.clientY - rectBox.top;

    const pickReq = colorPickRequest.value;
    if (pickReq && page!.image) {
      const ratio = pxToRatio({ x: startX, y: startY, w: 0, h: 0 }, getCr());
      void sampleImageColor(page!.image, ratio.x, ratio.y).then((hex) => {
        pickReq.onPick(hex);
        colorPickRequest.value = null;
      });
      return;
    }

    drag.current = { mode: 'create', startX, startY };
    el.setPointerCapture(e.pointerId);
    setDraftPx({ x: startX, y: startY, w: 0, h: 0 });
  }

  function onSurfacePointerMove(e: PointerEvent) {
    if (!drag.current || drag.current.mode !== 'create') return;
    const el = containerRef.current;
    if (!el) return;
    const rectBox = el.getBoundingClientRect();
    const curX = e.clientX - rectBox.left;
    const curY = e.clientY - rectBox.top;
    const { startX, startY } = drag.current;
    setDraftPx({ x: Math.min(startX, curX), y: Math.min(startY, curY), w: Math.abs(curX - startX), h: Math.abs(curY - startY) });
  }

  function onSurfacePointerUp() {
    if (!drag.current || drag.current.mode !== 'create') return;
    drag.current = null;
    const d = draftPx;
    setDraftPx(null);
    if (!d) return;
    if (d.w < MIN_DRAG_PX && d.h < MIN_DRAG_PX) {
      selectedSpotId.value = null;
      return;
    }
    const liveCr = getCr();
    const ratio = clampRect(pxToRatio(d, liveCr));
    const n = nextSpotNumber(board!);
    const spot: Spot = { id: crypto.randomUUID(), pageId: page!.id, n, label: '', rect: ratio, keep: false, notes: [] };
    updateBoard((b) => ({ ...b, spots: [...b.spots, spot] }));
    selectedSpotId.value = spot.id;
    setJustCreatedId(spot.id);
    setTimeout(() => setJustCreatedId((cur) => (cur === spot.id ? null : cur)), 220);
  }

  function startBoxDrag(e: PointerEvent, spot: Spot, handle?: Handle) {
    e.stopPropagation();
    const t = getSpotEditTarget(board!, spot);
    drag.current = { mode: handle ? 'resize' : 'move', startX: e.clientX, startY: e.clientY, handle, base: t.rect };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onBoxPointerMove(e: PointerEvent, spot: Spot) {
    const d = drag.current;
    if (!d || d.mode === 'create' || !d.base) return;
    const liveCr = getCr();
    const dx = (e.clientX - d.startX) / liveCr.width;
    const dy = (e.clientY - d.startY) / liveCr.height;
    let next: Rect;
    if (d.mode === 'move') {
      next = { ...d.base, x: d.base.x + dx, y: d.base.y + dy };
      const centerX = next.x + next.w / 2;
      const centerY = next.y + next.h / 2;
      const snapPx = 4 / liveCr.width;
      const snapPy = 4 / liveCr.height;
      if (Math.abs(centerX - 0.5) < snapPx) next.x = 0.5 - next.w / 2;
      if (Math.abs(centerY - 0.5) < snapPy) next.y = 0.5 - next.h / 2;
    } else {
      next = applyResize(d.base, d.handle!, dx, dy);
    }
    getSpotEditTarget(board!, spot).apply(clampRect(next));
  }

  function onBoxPointerUp() {
    drag.current = null;
    force((n) => n + 1);
  }

  return (
    <div
      class={`board-surface${colorPickRequest.value ? ' is-picking-color' : ''}${orderMode.value ? ' is-order-mode' : ''}`}
      ref={containerRef}
      style={{ aspectRatio: `${canvasSize.width} / ${canvasSize.height}` }}
      onPointerDown={(e) => onSurfacePointerDown(e as unknown as PointerEvent)}
      onPointerMove={(e) => onSurfacePointerMove(e as unknown as PointerEvent)}
      onPointerUp={onSurfacePointerUp}
    >
      {page.image ? (
        <img class="board-image" src={page.image.dataUrl} draggable={false} />
      ) : (
        <div class="board-blank" />
      )}

      {board.spots
        .filter((s) => s.pageId === page.id)
        .map((spot) => (
          <SpotRect
            key={spot.id}
            spot={spot}
            cr={getCr()}
            selected={selectedSpotId.value === spot.id}
            justCreated={justCreatedId === spot.id}
            orderIndex={orderMode.value ? board.order.indexOf(spot.id) : -1}
            onSelect={() => {
              if (orderMode.value) {
                toggleOrderSpot(spot.id);
              } else {
                selectedSpotId.value = spot.id;
              }
            }}
          />
        ))}

      {draftPx && <div class="spot-rect draft" style={{ left: draftPx.x, top: draftPx.y, width: draftPx.w, height: draftPx.h }} />}

      {(() => {
        if (orderMode.value || colorPickRequest.value) return null;
        const spot = board.spots.find((s) => s.id === selectedSpotId.value && s.pageId === page.id);
        if (!spot) return null;
        const t = getSpotEditTarget(board!, spot);
        const px = ratioToPx(t.rect, getCr());
        return (
          <div
            class={`edit-box${t.dashed ? ' dashed' : ''}`}
            style={{ left: px.x, top: px.y, width: px.w, height: px.h }}
            onPointerDown={(e) => startBoxDrag(e as unknown as PointerEvent, spot)}
            onPointerMove={(e) => onBoxPointerMove(e as unknown as PointerEvent, spot)}
            onPointerUp={onBoxPointerUp}
          >
            {HANDLES.map((h) => (
              <div
                key={h}
                class={`edit-handle handle-${h}`}
                onPointerDown={(e) => startBoxDrag(e as unknown as PointerEvent, spot, h)}
                onPointerMove={(e) => onBoxPointerMove(e as unknown as PointerEvent, spot)}
                onPointerUp={onBoxPointerUp}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function applyResize(base: Rect, handle: Handle, dx: number, dy: number): Rect {
  let { x, y, w, h } = base;
  if (handle.includes('n')) {
    y += dy;
    h -= dy;
  }
  if (handle.includes('s')) h += dy;
  if (handle.includes('w')) {
    x += dx;
    w -= dx;
  }
  if (handle.includes('e')) w += dx;
  return { x, y, w, h };
}
