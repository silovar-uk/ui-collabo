import type { ComputedKey } from '../schema';

const LABEL: Partial<Record<ComputedKey, string>> = {
  'font-size': '文字',
  'font-weight': '太さ',
  color: '色',
  'background-color': '背景',
  'border-color': '線の色',
  margin: '余白',
  padding: '内側の余白',
  'border-radius': '角丸',
  'border-width': '線の太さ',
};

const ZERO_LIKE = /^(0(px|%)?|none)$/i;
const TRANSPARENT_LIKE = /^(transparent|rgba\(0,\s*0,\s*0,\s*0\)|#0{6}00|#0{8})$/i;

/** S8: HTMLの箇所の実測値を、CSSプロパティ名ではなく会話語で表す。透明・0px・既定値は出さない。 */
export function describeComputed(computed: Partial<Record<ComputedKey, string>>): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(computed) as [ComputedKey, string][]) {
    const label = LABEL[key];
    if (!label || !value) continue;
    if (ZERO_LIKE.test(value.trim()) || TRANSPARENT_LIKE.test(value.trim())) continue;
    lines.push(`${label} ${value}`);
  }
  return lines;
}
