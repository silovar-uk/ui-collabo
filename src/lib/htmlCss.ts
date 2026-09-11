import { FONT_MOODS, LADDER_TABLE } from '../vocab';
import type { ComputedKey, LadderAttr, Note, Spot } from '../schema';

/** ラダー属性のうち、実測CSSプロパティに対応するものだけを持つ。scale/speed/intensityは対応先がない。 */
export const LADDER_TO_CSS: Partial<Record<LadderAttr, ComputedKey>> = {
  fontSize: 'font-size',
  weight: 'font-weight',
  spacing: 'margin',
  radius: 'border-radius',
  lineWidth: 'border-width',
};

function ladderValue(attr: LadderAttr, step: number): string {
  const def = LADDER_TABLE[attr];
  const raw = def.steps[step];
  return raw === 'full' ? '9999px' : `${raw}${def.unit ?? ''}`;
}

export function parseNumber(value: string): number | null {
  const m = value.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

export function nearestStepIndex(attr: LadderAttr, current: number): number {
  const steps = LADDER_TABLE[attr].steps;
  let best = 0;
  let bestDiff = Infinity;
  steps.forEach((s, i) => {
    if (typeof s !== 'number') return;
    const diff = Math.abs(s - current);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}

export interface LadderResolution {
  from: string | null;
  to: string;
}

/**
 * ラダーノートを実際のCSS値に解決する。stepは段をそのまま採用、deltaは実測値から
 * 最も近い段を探し、そこへdeltaを足した段を採用する。実測値もCSSマッピングもなければnull。
 */
export function resolveLadder(
  attr: LadderAttr,
  note: Extract<Note, { kind: 'ladder' }>,
  computed: Partial<Record<ComputedKey, string>>,
): LadderResolution | null {
  const def = LADDER_TABLE[attr];
  const cssKey = LADDER_TO_CSS[attr];
  const fromRaw = cssKey ? computed[cssKey] : undefined;

  if ('step' in note.target) {
    return { from: fromRaw ?? null, to: ladderValue(attr, note.target.step) };
  }

  if (!fromRaw) return null;
  const currentNum = parseNumber(fromRaw);
  if (currentNum === null) return null;
  const nearest = nearestStepIndex(attr, currentNum);
  const clamped = Math.min(def.steps.length - 1, Math.max(0, nearest + note.target.delta));
  return { from: fromRaw, to: ladderValue(attr, clamped) };
}

function colorCssKey(role: 'text' | 'bg' | 'accent' | 'line' | undefined): 'color' | 'background-color' | 'border-color' {
  if (role === 'bg') return 'background-color';
  if (role === 'line') return 'border-color';
  return 'color';
}

/** element を持つ箇所のノートを、プレビューに当てるCSS文字列へ変換する。 */
export function spotsToCss(spots: Spot[]): string {
  const blocks: string[] = [];
  for (const spot of spots) {
    if (!spot.element) continue;
    const decls: string[] = [];
    for (const note of spot.notes) {
      if (note.kind === 'ladder') {
        const cssKey = LADDER_TO_CSS[note.attr];
        if (!cssKey) continue;
        const resolved = resolveLadder(note.attr, note, spot.element.computed);
        if (!resolved) continue;
        decls.push(`${cssKey}: ${resolved.to} !important;`);
      } else if (note.kind === 'color') {
        decls.push(`${colorCssKey(note.role)}: ${note.target} !important;`);
      } else if (note.kind === 'font') {
        const mood = FONT_MOODS.find((m) => m.id === note.mood);
        if (mood) decls.push(`font-family: ${mood.font}, ${mood.fallback} !important;`);
      }
    }
    if (decls.length > 0) blocks.push(`${spot.element.selector} { ${decls.join(' ')} }`);
  }
  return blocks.join('\n');
}
