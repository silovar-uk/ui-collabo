import { uniqueSelector } from './domPick';
import { rgbStringToHex } from './color';
import { nearestStepIndex, parseNumber } from './htmlCss';
import type { Rules } from '../schema';

export interface ElementRecord {
  selector: string;
  fontSize?: string;
  color?: string;
  background?: string;
  radius?: string;
  area: number;
}

export interface TallyEntry {
  value: string;
  count: number;
  selectors: string[];
}

const KEY_MAP = { fontSize: 'fontSize', color: 'color', background: 'background', radius: 'radius' } as const;

/** R1-c: 値ごとの件数表を作る。表示中で文字を持つ要素の記録(ElementRecord)から集計するだけの純関数。 */
export function tally(records: ElementRecord[], key: keyof typeof KEY_MAP): TallyEntry[] {
  const map = new Map<string, TallyEntry>();
  for (const r of records) {
    const v = r[key];
    if (!v) continue;
    if (!map.has(v)) map.set(v, { value: v, count: 0, selectors: [] });
    const entry = map.get(v)!;
    entry.count++;
    entry.selectors.push(r.selector);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** 表示中で、直接の文字を持つ要素だけをDOMから集める。 */
export function collectElementRecords(doc: Document): ElementRecord[] {
  const view = doc.defaultView;
  if (!view) return [];
  const records: ElementRecord[] = [];
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const hasOwnText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
    if (!hasOwnText) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = view.getComputedStyle(el);
    records.push({
      selector: uniqueSelector(el),
      fontSize: cs.fontSize || undefined,
      color: rgbStringToHex(cs.color) ?? undefined,
      background: rgbStringToHex(cs.backgroundColor) ?? undefined,
      radius: cs.borderTopLeftRadius && cs.borderTopLeftRadius !== '0px' ? cs.borderTopLeftRadius : undefined,
      area: rect.width * rect.height,
    });
  }
  return records;
}

export interface RuleDeviation {
  selector: string;
  ruleRef: string;
  area: number;
}

/**
 * R1-c: ルールの段から外れた要素を探す(面積の大きい順に最大12個)。文字サイズはrules.type、
 * 色はrules.paletteと比較する。役割は「本文/文字」があればそれを、なければ先頭のルールを使う。
 */
export function findRuleDeviations(records: ElementRecord[], rules: Rules, max = 12): RuleDeviation[] {
  const sizeRules = rules.type.filter((t): t is { role: 'heading' | 'body' | 'caption'; size: number; mood?: string } => t.size !== undefined);
  const primarySize = sizeRules.find((t) => t.role === 'body') ?? sizeRules[0];
  const primaryPalette = rules.palette.find((p) => p.role === 'text') ?? rules.palette[0];

  const results: RuleDeviation[] = [];
  for (const rec of records) {
    if (primarySize && rec.fontSize) {
      const num = parseNumber(rec.fontSize);
      if (num !== null) {
        const matches = sizeRules.some((t) => nearestStepIndex('fontSize', num) === nearestStepIndex('fontSize', t.size));
        if (!matches) results.push({ selector: rec.selector, ruleRef: `type.${primarySize.role}.size`, area: rec.area });
      }
    }
    if (primaryPalette && rec.color) {
      const matches = rules.palette.some((p) => p.hex.toLowerCase() === rec.color!.toLowerCase());
      if (!matches) results.push({ selector: rec.selector, ruleRef: `palette.${primaryPalette.role}`, area: rec.area });
    }
  }
  return results.sort((a, b) => b.area - a.area).slice(0, max);
}
