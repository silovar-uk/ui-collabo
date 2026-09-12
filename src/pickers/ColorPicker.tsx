import { hexToHsl, hslToHex } from '../lib/color';
import { COLOR_DIRECTIONS, COLOR_ROLES } from '../vocab';
import type { ImageRole } from '../schema';

export interface ColorPickerValue {
  current?: string;
  target: string;
  via?: string;
  role?: 'text' | 'bg' | 'accent' | 'line';
}

interface Props {
  value: ColorPickerValue;
  imageRole: ImageRole | null;
  hasImage: boolean;
  rulesPalette: { role: string; hex: string }[];
  onChange: (patch: Partial<ColorPickerValue>) => void;
  /** スポイトモードを開始する。実際の採取と反映はBoardが行う。 */
  onRequestPick: () => void;
}

export function ColorPicker({ value: note, imageRole, hasImage, rulesPalette, onChange, onRequestPick }: Props) {
  const isReference = imageRole === 'reference';
  const baseHex = isReference ? note.target : note.current;
  const nowLabel = isReference ? 'この色を使いたい' : '今の色';
  // S8(破れ#5): hasImage(画像の有無)ではなくcurrentの有無で出し分ける。HTMLページの箇所も実測値がある
  const showNow = isReference ? hasImage : baseHex !== undefined || hasImage;

  return (
    <div class="color-picker">
      {showNow && (
        <div class="field-inline">
          <span class="field-label">{nowLabel}</span>
          {baseHex && <span class="swatch" style={{ background: baseHex }} />}
          <span class="muted">{baseHex ?? '未取得'}</span>
          {hasImage && (
            <button class="btn-sm" onClick={onRequestPick}>
              スポイトで拾う
            </button>
          )}
        </div>
      )}

      {!isReference && (
        <div class="field">
          <span class="field-label">こうしたい色</span>
          <div class="chip-row">
            {COLOR_DIRECTIONS.map((dir) => {
              const disabled = !note.current;
              return (
                <button
                  key={dir.id}
                  class={`chip${note.via === dir.id ? ' is-active' : ''}`}
                  aria-pressed={note.via === dir.id}
                  disabled={disabled}
                  title={disabled ? '先に「今の色」を拾ってください' : ''}
                  onClick={() => {
                    if (!note.current) return;
                    const next = hslToHex(dir.apply(hexToHsl(note.current)));
                    onChange({ target: next, via: dir.id });
                  }}
                >
                  {dir.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rulesPalette.length > 0 && (
        <div class="field">
          <span class="field-label">ルールの色</span>
          <div class="chip-row">
            {rulesPalette.map((p) => (
              <button key={p.role} class="chip swatch-chip" onClick={() => onChange({ target: p.hex, via: undefined })}>
                <span class="swatch" style={{ background: p.hex }} />
                {p.role}
              </button>
            ))}
          </div>
        </div>
      )}

      <div class="field-inline">
        <span class="field-label">hex</span>
        <input
          class="text-input hex-input"
          value={note.target}
          onInput={(e) => onChange({ target: (e.target as HTMLInputElement).value, via: undefined })}
        />
      </div>

      <div class="chip-row">
        {COLOR_ROLES.map((r) => (
          <button
            key={r.id}
            class={`chip${note.role === r.id ? ' is-active' : ''}`}
            aria-pressed={note.role === r.id}
            onClick={() => onChange({ role: r.id })}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
