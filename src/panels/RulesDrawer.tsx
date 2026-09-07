import { colorPickRequest, saveRuleSet, updateBoard } from '../state';
import { Drawer } from './Drawer';
import { FontPicker } from '../pickers/FontPicker';
import { MotionPicker } from '../pickers/MotionPicker';
import { Ladder } from '../pickers/Ladder';
import { LADDER_TABLE, TONE_CHIPS } from '../vocab';
import type { Board, Rules } from '../schema';

const PALETTE_ROLES: { id: 'bg' | 'text' | 'accent' | 'sub'; label: string }[] = [
  { id: 'bg', label: '背景' },
  { id: 'text', label: '文字' },
  { id: 'accent', label: '強調' },
  { id: 'sub', label: '補助' },
];

const TYPE_ROLES: { id: 'heading' | 'body' | 'caption'; label: string }[] = [
  { id: 'heading', label: '見出し' },
  { id: 'body', label: '本文' },
  { id: 'caption', label: '注釈' },
];

const MOTION_TRIGGERS: { id: 'enter' | 'hover' | 'transition'; label: string }[] = [
  { id: 'enter', label: '登場時' },
  { id: 'hover', label: 'ホバー' },
  { id: 'transition', label: '切り替え' },
];

export function RulesDrawer({ board, onClose }: { board: Board; onClose: () => void }) {
  const hasImage = board.pages.some((p) => p.image);

  function updateRules(recipe: (r: Rules) => Rules) {
    updateBoard((b) => ({ ...b, rules: recipe(b.rules) }));
  }

  return (
    <Drawer onClose={onClose} header={<span class="tab is-active">ルール</span>}>
      <div class="drawer-body">
        <div class="field">
          <span class="field-label">色</span>
          {PALETTE_ROLES.map((role) => {
            const entry = board.rules.palette.find((p) => p.role === role.id);
            function setHex(hex: string) {
              updateRules((r) => ({ ...r, palette: [...r.palette.filter((p) => p.role !== role.id), { role: role.id, hex }] }));
            }
            return (
              <div class="field-inline" key={role.id}>
                <span class="field-label">{role.label}</span>
                <span class="swatch" style={{ background: entry?.hex ?? '#ffffff' }} />
                <input class="text-input hex-input" value={entry?.hex ?? ''} placeholder="#rrggbb" onInput={(e) => setHex((e.target as HTMLInputElement).value)} />
                {hasImage && (
                  <button class="btn-sm" onClick={() => (colorPickRequest.value = { onPick: setHex })}>
                    スポイト
                  </button>
                )}
                {entry && (
                  <button class="btn-sm" onClick={() => updateRules((r) => ({ ...r, palette: r.palette.filter((p) => p.role !== role.id) }))}>
                    削除
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div class="field">
          <span class="field-label">文字</span>
          {TYPE_ROLES.map((role) => {
            const entry = board.rules.type.find((t) => t.role === role.id);
            return (
              <div class="note-block" key={role.id}>
                <span class="field-label">{role.label}</span>
                <FontPicker
                  sample={role.label}
                  value={entry?.mood}
                  onChange={(mood) =>
                    updateRules((r) => {
                      const type = entry ? r.type.map((t) => (t.role === role.id ? { ...t, mood } : t)) : [...r.type, { role: role.id, mood }];
                      return { ...r, type };
                    })
                  }
                />
                <Ladder
                  attr="fontSize"
                  value={{ target: { step: entry?.size !== undefined ? LADDER_TABLE.fontSize.steps.indexOf(entry.size) : 3 } }}
                  hideRelative
                  hideNow
                  onChange={(v) => {
                    if (!('step' in v.target)) return;
                    const size = LADDER_TABLE.fontSize.steps[v.target.step] as number;
                    updateRules((r) => {
                      const type = entry ? r.type.map((t) => (t.role === role.id ? { ...t, size } : t)) : [...r.type, { role: role.id, size }];
                      return { ...r, type };
                    });
                  }}
                />
                {entry && (
                  <button class="btn-sm" onClick={() => updateRules((r) => ({ ...r, type: r.type.filter((t) => t.role !== role.id) }))}>
                    削除
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div class="field">
          <span class="field-label">余白(基準)</span>
          <Ladder
            attr="spacing"
            value={{ target: { step: board.rules.spacing ?? 2 } }}
            hideRelative
            hideNow
            onChange={(v) => {
              if (!('step' in v.target)) return;
              const step = v.target.step;
              updateRules((r) => ({ ...r, spacing: step }));
            }}
          />
        </div>

        <div class="field">
          <span class="field-label">動き</span>
          {MOTION_TRIGGERS.map((trig) => {
            const entry = board.rules.motion.find((m) => m.trigger === trig.id);
            return (
              <div class="note-block" key={trig.id}>
                <span class="field-label">{trig.label}</span>
                <MotionPicker
                  value={{ motion: entry?.motion, trigger: trig.id, speed: entry?.speed, intensity: entry?.intensity }}
                  onChange={(v) =>
                    updateRules((r) => ({
                      ...r,
                      motion: v.motion
                        ? [...r.motion.filter((m) => m.trigger !== trig.id), { trigger: trig.id, motion: v.motion, speed: v.speed, intensity: v.intensity }]
                        : r.motion.filter((m) => m.trigger !== trig.id),
                    }))
                  }
                />
              </div>
            );
          })}
        </div>

        <div class="field">
          <span class="field-label">トーン</span>
          <div class="chip-row">
            {TONE_CHIPS.map((chip) => (
              <button
                key={chip}
                class={`chip${board.rules.tone.includes(chip) ? ' is-active' : ''}`}
                onClick={() =>
                  updateRules((r) => ({
                    ...r,
                    tone: r.tone.includes(chip) ? r.tone.filter((c) => c !== chip) : [...r.tone, chip],
                  }))
                }
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        <button
          class="btn"
          onClick={() => {
            const name = prompt('このルールの名前');
            if (name) saveRuleSet(name, board.rules);
          }}
        >
          名前をつけて保存する
        </button>
      </div>
    </Drawer>
  );
}
