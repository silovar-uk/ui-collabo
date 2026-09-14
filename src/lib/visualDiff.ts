import type { Rect } from '../schema';

export type DiffKind = 'expected' | 'unexpected';

export interface ExpectedDiffTarget {
  id: string;
  rect: Rect;
}

export interface DiffRegion {
  kind: DiffKind;
  rect: Rect;
  score: number;
  cells: number;
  targetIds: string[];
}

export interface VisualDiffResult {
  regions: DiffRegion[];
  expected: DiffRegion[];
  unexpected: DiffRegion[];
  changedRatio: number;
  sampleWidth: number;
  sampleHeight: number;
  dimensionMismatch: boolean;
}

export interface VisualDiffOptions {
  sampleMaxEdge?: number;
  colorThreshold?: number;
  cellSize?: number;
  cellChangeRatio?: number;
  minRegionCells?: number;
  expectedCellOverlap?: number;
}

interface ResolvedOptions {
  colorThreshold: number;
  cellSize: number;
  cellChangeRatio: number;
  minRegionCells: number;
  expectedCellOverlap: number;
}

const DEFAULTS: Required<VisualDiffOptions> = {
  sampleMaxEdge: 192,
  colorThreshold: 32,
  cellSize: 8,
  cellChangeRatio: 0.14,
  minRegionCells: 2,
  expectedCellOverlap: 0.18,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function intersectionArea(a: Rect, b: Rect): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function targetIdsForCell(cell: Rect, targets: ExpectedDiffTarget[], threshold: number): string[] {
  const area = Math.max(Number.EPSILON, cell.w * cell.h);
  const cx = cell.x + cell.w / 2;
  const cy = cell.y + cell.h / 2;
  return targets
    .filter(({ rect }) => {
      const centerInside = cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
      return centerInside || intersectionArea(cell, rect) / area >= threshold;
    })
    .map((target) => target.id);
}

function pixelChanged(before: Uint8ClampedArray, after: Uint8ClampedArray, index: number, threshold: number): boolean {
  const beforeAlpha = before[index + 3];
  const afterAlpha = after[index + 3];
  if (beforeAlpha === 0 && afterAlpha === 0) return false;
  const alphaDelta = Math.abs(beforeAlpha - afterAlpha);
  const rgbDelta = (
    Math.abs(before[index] - after[index]) +
    Math.abs(before[index + 1] - after[index + 1]) +
    Math.abs(before[index + 2] - after[index + 2])
  ) / 3;
  return alphaDelta > threshold || rgbDelta > threshold;
}

/**
 * RGBA画像を粗いセルへ集約し、変更セルをExpected / Unexpectedへ分けて領域化する。
 * UI上の差分候補表示用であり、これだけで「修正済み」を自動確定しない。
 */
export function detectVisualDiffRegions(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  width: number,
  height: number,
  targets: ExpectedDiffTarget[],
  options: VisualDiffOptions = {},
): Omit<VisualDiffResult, 'dimensionMismatch'> {
  if (width <= 0 || height <= 0 || before.length !== after.length || before.length !== width * height * 4) {
    throw new Error('差分画像のサイズが不正です');
  }

  const opts: ResolvedOptions = {
    colorThreshold: options.colorThreshold ?? DEFAULTS.colorThreshold,
    cellSize: Math.max(1, Math.round(options.cellSize ?? DEFAULTS.cellSize)),
    cellChangeRatio: clamp01(options.cellChangeRatio ?? DEFAULTS.cellChangeRatio),
    minRegionCells: Math.max(1, Math.round(options.minRegionCells ?? DEFAULTS.minRegionCells)),
    expectedCellOverlap: clamp01(options.expectedCellOverlap ?? DEFAULTS.expectedCellOverlap),
  };

  const cols = Math.ceil(width / opts.cellSize);
  const rows = Math.ceil(height / opts.cellSize);
  const changed = new Array<boolean>(cols * rows).fill(false);
  const kinds = new Array<DiffKind>(cols * rows).fill('unexpected');
  const scores = new Array<number>(cols * rows).fill(0);
  const targetIds = new Array<string[]>(cols * rows).fill(null).map(() => []);
  let changedPixels = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x0 = col * opts.cellSize;
      const y0 = row * opts.cellSize;
      const x1 = Math.min(width, x0 + opts.cellSize);
      const y1 = Math.min(height, y0 + opts.cellSize);
      let cellChanged = 0;
      let cellPixels = 0;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const pixelIndex = (y * width + x) * 4;
          cellPixels += 1;
          if (pixelChanged(before, after, pixelIndex, opts.colorThreshold)) {
            cellChanged += 1;
            changedPixels += 1;
          }
        }
      }

      const ratio = cellPixels > 0 ? cellChanged / cellPixels : 0;
      if (ratio < opts.cellChangeRatio) continue;
      const index = row * cols + col;
      changed[index] = true;
      scores[index] = ratio;
      const cellRect: Rect = {
        x: x0 / width,
        y: y0 / height,
        w: (x1 - x0) / width,
        h: (y1 - y0) / height,
      };
      const ids = targetIdsForCell(cellRect, targets, opts.expectedCellOverlap);
      targetIds[index] = ids;
      kinds[index] = ids.length > 0 ? 'expected' : 'unexpected';
    }
  }

  const visited = new Array<boolean>(changed.length).fill(false);
  const regions: DiffRegion[] = [];
  const neighbours = [-1, 0, 1];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const start = row * cols + col;
      if (!changed[start] || visited[start]) continue;
      const kind = kinds[start];
      const queue: Array<[number, number]> = [[row, col]];
      visited[start] = true;
      let minCol = col;
      let maxCol = col;
      let minRow = row;
      let maxRow = row;
      let scoreTotal = 0;
      let cellCount = 0;
      const ids = new Set<string>();

      while (queue.length > 0) {
        const [r, c] = queue.shift()!;
        const index = r * cols + c;
        cellCount += 1;
        scoreTotal += scores[index];
        targetIds[index].forEach((id) => ids.add(id));
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);

        for (const dr of neighbours) {
          for (const dc of neighbours) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const next = nr * cols + nc;
            if (!changed[next] || visited[next] || kinds[next] !== kind) continue;
            visited[next] = true;
            queue.push([nr, nc]);
          }
        }
      }

      if (cellCount < opts.minRegionCells) continue;
      const left = minCol * opts.cellSize;
      const top = minRow * opts.cellSize;
      const right = Math.min(width, (maxCol + 1) * opts.cellSize);
      const bottom = Math.min(height, (maxRow + 1) * opts.cellSize);
      regions.push({
        kind,
        rect: { x: left / width, y: top / height, w: (right - left) / width, h: (bottom - top) / height },
        score: scoreTotal / cellCount,
        cells: cellCount,
        targetIds: [...ids],
      });
    }
  }

  regions.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
  return {
    regions,
    expected: regions.filter((region) => region.kind === 'expected'),
    unexpected: regions.filter((region) => region.kind === 'unexpected'),
    changedRatio: changedPixels / (width * height),
    sampleWidth: width,
    sampleHeight: height,
  };
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('比較画像を読み込めませんでした'));
    image.src = dataUrl;
  });
}

export async function analyzeImageDiff(
  before: { dataUrl: string; width: number; height: number },
  after: { dataUrl: string; width: number; height: number },
  targets: ExpectedDiffTarget[],
  options: VisualDiffOptions = {},
): Promise<VisualDiffResult> {
  const [beforeImage, afterImage] = await Promise.all([loadImage(before.dataUrl), loadImage(after.dataUrl)]);
  const maxEdge = Math.max(32, Math.round(options.sampleMaxEdge ?? DEFAULTS.sampleMaxEdge));
  const sourceWidth = Math.max(1, after.width || afterImage.naturalWidth);
  const sourceHeight = Math.max(1, after.height || afterImage.naturalHeight);
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('差分比較用Canvasを作成できませんでした');

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(beforeImage, 0, 0, width, height);
  const beforeData = ctx.getImageData(0, 0, width, height).data;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(afterImage, 0, 0, width, height);
  const afterData = ctx.getImageData(0, 0, width, height).data;

  return {
    ...detectVisualDiffRegions(beforeData, afterData, width, height, targets, options),
    dimensionMismatch: before.width !== after.width || before.height !== after.height,
  };
}
