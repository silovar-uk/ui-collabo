import type { Rules } from '../schema';
import { FONT_MOODS } from '../vocab';

const ROLE_LABEL: Record<string, string> = { bg: '背景', text: '文字', accent: '強調', sub: '補助' };
const TYPE_ROLE_LABEL: Record<string, string> = { heading: '見出し', body: '本文', caption: '注釈' };

export interface RuleRefOption {
  ref: string;
  label: string;
}

/** ボードのルールから「ルールに合わせる」で選べる項目一覧を作る。 */
export function ruleRefOptions(rules: Rules): RuleRefOption[] {
  const options: RuleRefOption[] = [];
  for (const p of rules.palette) {
    options.push({ ref: `palette.${p.role}`, label: `${ROLE_LABEL[p.role] ?? p.role}の色(${p.hex})` });
  }
  for (const t of rules.type) {
    const roleLabel = TYPE_ROLE_LABEL[t.role] ?? t.role;
    if (t.size !== undefined) options.push({ ref: `type.${t.role}.size`, label: `${roleLabel}の文字サイズ(${t.size}px)` });
    if (t.mood) {
      const moodLabel = FONT_MOODS.find((m) => m.id === t.mood)?.label ?? t.mood;
      options.push({ ref: `type.${t.role}.mood`, label: `${roleLabel}の雰囲気(${moodLabel})` });
    }
  }
  if (rules.spacing !== undefined) {
    options.push({ ref: 'spacing', label: `余白(段階${rules.spacing})` });
  }
  return options;
}
