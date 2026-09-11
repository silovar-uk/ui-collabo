import { useRef, useState } from 'preact/hooks';
import {
  activePageId,
  colorPickRequest,
  currentBoard,
  lens,
  measureRequest,
  nextSpotNumber,
  orderMode,
  paletteHoverColor,
  selectedSpotId,
  spaceHeld,
  toggleOrderSpot,
  updateBoard,
} from '../state';
import { containRect, nominalCanvasSize, pxToRatio, ratioToPx, clampRect } from '../lib/geometry';
import { useBoxSize } from '../lib/useBoxSize';
import { useBoardKeys } from '../lib/useBoardKeys';
import { getSpotEditTarget } from '../lib/spotTarget';
import { hasGhostEffect } from '../lib/ghost';
import { sampleImageColor } from '../lib/image';
import { nearestStepIndex } from '../lib/htmlCss';
import type { Rect, Spot } from '../schema';
import { SpotRect } from './SpotRect';
import { Ghost } from './Ghost';
import { LensToggle } from './LensToggle';
import { ImageRoleToggle } from './ImageRoleToggle';
import { Palette } from './Palette';
import { PaletteHighlight } from './PaletteHighlight';

const MIN_DRAG_PX = 8;
const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const;
type Handle = (typeof HANDLES)[number];

export function Board() {
  const board = currentBoard.value;
  const [containerRef, boxSize] = useBoxSize<HTMLDivElement>();
  const [draftPx, setDraftPx] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const drag = useRef<{ mode: 'create' | 'move' | 'resize' | 'measure'; startX: number; startY: number; handle?: Handle; base?: Rect } | null>(null);
  const [, force] = useState(0);
  // R1-a: 定規。measureLineはドラッグ中の線、measureResultは離した後2秒だけ残す寸法線
  const [measureLine, setMeasureLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [measureResult, setMeasureResult] = useState<{ x1: number; y1: number; x2: number; y2: number; label: string } | null>(null);

  useBoardKeys();

  const page = board?.pages.find((p) => p.id === activePageId.value) ?? null;
  const canvasSize = page?.image ? { width: page.image.width, height: page.image.height } : nominalCanvasSize(board?.format ?? { kind: 'web' });

  if (!board || !page) return null;

  const cr = containRect(boxSize.width, boxSize.height, canvasSize.width, canvasSize.height);

  function onSurfacePointerDown(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.spot-rect, .edit-box, .palette')) return;
    const el = containerRef.current;
    if (!el) return;
    const rectBox = el.getBoundingClientRect();
    const startX = e.clientX - rectBox.left;
    const startY = e.clientY - rectBox.top;

    const pickReq = colorPickRequest.value;
    if (pickReq && page!.image) {
      const ratio = pxToRatio({ x: startX, y: startY, w: 0, h: 0 }, cr);
      void sampleImageColor(page!.image, ratio.x, ratio.y).then((hex) => {
        pickReq.onPick(hex);
        colorPickRequest.value = null;
      });
      return;
    }

    if (measureRequest.value) {
      drag.current = { mode: 'measure', startX, startY };
      el.setPointerCapture(e.pointerId);
      setMeasureLine({ x1: startX, y1: startY, x2: startX, y2: startY });
      return;
    }

    drag.current = { mode: 'create', startX, startY };
    el.setPointerCapture(e.pointerId);
    setDraftPx({ x: startX, y: startY, w: 0, h: 0 });
  }

  function onSurfacePointerMove(e: PointerEvent) {
    if (!drag.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rectBox = el.getBoundingClientRect();
    const curX = e.clientX - rectBox.left;
    const curY = e.clientY - rectBox.top;
    if (drag.current.mode === 'measure') {
      setMeasureLine((cur) => (cur ? { ...cur, x2: curX, y2: curY } : cur));
      return;
    }
    if (drag.current.mode !== 'create') return;
    const { startX, startY } = drag.current;
    setDraftPx({ x: Math.min(startX, curX), y: Math.min(startY, curY), w: Math.abs(curX - startX), h: Math.abs(curY - startY) });
  }

  function onSurfacePointerUp() {
    if (!drag.current) return;
    if (drag.current.mode === 'measure') {
      drag.current = null;
      const line = measureLine;
      setMeasureLine(null);
      const req = measureRequest.value;
      measureRequest.value = null;
      if (!line || !req) return;
      const lengthBoardPx = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
      if (lengthBoardPx < MIN_DRAG_PX) return;
      // 1280基準pxへ換算(表示幅比 × 1280。画像の実ピクセル幅には依存しない)
      const length1280 = (lengthBoardPx / cr.width) * 1280;
      // ponytail: 文字サイズは字面の高さから概算する近似係数。和文と欧文で字面の高さが違うため厳密ではない
      const value = req.attr === 'fontSize' ? length1280 / 0.8 : length1280;
      const stepIndex = nearestStepIndex(req.attr, value);
      req.onMeasure(stepIndex);
      setMeasureResult({ ...line, label: `約${Math.round(value)}px` });
      setTimeout(() => setMeasureResult(null), 2000);
      return;
    }
    if (drag.current.mode !== 'create') return;
    drag.current = null;
    const d = draftPx;
    setDraftPx(null);
    if (!d) return;
    if (d.w < MIN_DRAG_PX && d.h < MIN_DRAG_PX) {
      selectedSpotId.value = null;
      return;
    }
    const liveCr = cr;
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
    const liveCr = cr;
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
      class={`board-surface${colorPickRequest.value ? ' is-picking-color' : ''}${measureRequest.value ? ' is-measuring' : ''}${orderMode.value ? ' is-order-mode' : ''}`}
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

      {board.imageRole === 'draft' && page.image && !spaceHeld.value && lens.value === 'after' &&
        board.spots
          .filter((s) => s.pageId === page.id && hasGhostEffect(s))
          .map((spot) => <Ghost key={spot.id} spot={spot} page={page} cr={cr} />)}

      {board.imageRole === 'draft' && page.image && <LensToggle />}
      {page.image && <ImageRoleToggle role={board.imageRole} />}
      {page.image && paletteHoverColor.value && <PaletteHighlight page={page} cr={cr} hex={paletteHoverColor.value} />}

      {board.spots
        .filter((s) => s.pageId === page.id)
        .map((spot) => (
          <SpotRect
            key={spot.id}
            spot={spot}
            cr={cr}
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

      {(measureLine || measureResult) && (
        <svg class="ruler-overlay">
          <line
            x1={(measureLine ?? measureResult)!.x1}
            y1={(measureLine ?? measureResult)!.y1}
            x2={(measureLine ?? measureResult)!.x2}
            y2={(measureLine ?? measureResult)!.y2}
          />
          {measureResult && (
            <text x={(measureResult.x1 + measureResult.x2) / 2} y={(measureResult.y1 + measureResult.y2) / 2 - 6}>
              {measureResult.label}
            </text>
          )}
        </svg>
      )}

      {(() => {
        if (orderMode.value || colorPickRequest.value) return null;
        const spot = board.spots.find((s) => s.id === selectedSpotId.value && s.pageId === page.id);
        if (!spot) return null;
        const t = getSpotEditTarget(board!, spot);
        const px = ratioToPx(t.rect, cr);
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

      {!orderMode.value &&
        !colorPickRequest.value &&
        (() => {
          const spot = board.spots.find((s) => s.id === selectedSpotId.value && s.pageId === page.id);
          return spot ? <Palette board={board} spot={spot} cr={cr} /> : null;
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
