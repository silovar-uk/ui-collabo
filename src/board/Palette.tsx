import { useEffect, useRef, useState } from 'preact/hooks';
import { colorPickRequest, deleteSpot, measureRequest, pickerOpen, requestOpenCategory, updateBoard } from '../state';
import * as notes from '../lib/notes';
import { ruleRefOptions } from '../lib/ruleRefs';
import { getSpotEditTarget } from '../lib/spotTarget';
import { clampRect, ratioToPx, type ContainRect } from '../lib/geometry';
import { LADDER_TO_CSS, nearestStepIndex, parseNumber } from '../lib/htmlCss';
import { describeComputed } from '../lib/describeElement';
import { ALL_COMMANDS, searchCommands, type Command } from '../lib/commands';
import { COLOR_ROLES, FONT_MOODS, LADDER_ATTRS, LADDER_TABLE, TONE_CHIPS } from '../vocab';
import { Ladder } from '../pickers/Ladder';
import { ColorPicker } from '../pickers/ColorPicker';
import { FontPicker } from '../pickers/FontPicker';
import { MotionPicker } from '../pickers/MotionPicker';
import type { Board, LadderAttr, Note, Spot } from '../schema';
import type { PaletteCategory } from '../state';

type Category = PaletteCategory | 'search' | null;

