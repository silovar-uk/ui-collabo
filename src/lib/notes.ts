import type { Board, LadderAttr, Note, Spot } from '../schema';
import { LADDER_TABLE } from '../vocab';

/** H3: パレット・指示書の両方が使う、箇所のノート更新の純関数群。すべて(board: Board) => Boardを返す。 */
export type Recipe = (board: Board) => Board;

function updateSpot(spotId: string, recipe: (s: Spot) => Spot): Recipe {
  return (b) => ({ ...b, spots: b.spots.map((s) => (s.id === spotId ? recipe(s) : s)) });
}

export function setLabel(spotId: string, label: string): Recipe {
  return updateSpot(spotId, (s) => ({ ...s, label }));
}

export function setKeep(spotId: string, keep: boolean): Recipe {
  return updateSpot(spotId, (s) => ({ ...s, keep }));
}

/** R2: 照合の○/×。○は直ったとみなしkeepも立てる(次の修正で壊させないため)。×はkeepを外す。 */
export function setSpotCheck(spotId: string, check: 'ok' | 'ng'): Recipe {
  return updateSpot(spotId, (s) => ({ ...s, check, keep: check === 'ok' }));
}

export function removeNote(spotId: string, noteId: string): Recipe {
  return updateSpot(spotId, (s) => ({ ...s, notes: s.notes.filter((n) => n.id !== noteId) }));
}

// --- ひとこと ---
export function updateTextNote(spotId: string, recipe: (n: { text: string; chips: string[] }) => { text: string; chips: string[] }): Recipe {
  return updateSpot(spotId, (s) => {
    const existing = s.notes.find((n): n is Extract<Note, { kind: 'text' }> => n.kind === 'text');
    const base = { text: existing?.text ?? '', chips: existing?.chips ?? [] };
    const next = recipe(base);
    const notes = s.notes.filter((n) => n.kind !== 'text');
    if (!next.text && next.chips.length === 0) return { ...s, notes };
    return { ...s, notes: [...notes, { id: existing?.id ?? crypto.randomUUID(), kind: 'text', ...next }] };
  });
}

// --- 色(1箇所に複数可) ---
/** idは呼び出し側で生成して渡す(追加直後にその色エディタを開くため)。 */
export function addColorNote(spotId: string, id: string): Recipe {
  return (b) => {
    const spot = b.spots.find((s) => s.id === spotId);
    if (!spot) return b;
    // HTMLページの箇所は、取り込み時に実測した文字色を「今の色」の初期値にする(スポイトの代わり)
    const seedHex = spot.element?.computed.color;
    const note: Note = { id, kind: 'color', target: seedHex ?? '#000000', current: seedHex };
    return { ...b, spots: b.spots.map((s) => (s.id === spotId ? { ...s, notes: [...s.notes, note] } : s)) };
  };
}

export function patchColorNote(spotId: string, noteId: string, patch: Partial<Extract<Note, { kind: 'color' }>>): Recipe {
  return updateSpot(spotId, (s) => ({ ...s, notes: s.notes.map((n) => (n.id === noteId && n.kind === 'color' ? { ...n, ...patch } : n)) }));
}

// 色ノートの役割(文字/背景/強調/線)とルールのパレット役割(bg/text/accent/sub)は語彙が異なるため、
// 「線」は最も近い「補助(sub)」に対応させる。
const PALETTE_ROLE_MAP = { text: 'text', bg: 'bg', accent: 'accent', line: 'sub' } as const;
export function promoteColorToRule(note: Extract<Note, { kind: 'color' }>): Recipe {
  return (b) => {
    const role = PALETTE_ROLE_MAP[note.role ?? 'accent'];
    return { ...b, rules: { ...b.rules, palette: [...b.rules.palette.filter((p) => p.role !== role), { role, hex: note.target }] } };
  };
}

// --- 文字の雰囲気(1箇所に1つ) ---
export function setFontMood(spotId: string, moodId: string): Recipe {
  return updateSpot(spotId, (s) => {
    const existing = s.notes.find((n): n is Extract<Note, { kind: 'font' }> => n.kind === 'font');
    const notes = s.notes.filter((n) => n.kind !== 'font');
    return { ...s, notes: [...notes, { id: existing?.id ?? crypto.randomUUID(), kind: 'font', mood: moodId }] };
  });
}

