import { useEffect, useRef, useState } from 'preact/hooks';
import { colorPickRequest, currentBoard, selectedSpotId, updateBoard } from '../state';
import { getSpotEditTarget } from '../lib/spotTarget';
import { clampRect } from '../lib/geometry';
import { ruleRefOptions } from '../lib/ruleRefs';
import { COLOR_ROLES, LADDER_ATTRS, LADDER_TABLE, TONE_CHIPS } from '../vocab';
import { Ladder } from '../pickers/Ladder';
import { ColorPicker } from '../pickers/ColorPicker';
import { FontPicker } from '../pickers/FontPicker';
import { MotionPicker } from '../pickers/MotionPicker';
import type { LadderAttr, Note, Rules, Spot } from '../schema';

const NUDGE = 0.02;
type Adder = 'font' | 'motion' | 'ladder-menu' | { ladder: LadderAttr } | null;

/** 「このボードの基準にする」をデフォルトで開くかどうか。既にルールがあるボードでは開く。 */
function hasAnyRules(rules: Rules): boolean {
  return rules.palette.length > 0 || rules.type.length > 0 || rules.spacing !== undefined || rules.motion.length > 0 || rules.tone.length > 0;
}
const TYPE_ROLES: { id: 'heading' | 'body' | 'caption'; label: string }[] = [
  { id: 'heading', label: '見出し' },
  { id: 'body', label: '本文' },
  { id: 'caption', label: '注釈' },
];