function isTypingTarget(el: EventTarget | null): boolean {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

function CommandPreviewView({ command }: { command: Command }) {
  const preview = command.preview;
  if (!preview) return null;
  if (preview.kind === 'font') {
    const mood = FONT_MOODS.find((m) => m.id === preview.moodId);
    if (!mood) return null;
    return <span style={{ fontFamily: `${mood.font}, ${mood.fallback}` }}>Aa</span>;
  }
  if (preview.kind === 'motion') {
    return <span class={`motion-target motion-${preview.motionId}`}>あ</span>;
  }
  if (preview.kind === 'ladder') {
    const def = LADDER_TABLE[preview.attr];
    const raw = def.steps[preview.step];
    if (preview.attr === 'fontSize' && typeof raw === 'number') return <span style={{ fontSize: `${raw}px`, lineHeight: 1 }}>Aa</span>;
    return null;
  }
  return null;
}
const NUDGE = 0.02;
const POPOVER_W = 300;
// R1-a: 定規で測れる属性(長さとして意味を持つもの)
const MEASURABLE_ATTRS: LadderAttr[] = ['fontSize', 'spacing', 'radius', 'lineWidth'];

const TYPE_ROLES: { id: 'heading' | 'body' | 'caption'; label: string }[] = [
  { id: 'heading', label: '見出し' },
  { id: 'body', label: '本文' },
  { id: 'caption', label: '注釈' },
];

function hasAnyRules(rules: Board['rules']): boolean {
  return rules.palette.length > 0 || rules.type.length > 0 || rules.spacing !== undefined || rules.motion.length > 0 || rules.tone.length > 0;
}

/** H3: 選択中の箇所の横に浮く朱のパレット。押すと、対応するピッカーがpopoverで開く。 */
export function Palette({ board, spot, cr }: { board: Board; spot: Spot; cr: ContainRect }) {
  const [open, setOpen] = useState<Category>(null);
  const [ladderAdder, setLadderAdder] = useState<LadderAttr | 'menu' | null>(null);
  const [openColorIds, setOpenColorIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // R4: 箇所を選んだ状態で文字キーを打つ(または/)と、パレットに検索欄が開く
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target) || open !== null) return;
      if (e.key === '/' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /^[\p{L}\p{N}]$/u.test(e.key))) {
        e.preventDefault();
        setSearchQuery(e.key === '/' ? '' : e.key);
        setSearchIndex(0);
        setOpen('search');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open === 'search') searchInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    pickerOpen.value = open !== null;
    if (open === null) {
      setLadderAdder(null);
      setOpenColorIds(new Set());
      setSearchQuery('');
      setSearchIndex(0);
    }
  }, [open]);

  // S6: Escapeで(useBoardKeysが)pickerOpenをfalseにしたら、ここも閉じる
  useEffect(() => {
    if (!pickerOpen.value && open !== null) setOpen(null);
  }, [pickerOpen.value]);

  // H3: 指示書(Sheet)の行をクリックすると、その行を作ったピッカーをここで開く
  useEffect(() => {
    const req = requestOpenCategory.value;
    if (req && req.spotId === spot.id) {
      setOpen(req.category);
      requestOpenCategory.value = null;
    }
  }, [requestOpenCategory.value, spot.id]);

  useEffect(() => {
    const pop = popRef.current;
    const bar = barRef.current;
    if (!pop || !bar || open === null) return;
    if (!pop.matches(':popover-open')) pop.showPopover();
    const barBox = bar.getBoundingClientRect();
    const spaceBelow = window.innerHeight - barBox.bottom;
    const top = spaceBelow > 240 || spaceBelow > barBox.top ? barBox.bottom + 6 : Math.max(6, barBox.top - 6);
    const usePlacementAbove = !(spaceBelow > 240 || spaceBelow > barBox.top);
    const left = Math.min(Math.max(6, barBox.left), window.innerWidth - POPOVER_W - 6);
    pop.style.left = `${left}px`;
    pop.style.top = usePlacementAbove ? '' : `${top}px`;
    pop.style.bottom = usePlacementAbove ? `${window.innerHeight - barBox.top + 6}px` : '';
    function onToggle(e: Event) {
      if ((e as ToggleEvent).newState === 'closed') setOpen(null);
    }
    pop.addEventListener('toggle', onToggle);
    return () => pop.removeEventListener('toggle', onToggle);
  }, [open]);

  function toggle(cat: Category) {
    setOpen((cur) => (cur === cat ? null : cat));
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

  function autoNowFor(attr: LadderAttr): number | undefined {
    const cssKey = LADDER_TO_CSS[attr];
    const raw = cssKey ? spot.element?.computed[cssKey] : undefined;
    if (!raw) return undefined;
    const num = parseNumber(raw);
    return num === null ? undefined : nearestStepIndex(attr, num);
  }

  const hasImage = !!board.pages.find((p) => p.id === spot.pageId)?.image;
  const colorNotes = spot.notes.filter((n): n is Extract<Note, { kind: 'color' }> => n.kind === 'color');
  const fontNote = spot.notes.find((n): n is Extract<Note, { kind: 'font' }> => n.kind === 'font');
  const motionNote = spot.notes.find((n): n is Extract<Note, { kind: 'motion' }> => n.kind === 'motion');
  const ruleOptions = ruleRefOptions(board.rules);
  const ruleNotes = spot.notes.filter((n): n is Extract<Note, { kind: 'rule' }> => n.kind === 'rule');
  const textNote = spot.notes.find((n): n is Extract<Note, { kind: 'text' }> => n.kind === 'text');
  const hasLadder = LADDER_ATTRS.some((a) => spot.notes.some((n) => n.kind === 'ladder' && n.attr === a));

  const px = ratioToPx(spot.rect, cr);

  const elementInfo = spot.element ? describeComputed(spot.element.computed) : [];

  return (
    <div class="palette" style={{ left: px.x, top: px.y - 40 }}>
      {spot.element && (
        <div class="palette-caption">
          {elementInfo.join('・')} <code class="element-selector-sm">{spot.element.selector}</code>
        </div>
      )}
      <div class="palette-bar" ref={barRef}>
        {spot.carried && (
          <>
            <button class={`palette-btn palette-btn-ok${spot.check === 'ok' ? ' has-value' : ''}`} onClick={() => updateBoard(notes.setSpotCheck(spot.id, 'ok'))} title="直った">
              ○
            </button>
            <button class={`palette-btn palette-btn-ng${spot.check === 'ng' ? ' has-value' : ''}`} onClick={() => updateBoard(notes.setSpotCheck(spot.id, 'ng'))} title="まだ">
              ×
            </button>
          </>
        )}
        {!spot.element && (
          <button class="palette-btn" onClick={() => toggle('position')} title="位置">
            ⇕
          </button>
        )}
        <button class={`palette-btn${colorNotes.length ? ' has-value' : ''}`} onClick={() => toggle('color')} title="色">
          色
        </button>
        <button class={`palette-btn${fontNote ? ' has-value' : ''}`} onClick={() => toggle('font')} title="文字">
          文字
        </button>
        <button class={`palette-btn${hasLadder ? ' has-value' : ''}`} onClick={() => toggle('ladder')} title="大きさ・余白・形">
          形
        </button>
        <button class={`palette-btn${motionNote ? ' has-value' : ''}`} onClick={() => toggle('motion')} title="動き">
          動
        </button>
        <button class={`palette-btn${textNote ? ' has-value' : ''}`} onClick={() => toggle('text')} title="ひとこと">
          ✎
        </button>
        {ruleOptions.length > 0 && (
          <button class={`palette-btn${ruleNotes.length ? ' has-value' : ''}`} onClick={() => toggle('rule')} title="ルールに合わせる">
            R
          </button>
        )}
        <button class={`palette-btn${spot.keep ? ' has-value' : ''}`} onClick={() => updateBoard(notes.setKeep(spot.id, !spot.keep))} title="残す(変えない)">
          残
        </button>
        <button class="palette-btn palette-btn-danger" onClick={() => deleteSpot(spot.id)} title="この箇所を削除">
          ×
        </button>
      </div>

      <div class="palette-pop" popover="auto" ref={popRef}>
        {open === 'position' && (
          <div class="nudge-grid">
            <button class="btn-sm" onClick={() => nudge(0, -NUDGE)}>上へ</button>
            <button class="btn-sm" onClick={() => nudge(0, NUDGE)}>下へ</button>
            <button class="btn-sm" onClick={() => nudge(-NUDGE, 0)}>左へ</button>
            <button class="btn-sm" onClick={() => nudge(NUDGE, 0)}>右へ</button>
            <button class="btn-sm" onClick={() => center('x')}>左右中央</button>
            <button class="btn-sm" onClick={() => center('y')}>上下中央</button>
          </div>
        )}

        {open === 'color' && (
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
                        onChange={(patch) => updateBoard(notes.patchColorNote(spot.id, note.id, patch))}
                        onRequestPick={() => {
                          colorPickRequest.value = {
                            onPick: (hex) => {
                              const isReference = board.imageRole === 'reference';
                              updateBoard(notes.patchColorNote(spot.id, note.id, isReference ? { target: hex } : { current: hex }));
                            },
                          };
                        }}
                      />
                      <div class="chip-row">
                        <button class="btn-sm" onClick={() => setOpenColorIds((prev) => { const n = new Set(prev); n.delete(note.id); return n; })}>閉じる</button>
                        <button class="btn-sm" onClick={() => updateBoard(notes.removeNote(spot.id, note.id))}>この色指定を削除</button>
                      </div>
                      <details class="note-details" open={hasAnyRules(board.rules)}>
                        <summary>このボードの基準にする</summary>
                        <button class="btn-sm" onClick={() => updateBoard(notes.promoteColorToRule(note))}>基準にする</button>
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
                      <button class="btn-sm" onClick={() => setOpenColorIds((prev) => new Set(prev).add(note.id))}>編集</button>
                      <button class="btn-sm" onClick={() => updateBoard(notes.removeNote(spot.id, note.id))}>×</button>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              class="btn-sm"
              onClick={() => {
                const id = crypto.randomUUID();
                updateBoard(notes.addColorNote(spot.id, id));
                setOpenColorIds((prev) => new Set(prev).add(id));
              }}
            >
              ＋ 色を指定する
            </button>
          </div>
        )}

        {open === 'font' && (
          <div class="field">
            <span class="field-label">文字の雰囲気</span>
            <FontPicker sample={spot.label || '見出しのサンプル Sample'} value={fontNote?.mood} onChange={(id) => updateBoard(notes.setFontMood(spot.id, id))} />
            {fontNote && (
              <details class="note-details" open={hasAnyRules(board.rules)}>
                <summary>このボードの基準にする</summary>
                <div class="chip-row">
                  {TYPE_ROLES.map((r) => (
                    <button key={r.id} class="btn-sm" onClick={() => updateBoard(notes.promoteFontToRule(fontNote, r.id))}>{r.label}に</button>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {open === 'ladder' && (
          <div class="field">
            <span class="field-label">大きさ・余白・形</span>
            {LADDER_ATTRS.filter((attr) => spot.notes.some((n) => n.kind === 'ladder' && n.attr === attr)).map((attr) => {
              const note = spot.notes.find((n): n is Extract<Note, { kind: 'ladder' }> => n.kind === 'ladder' && n.attr === attr)!;
              return (
                <div class="note-block" key={attr}>
                  <span class="field-label">{LADDER_TABLE[attr].label}</span>
                  <Ladder
                    attr={attr}
                    value={note}
                    onChange={(v) => updateBoard(notes.setLadder(spot.id, attr, v))}
                    autoNow={autoNowFor(attr)}
                    onMeasure={
                      !spot.element && MEASURABLE_ATTRS.includes(attr)
                        ? () => {
                            measureRequest.value = {
                              attr,
                              onMeasure: (stepIndex) => updateBoard(notes.setLadder(spot.id, attr, { current: stepIndex, target: note.target })),
                            };
                          }
                        : undefined
                    }
                  />
                  {attr === 'fontSize' && 'step' in note.target && (
                    <details class="note-details" open={hasAnyRules(board.rules)}>
                      <summary>このボードの基準にする</summary>
                      <div class="chip-row">
                        {TYPE_ROLES.map((r) => (
                          <button key={r.id} class="btn-sm" onClick={() => updateBoard(notes.promoteFontSizeToRule(note, r.id))}>{r.label}に</button>
                        ))}
                      </div>
                    </details>
                  )}
                  {attr === 'spacing' && 'step' in note.target && (
                    <details class="note-details" open={hasAnyRules(board.rules)}>
                      <summary>このボードの基準にする</summary>
                      <button class="btn-sm" onClick={() => updateBoard(notes.promoteSpacingToRule(note))}>余白を基準にする</button>
                    </details>
                  )}
                  <button class="btn-sm" onClick={() => updateBoard(notes.removeLadder(spot.id, attr))}>削除</button>
                </div>
              );
            })}
            {typeof ladderAdder === 'string' && ladderAdder !== 'menu' ? (
              <div class="note-block">
                <Ladder attr={ladderAdder} value={{ target: { step: 0 } }} onChange={(v) => { updateBoard(notes.setLadder(spot.id, ladderAdder, v)); setLadderAdder(null); }} autoNow={autoNowFor(ladderAdder)} />
              </div>
            ) : ladderAdder === 'menu' ? (
              <div class="chip-row">
                {LADDER_ATTRS.filter((attr) => !spot.notes.some((n) => n.kind === 'ladder' && n.attr === attr)).map((attr) => (
                  <button key={attr} class="btn-sm" onClick={() => setLadderAdder(attr)}>＋ {LADDER_TABLE[attr].label}</button>
                ))}
              </div>
            ) : (
              LADDER_ATTRS.some((attr) => !spot.notes.some((n) => n.kind === 'ladder' && n.attr === attr)) && (
                <button class="btn-sm" onClick={() => setLadderAdder('menu')}>＋ 大きさ・余白・形を指定する</button>
              )
            )}
          </div>
        )}

        {open === 'motion' && (
          <div class="field">
            <span class="field-label">動き</span>
            <MotionPicker
              value={{ motion: motionNote?.motion, trigger: motionNote?.trigger ?? 'enter', speed: motionNote?.speed, intensity: motionNote?.intensity }}
              onChange={(v) => updateBoard(notes.setMotion(spot.id, v))}
            />
            {motionNote && (
              <details class="note-details" open={hasAnyRules(board.rules)}>
                <summary>このボードの基準にする</summary>
                <button class="btn-sm" onClick={() => updateBoard(notes.promoteMotionToRule(motionNote))}>基準にする</button>
              </details>
            )}
          </div>
        )}

        {open === 'text' && (
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
                    onClick={() => updateBoard(notes.updateTextNote(spot.id, (n) => ({ ...n, chips: active ? n.chips.filter((c) => c !== chip) : [...n.chips, chip] })))}
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
              onInput={(e) => updateBoard(notes.updateTextNote(spot.id, (n) => ({ ...n, text: (e.target as HTMLTextAreaElement).value })))}
            />
          </div>
        )}

        {open === 'rule' && ruleOptions.length > 0 && (
          <div class="field">
            <span class="field-label">ルールに合わせる</span>
            <div class="chip-row">
              {ruleOptions.map((opt) => (
                <button
                  key={opt.ref}
                  class={`chip${ruleNotes.some((n) => n.ruleRef === opt.ref) ? ' is-active' : ''}`}
                  aria-pressed={ruleNotes.some((n) => n.ruleRef === opt.ref)}
                  onClick={() => updateBoard(notes.toggleRuleNote(spot.id, opt.ref))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {open === 'search' &&
          (() => {
            const results = searchCommands(ALL_COMMANDS, searchQuery).slice(0, 20);
            const idx = Math.min(searchIndex, Math.max(0, results.length - 1));
            function applyAt(i: number) {
              const cmd = results[i];
              if (!cmd) return;
              updateBoard((b) => cmd.apply(b, spot));
              setOpen(null);
            }
            return (
              <div class="field command-search">
                <input
                  ref={searchInputRef}
                  class="text-input"
                  placeholder="言葉で探す(例: ちいさ、ふわ)"
                  value={searchQuery}
                  onInput={(e) => {
                    setSearchQuery((e.target as HTMLInputElement).value);
                    setSearchIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setSearchIndex((i) => Math.min(results.length - 1, i + 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSearchIndex((i) => Math.max(0, i - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      applyAt(idx);
                    }
                  }}
                />
                <div class="command-list">
                  {results.map((cmd, i) => (
                    <button key={cmd.id} class={`command-item${i === idx ? ' is-active' : ''}`} onClick={() => applyAt(i)}>
                      <span class="command-preview">
                        <CommandPreviewView command={cmd} />
                      </span>
                      <span class="command-label">{cmd.label}</span>
                    </button>
                  ))}
                  {searchQuery && results.length === 0 && <p class="muted">見つかりませんでした</p>}
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