export function promoteFontToRule(fontNote: Extract<Note, { kind: 'font' }>, role: 'heading' | 'body' | 'caption'): Recipe {
  return (b) => {
    const existing = b.rules.type.find((t) => t.role === role);
    const type = existing ? b.rules.type.map((t) => (t.role === role ? { ...t, mood: fontNote.mood } : t)) : [...b.rules.type, { role, mood: fontNote.mood }];
    return { ...b, rules: { ...b.rules, type } };
  };
}

// --- 動き(1箇所に1つ) ---
export function setMotion(spotId: string, patch: { motion?: string; trigger: 'enter' | 'hover' | 'transition'; speed?: number; intensity?: number }): Recipe {
  return updateSpot(spotId, (s) => {
    const existing = s.notes.find((n): n is Extract<Note, { kind: 'motion' }> => n.kind === 'motion');
    const notes = s.notes.filter((n) => n.kind !== 'motion');
    if (!patch.motion) return { ...s, notes };
    return {
      ...s,
      notes: [...notes, { id: existing?.id ?? crypto.randomUUID(), kind: 'motion', motion: patch.motion, trigger: patch.trigger, speed: patch.speed, intensity: patch.intensity }],
    };
  });
}

export function promoteMotionToRule(motionNote: Extract<Note, { kind: 'motion' }>): Recipe {
  return (b) => ({
    ...b,
    rules: {
      ...b.rules,
      motion: [
        ...b.rules.motion.filter((m) => m.trigger !== motionNote.trigger),
        { trigger: motionNote.trigger, motion: motionNote.motion, speed: motionNote.speed, intensity: motionNote.intensity },
      ],
    },
  });
}

// --- ラダー(属性ごとに0〜1つ) ---
export function setLadder(spotId: string, attr: LadderAttr, value: { current?: number; target: { step: number } | { delta: number } }): Recipe {
  return updateSpot(spotId, (s) => {
    const notes = s.notes.filter((n) => !(n.kind === 'ladder' && n.attr === attr));
    const existing = s.notes.find((n): n is Extract<Note, { kind: 'ladder' }> => n.kind === 'ladder' && n.attr === attr);
    return { ...s, notes: [...notes, { id: existing?.id ?? crypto.randomUUID(), kind: 'ladder', attr, ...value }] };
  });
}

export function removeLadder(spotId: string, attr: LadderAttr): Recipe {
  return updateSpot(spotId, (s) => ({ ...s, notes: s.notes.filter((n) => !(n.kind === 'ladder' && n.attr === attr)) }));
}

export function promoteFontSizeToRule(note: Extract<Note, { kind: 'ladder' }>, role: 'heading' | 'body' | 'caption'): Recipe {
  return (b) => {
    if (!('step' in note.target)) return b;
    const size = LADDER_TABLE.fontSize.steps[note.target.step] as number;
    const existing = b.rules.type.find((t) => t.role === role);
    const type = existing ? b.rules.type.map((t) => (t.role === role ? { ...t, size } : t)) : [...b.rules.type, { role, size }];
    return { ...b, rules: { ...b.rules, type } };
  };
}

export function promoteSpacingToRule(note: Extract<Note, { kind: 'ladder' }>): Recipe {
  return (b) => {
    if (!('step' in note.target)) return b;
    return { ...b, rules: { ...b.rules, spacing: note.target.step } };
  };
}

// --- ルールに合わせる ---
export function toggleRuleNote(spotId: string, ref: string): Recipe {
  return updateSpot(spotId, (s) => {
    const existing = s.notes.find((n): n is Extract<Note, { kind: 'rule' }> => n.kind === 'rule' && n.ruleRef === ref);
    if (existing) return { ...s, notes: s.notes.filter((n) => n.id !== existing.id) };
    return { ...s, notes: [...s.notes, { id: crypto.randomUUID(), kind: 'rule', ruleRef: ref }] };
  });
}
