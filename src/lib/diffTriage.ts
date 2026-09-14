import type { Rect, Spot } from '../schema';
import type { DiffRegion } from './visualDiff';

const KEY_PRECISION = 10_000;

function roundKey(value: number): number {
  return Math.round(value * KEY_PRECISION) / KEY_PRECISION;
}

export function diffRegionKey(region: DiffRegion): string {
  const { x, y, w, h } = region.rect;
  return [
    region.kind,
    roundKey(x),
    roundKey(y),
    roundKey(w),
    roundKey(h),
    region.cells,
  ].join(':');
}

function cloneRect(rect: Rect): Rect {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

/**
 * 想定外の差分候補を通常のSpotへ昇格する。
 * 差分由来という専用schemaは作らず、以後は既存のPalette / Handoff / workflowで扱う。
 */
export function diffRegionToSpot({
  region,
  pageId,
  n,
  id = crypto.randomUUID(),
}: {
  region: DiffRegion;
  pageId: string;
  n: number;
  id?: string;
}): Spot {
  return {
    id,
    pageId,
    n,
    label: '想定外の変更',
    rect: cloneRect(region.rect),
    keep: false,
    notes: [],
  };
}
