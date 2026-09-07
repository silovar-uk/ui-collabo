import type { ComputedKey, LadderAttr, Note, Spot } from '../schema';
import { FONT_MOODS, LADDER_TABLE, type LadderDef } from '../vocab';

/** ラダー属性 → 反映・出力に使うCSSプロパティ。対応なし(scale/speed/intensity)は null。 */
export const LADDER_PROP: Partial<Record<LadderAttr, ComputedKey>> = {
  fontSize: 'font-size',
  weight: 'font-weight',
  spacing: 'margin',
  radius: 'border-radius',
  lineWidth: 'border-width',
};

/** 色ノートの役割 → CSSプロパティ。 */
export const COLOR_PROP: Record<'text' | 'bg' | 'accent' | 'line', ComputedKey> = {
  text: 'color',
  bg: 'background-color',
  accent: 'color',
  line: 'border-color',
};

export interface ResolvedLadder {
  from: string;
  to: string;
}

function stepToCss(def: LadderDef, idx: number): string {
  const raw = def.steps[idx];
  if (raw === 'full') return '9999px';
  return `${raw}${def.unit ?? ''}`;
}

/**
 * ラダーの目標値を現在値から解決する。step指定はそのまま採用、delta指定は現在値に最も近い段から
 * delta分ずらした段を採用する(範囲外はクランプ)。出力(export.ts)と反映(spotsToCss)の両方がここを使う。
 */
export function resolveLadder(attr: LadderAttr, note: Extract<Note, { kind: 'ladder' }>, computed?: string): ResolvedLadder | null {
  const def = LADDER_TABLE[attr];
  const target = note.target;

  if ('step' in target) {
    return { from: computed ?? '', to: stepToCss(def, target.step) };
  }

  if (!computed) return null;
  const currentNum = parseFloat(computed);
  if (Number.isNaN(currentNum)) return null;

  let nearestIdx = 0;
  let nearestDiff = Infinity;
  def.steps.forEach((s, i) => {
    if (typeof s !== 'number') return;
    const diff = Math.abs(s - currentNum);
    if (diff < nearestDiff) {
      nearestDiff = diff;
      nearestIdx = i;
    }
  });
  const idx = Math.min(def.steps.length - 1, Math.max(0, nearestIdx + target.delta));
  return { from: computed, to: stepToCss(def, idx) };
}

/** element を持つ箇所のノートを、その場反映用のCSSに変換する。selector { prop: value; ... } の連結。 */
export function spotsToCss(spots: Spot[]): string {
  const rules: string[] = [];
  for (const spot of spots) {
    if (!spot.element) continue;
    const decls: string[] = [];
    for (const note of spot.notes) {
      if (note.kind === 'ladder') {
        const prop = LADDER_PROP[note.attr];
        if (!prop) continue;
        const resolved = resolveLadder(note.attr, note, spot.element.computed[prop]);
        if (resolved) decls.push(`${prop}: ${resolved.to};`);
      } else if (note.kind === 'color') {
        const prop = COLOR_PROP[note.role ?? 'accent'];
        decls.push(`${prop}: ${note.target};`);
      } else if (note.kind === 'font') {
        const mood = FONT_MOODS.find((m) => m.id === note.mood);
        if (mood) decls.push(`font-family: '${mood.font}', ${mood.fallback};`);
      }
    }
    if (decls.length > 0) rules.push(`${spot.element.selector} { ${decls.join(' ')} }`);
  }
  return rules.join('\n');
}
