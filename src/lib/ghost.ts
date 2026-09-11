import { hexToRgb } from './color';
import { LADDER_TABLE } from '../vocab';
import type { LadderAttr, Note, Spot } from '../schema';

type LadderNote = Extract<Note, { kind: 'ladder' }>;

// ponytail: currentが分からない相対チップは実測できないため、代表的な段間比率を固定値で近似する
const FIXED_SCALE_RATIO: Record<number, number> = { [-2]: 0.75, [-1]: 0.88, [1]: 1.14, [2]: 1.33 };

function stepValue(attr: LadderAttr, step: number): number | null {
  const raw = LADDER_TABLE[attr].steps[step];
  return typeof raw === 'number' ? raw : null;
}

function resolveTargetStep(note: LadderNote): number | null {
  const def = LADDER_TABLE[note.attr];
  if ('step' in note.target) return note.target.step;
  if (note.current === undefined) return null;
  return Math.min(def.steps.length - 1, Math.max(0, note.current + note.target.delta));
}

function scaleRatio(note: LadderNote): number {
  if (note.current !== undefined) {
    const target = resolveTargetStep(note);
    const from = stepValue(note.attr, note.current);
    const to = target === null ? null : stepValue(note.attr, target);
    if (from && to) return to / from;
  }
  if ('delta' in note.target) return FIXED_SCALE_RATIO[note.target.delta] ?? 1;
  return 1;
}

function spacingDirection(note: LadderNote): -1 | 0 | 1 {
  if (note.current !== undefined) {
    const target = resolveTargetStep(note);
    const from = stepValue('spacing', note.current);
    const to = target === null ? null : stepValue('spacing', target);
    if (from !== null && to !== null && from !== to) return to > from ? 1 : -1;
  }
  if ('delta' in note.target) return note.target.delta > 0 ? 1 : note.target.delta < 0 ? -1 : 0;
  return 0;
}

export interface GhostStyle {
  transform?: string;
  transformOrigin?: string;
  borderRadius?: string;
  boxShadow?: string;
  motionClass?: string;
  animationDuration?: string;
}

/**
 * ノートから見た目の変形を返す純関数。displayScaleは1280基準pxを実表示pxへ換算する倍率
 * (実表示幅 ÷ 1280)。角丸・余白の帯はこの倍率でスケールする。
 */
export function ghostStyle(spot: Spot, displayScale: number): GhostStyle {
  const style: GhostStyle = {};
  for (const note of spot.notes) {
    if (note.kind === 'ladder' && (note.attr === 'fontSize' || note.attr === 'scale')) {
      const ratio = scaleRatio(note);
      if (ratio !== 1) {
        style.transform = `scale(${ratio})`;
        style.transformOrigin = 'left center';
      }
    } else if (note.kind === 'ladder' && note.attr === 'radius') {
      const target = resolveTargetStep(note);
      const raw = target === null ? undefined : LADDER_TABLE.radius.steps[target];
      if (raw !== undefined) {
        style.borderRadius = raw === 'full' ? '9999px' : `${Number(raw) * displayScale}px`;
      }
    } else if (note.kind === 'ladder' && note.attr === 'spacing') {
      const dir = spacingDirection(note);
      if (dir !== 0) {
        const spread = Math.round(10 * displayScale);
        style.boxShadow =
          dir > 0 ? `0 0 0 ${spread}px rgba(228, 87, 46, 0.18)` : `inset 0 0 0 ${spread}px rgba(228, 87, 46, 0.18)`;
      }
    } else if (note.kind === 'motion') {
      style.motionClass = `motion-${note.motion}`;
      style.animationDuration = `${note.speed ?? 0.4}s`;
    }
  }
  return style;
}

/** 透かしを描くだけの意味があるか(何も変わらないなら描かない)。 */
export function hasGhostEffect(spot: Spot): boolean {
  if (spot.targetRect) return true;
  return spot.notes.some(
    (n) =>
      (n.kind === 'ladder' && ['fontSize', 'scale', 'radius', 'spacing'].includes(n.attr)) ||
      n.kind === 'motion' ||
      (n.kind === 'color' && n.current !== undefined),
  );
}

/**
 * 今の色(fromHex)に近い画素だけを、目標色(toHex)へ差分でずらす。距離で重み付けし、
 * 文字の縁など離れた色との境界のなじみを残す。色ノートにcurrentがあるときだけ呼ばれる想定。
 */
export function recolor(data: Uint8ClampedArray, fromHex: string, toHex: string, tolerance = 40): Uint8ClampedArray {
  const [fr, fg, fb] = hexToRgb(fromHex);
  const [tr, tg, tb] = hexToRgb(toHex);
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    const dr = out[i] - fr;
    const dg = out[i + 1] - fg;
    const db = out[i + 2] - fb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist > tolerance) continue;
    const weight = 1 - dist / tolerance;
    out[i] = out[i] + (tr - fr) * weight;
    out[i + 1] = out[i + 1] + (tg - fg) * weight;
    out[i + 2] = out[i + 2] + (tb - fb) * weight;
  }
  return out;
}