export function SpotPanel({ spot }: { spot: Spot }) {
  const labelRef = useRef<HTMLInputElement>(null);
  const board = currentBoard.value!;
  const [adder, setAdder] = useState<Adder>(null);
  const [openColorIds, setOpenColorIds] = useState<Set<string>>(new Set());
  function openColorNote(id: string) {
    setOpenColorIds((prev) => new Set(prev).add(id));
  }
  function closeColorNote(id: string) {
    setOpenColorIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  useEffect(() => {
    if (!spot.label) labelRef.current?.focus();
  }, [spot.id]);

  function updateSpot(recipe: (s: Spot) => Spot) {
    updateBoard((b) => ({ ...b, spots: b.spots.map((s) => (s.id === spot.id ? recipe(s) : s)) }));
  }

  function nudge(dx: number, dy: number) {
    const t = getSpotEditTarget(board, spot);
    t.apply(clampRect({ x: t.rect.x + dx, y: t.rect.y + dy, w: t.rect.w, h: t.rect.h }));
  }

  function center(axis: 'x' | 'y') {
    const t = getSpotEditTarget(board, spot);
    if (axis === 'x') t.apply(clampRect({ ...t.rect, x: 0.5 - t.rect.w / 2 }));
    else t.apply(clampRect({ ...t.rect, y: 0.5 - t.rect.h / 2 }));
  }

  function removeNote(id: string) {
    updateSpot((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  }

  // --- ひとこと ---
  const textNote = spot.notes.find((n): n is Extract<Note, { kind: 'text' }> => n.kind === 'text');
  function updateTextNote(recipe: (n: { text: string; chips: string[] }) => { text: string; chips: string[] }) {
    const base = { text: textNote?.text ?? '', chips: textNote?.chips ?? [] };
    const next = recipe(base);
    updateSpot((s) => {
      const notes = s.notes.filter((n) => n.kind !== 'text');
      if (!next.text && next.chips.length === 0) return { ...s, notes };
      const note: Note = { id: textNote?.id ?? crypto.randomUUID(), kind: 'text', ...next };
      return { ...s, notes: [...notes, note] };
    });
  }

  // --- 色(1スポットにつき複数可) ---
  const colorNotes = spot.notes.filter((n): n is Extract<Note, { kind: 'color' }> => n.kind === 'color');
  function addColorNote() {
    const id = crypto.randomUUID();
    // HTMLページの箇所は、取り込み時に実測した文字色を「今の色」の初期値にする(スポイトの代わり)
    const seedHex = spot.element?.computed.color;
    const note: Note = { id, kind: 'color', target: seedHex ?? '#000000', current: seedHex };
    updateSpot((s) => ({ ...s, notes: [...s.notes, note] }));
    openColorNote(id);
  }
  function patchColorNote(id: string, patch: Partial<Extract<Note, { kind: 'color' }>>) {
    updateSpot((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id && n.kind === 'color' ? { ...n, ...patch } : n)) }));
  }
  function requestColorPick(colorNoteId: string) {
    colorPickRequest.value = {
      onPick: (hex) => {
        const isReference = board.imageRole === 'reference';
        patchColorNote(colorNoteId, isReference ? { target: hex } : { current: hex });
      },
    };
  }
  // 色ノートの役割(文字/背景/強調/線)とルールのパレット役割(bg/text/accent/sub)は語彙が異なるため、
  // 「線」は最も近い「補助(sub)」に対応させる。
  const PALETTE_ROLE_MAP = { text: 'text', bg: 'bg', accent: 'accent', line: 'sub' } as const;
  function promoteColorToRule(note: Extract<Note, { kind: 'color' }>) {
    const role = PALETTE_ROLE_MAP[note.role ?? 'accent'];
    updateBoard((b) => ({
      ...b,
      rules: { ...b.rules, palette: [...b.rules.palette.filter((p) => p.role !== role), { role, hex: note.target }] },
    }));
  }

  // --- 文字の雰囲気(1つ) ---
  const fontNote = spot.notes.find((n): n is Extract<Note, { kind: 'font' }> => n.kind === 'font');
  function setFontMood(moodId: string) {
    updateSpot((s) => {
      const notes = s.notes.filter((n) => n.kind !== 'font');
      return { ...s, notes: [...notes, { id: fontNote?.id ?? crypto.randomUUID(), kind: 'font', mood: moodId }] };
    });
  }
  function promoteFontToRule(role: 'heading' | 'body' | 'caption') {
    if (!fontNote) return;
    updateBoard((b) => {
      const existing = b.rules.type.find((t) => t.role === role);
      const type = existing ? b.rules.type.map((t) => (t.role === role ? { ...t, mood: fontNote.mood } : t)) : [...b.rules.type, { role, mood: fontNote.mood }];
      return { ...b, rules: { ...b.rules, type } };
    });
  }

  // --- 動き(1つ) ---
  const motionNote = spot.notes.find((n): n is Extract<Note, { kind: 'motion' }> => n.kind === 'motion');
  function setMotion(patch: { motion?: string; trigger: 'enter' | 'hover' | 'transition'; speed?: number; intensity?: number }) {
    updateSpot((s) => {
      const notes = s.notes.filter((n) => n.kind !== 'motion');
      if (!patch.motion) return { ...s, notes };
      return { ...s, notes: [...notes, { id: motionNote?.id ?? crypto.randomUUID(), kind: 'motion', motion: patch.motion, trigger: patch.trigger, speed: patch.speed, intensity: patch.intensity }] };
    });
  }
  function promoteMotionToRule() {
    if (!motionNote) return;
    updateBoard((b) => ({
      ...b,
      rules: {
        ...b.rules,
        motion: [
          ...b.rules.motion.filter((m) => m.trigger !== motionNote.trigger),
          { trigger: motionNote.trigger, motion: motionNote.motion, speed: motionNote.speed, intensity: motionNote.intensity },
        ],
      },
    }));
  }

  // --- ラダー(属性ごとに0〜1つ) ---
  function getLadderNote(attr: LadderAttr) {
    return spot.notes.find((n): n is Extract<Note, { kind: 'ladder' }> => n.kind === 'ladder' && n.attr === attr);
  }
  function setLadder(attr: LadderAttr, value: { current?: number; target: { step: number } | { delta: number } }) {
    updateSpot((s) => {
      const notes = s.notes.filter((n) => !(n.kind === 'ladder' && n.attr === attr));
      const existing = getLadderNote(attr);
      return { ...s, notes: [...notes, { id: existing?.id ?? crypto.randomUUID(), kind: 'ladder', attr, ...value }] };
    });
  }
  function promoteFontSizeToRule(role: 'heading' | 'body' | 'caption') {
    const note = getLadderNote('fontSize');
    if (!note || !('step' in note.target)) return;
    const size = LADDER_TABLE.fontSize.steps[note.target.step] as number;
    updateBoard((b) => {
      const existing = b.rules.type.find((t) => t.role === role);
      const type = existing ? b.rules.type.map((t) => (t.role === role ? { ...t, size } : t)) : [...b.rules.type, { role, size }];
      return { ...b, rules: { ...b.rules, type } };
    });
  }
  function promoteSpacingToRule() {
    const note = getLadderNote('spacing');
    if (!note || !('step' in note.target)) return;
    const step = note.target.step;
    updateBoard((b) => ({ ...b, rules: { ...b.rules, spacing: step } }));
  }

  // --- ルールに合わせる ---
  const ruleOptions = ruleRefOptions(board.rules);
  const ruleNotes = spot.notes.filter((n): n is Extract<Note, { kind: 'rule' }> => n.kind === 'rule');
  function toggleRuleNote(ref: string) {
    const existing = ruleNotes.find((n) => n.ruleRef === ref);
    updateSpot((s) => {
      if (existing) return { ...s, notes: s.notes.filter((n) => n.id !== existing.id) };
      return { ...s, notes: [...s.notes, { id: crypto.randomUUID(), kind: 'rule', ruleRef: ref }] };
    });
  }

  const hasImage = board.pages.some((p) => p.image);
  const fontSizeNote = getLadderNote('fontSize');
  const spacingNote = getLadderNote('spacing');

  return (
    <div class="panel-content">
      <label class="field">
        <span class="field-label">箇所 {spot.n}</span>
        <input
          ref={labelRef}
          class="text-input"
          placeholder={`箇所${spot.n}`}
          value={spot.label}
          onInput={(e) => updateSpot((s) => ({ ...s, label: (e.target as HTMLInputElement).value }))}
        />
      </label>

      <label class="field-inline">
        <input type="checkbox" checked={spot.keep} onChange={(e) => updateSpot((s) => ({ ...s, keep: (e.target as HTMLInputElement).checked }))} />
        <span>残す(変えない)</span>
      </label>

      {!spot.keep && (
        <>
          {spot.element && (
            <div class="field">
              <span class="field-label">要素</span>
              <div class="element-info">
                <code class="element-selector">{spot.element.selector}</code>
                {spot.element.text && <span class="muted">「{spot.element.text}」</span>}
              </div>
              {Object.keys(spot.element.computed).length > 0 && (
                <div class="element-computed">
                  {Object.entries(spot.element.computed).map(([k, v]) => (
                    <span key={k}>
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {!spot.element && (
            <div class="field">
              <span class="field-label">位置・大きさ</span>
              <div class="nudge-grid">
                <button class="btn-sm" onClick={() => nudge(0, -NUDGE)}>上へ</button>
                <button class="btn-sm" onClick={() => nudge(0, NUDGE)}>下へ</button>
                <button class="btn-sm" onClick={() => nudge(-NUDGE, 0)}>左へ</button>
                <button class="btn-sm" onClick={() => nudge(NUDGE, 0)}>右へ</button>
                <button class="btn-sm" onClick={() => center('x')}>左右中央</button>
                <button class="btn-sm" onClick={() => center('y')}>上下中央</button>
              </div>
            </div>
          )}

          {/* 色 */}
          <div class="field">
            <span class="field-label">色</span>
            {colorNotes.map((note) => {
              const isOpen = openColorIds.has(note.id);
              return (
                <div class="note-block" key={note.id}>
                  {isOpen ? (
                    <>
                      <ColorPicker
                        value={note}
                        imageRole={board.imageRole}
                        hasImage={hasImage}
                        rulesPalette={board.rules.palette.map((p) => ({ role: p.role, hex: p.hex }))}
                        onChange={(patch) => patchColorNote(note.id, patch)}
                        onRequestPick={() => requestColorPick(note.id)}
                      />
                      <div class="chip-row">
                        <button class="btn-sm" onClick={() => closeColorNote(note.id)}>閉じる</button>
                        <button class="btn-sm" onClick={() => removeNote(note.id)}>この色指定を削除</button>
                      </div>
                      <details class="note-details" open={hasAnyRules(board.rules)}>
                        <summary>このボードの基準にする</summary>
                        <button class="btn-sm" onClick={() => promoteColorToRule(note)}>基準にする</button>
                      </details>
                    </>
                  ) : (
                    <div class="note-summary-row">
                      <span class="swatch" style={{ background: note.target }} />
                      <span class="note-summary-text">
                        {note.current ? `${note.current} → ` : ''}
                        {note.target}
                        {note.role ? `(${COLOR_ROLES.find((r) => r.id === note.role)?.label ?? note.role})` : ''}
                      </span>
                      <button class="btn-sm" onClick={() => openColorNote(note.id)}>編集</button>
                      <button class="btn-sm" onClick={() => removeNote(note.id)}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
            <button class="btn-sm" onClick={addColorNote}>＋ 色を指定する</button>
          </div>

          {/* 文字の雰囲気 */}
          <div class="field">
            <span class="field-label">文字の雰囲気</span>
            {adder === 'font' ? (
              <FontPicker sample={spot.label || '見出しのサンプル Sample'} value={fontNote?.mood} onChange={setFontMood} />
            ) : (
              <button class="btn-sm" onClick={() => setAdder('font')}>
                {fontNote ? `変更する(現在: ${fontNote.mood})` : '＋ 文字の雰囲気を選ぶ'}
              </button>
            )}
            {fontNote && (
              <details class="note-details" open={hasAnyRules(board.rules)}>
                <summary>このボードの基準にする</summary>
                <div class="chip-row">
                  {TYPE_ROLES.map((r) => (
                    <button key={r.id} class="btn-sm" onClick={() => promoteFontToRule(r.id)}>{r.label}に</button>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* 大きさ・余白・形(ラダー) */}
          <div class="field">
            <span class="field-label">大きさ・余白・形</span>
            {LADDER_ATTRS.filter((attr) => getLadderNote(attr)).map((attr) => (
              <div class="note-block" key={attr}>
                <span class="field-label">{LADDER_TABLE[attr].label}</span>
                <Ladder attr={attr} value={getLadderNote(attr)!} onChange={(v) => setLadder(attr, v)} />
                {attr === 'fontSize' && fontSizeNote && 'step' in fontSizeNote.target && (
                  <details class="note-details" open={hasAnyRules(board.rules)}>
                    <summary>このボードの基準にする</summary>
                    <div class="chip-row">
                      {TYPE_ROLES.map((r) => (
                        <button key={r.id} class="btn-sm" onClick={() => promoteFontSizeToRule(r.id)}>{r.label}に</button>
                      ))}
                    </div>
                  </details>
                )}
                {attr === 'spacing' && spacingNote && 'step' in spacingNote.target && (
                  <details class="note-details" open={hasAnyRules(board.rules)}>
                    <summary>このボードの基準にする</summary>
                    <button class="btn-sm" onClick={promoteSpacingToRule}>余白を基準にする</button>
                  </details>
                )}
                <button
                  class="btn-sm"
                  onClick={() => updateSpot((s) => ({ ...s, notes: s.notes.filter((n) => !(n.kind === 'ladder' && n.attr === attr)) }))}
                >
                  削除
                </button>
              </div>
            ))}
            {typeof adder === 'object' && adder?.ladder ? (
              <div class="note-block">
                <Ladder attr={adder.ladder} value={{ target: { step: 0 } }} onChange={(v) => { setLadder(adder.ladder, v); setAdder(null); }} />
              </div>
            ) : adder === 'ladder-menu' ? (
              <div class="chip-row">
                {LADDER_ATTRS.filter((attr) => !getLadderNote(attr)).map((attr) => (
                  <button key={attr} class="btn-sm" onClick={() => setAdder({ ladder: attr })}>
                    ＋ {LADDER_TABLE[attr].label}
                  </button>
                ))}
              </div>
            ) : (
              LADDER_ATTRS.some((attr) => !getLadderNote(attr)) && (
                <button class="btn-sm" onClick={() => setAdder('ladder-menu')}>＋ 大きさ・余白・形を指定する</button>
              )
            )}
          </div>

          {/* 動き */}
          <div class="field">
            <span class="field-label">動き</span>
            {adder === 'motion' ? (
              <MotionPicker
                value={{ motion: motionNote?.motion, trigger: motionNote?.trigger ?? 'enter', speed: motionNote?.speed, intensity: motionNote?.intensity }}
                onChange={setMotion}
              />
            ) : (
              <button class="btn-sm" onClick={() => setAdder('motion')}>
                {motionNote ? '動きを変更する' : '＋ 動きをつける'}
              </button>
            )}
            {motionNote && (
              <details class="note-details" open={hasAnyRules(board.rules)}>
                <summary>このボードの基準にする</summary>
                <button class="btn-sm" onClick={promoteMotionToRule}>基準にする</button>
              </details>
            )}
          </div>

          {/* ルールに合わせる */}
          {ruleOptions.length > 0 && (
            <div class="field">
              <span class="field-label">ルールに合わせる</span>
              <div class="chip-row">
                {ruleOptions.map((opt) => (
                  <button
                    key={opt.ref}
                    class={`chip${ruleNotes.some((n) => n.ruleRef === opt.ref) ? ' is-active' : ''}`}
                    aria-pressed={ruleNotes.some((n) => n.ruleRef === opt.ref)}
                    onClick={() => toggleRuleNote(opt.ref)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div class="field">
        <span class="field-label">ひとこと</span>
        <div class="chip-row">
          {TONE_CHIPS.map((chip) => {
            const active = textNote?.chips.includes(chip) ?? false;
            return (
              <button
                key={chip}
                class={`chip${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() =>
                  updateTextNote((n) => ({ ...n, chips: active ? n.chips.filter((c) => c !== chip) : [...n.chips, chip] }))
                }
              >
                {chip}
              </button>
            );
          })}
        </div>
        <textarea
          class="text-area"
          rows={2}
          placeholder="自由に書く"
          value={textNote?.text ?? ''}
          onInput={(e) => updateTextNote((n) => ({ ...n, text: (e.target as HTMLTextAreaElement).value }))}
        />
      </div>

      <button
        class="btn-danger"
        onClick={() => {
          updateBoard((b) => ({ ...b, spots: b.spots.filter((s) => s.id !== spot.id) }));
          selectedSpotId.value = null;
        }}
      >
        この箇所を削除
      </button>
    </div>
  );
}
