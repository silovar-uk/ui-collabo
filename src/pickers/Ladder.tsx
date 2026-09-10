import { LADDER_TABLE, RELATIVE_CHIPS } from '../vocab';
import type { LadderAttr } from '../schema';

interface Value {
  current?: number;
  target: { step: number } | { delta: number };
}

interface Props {
  attr: LadderAttr;
  value: Value;
  onChange: (next: Value) => void;
  /** 「今」の概念がない場面(動きの速さ・強さなど)では相対チップと今ピンを隠す。 */
  hideRelative?: boolean;
  hideNow?: boolean;
  /** 実測値から算出した現在地の段。渡されると「今」ボタンの代わりにこの段へマーカーを自動表示する。 */
  autoNow?: number;
}

function StepPreview({ attr, value }: { attr: LadderAttr; value: number | string }) {
  switch (attr) {
    case 'fontSize':
      return <span style={{ fontSize: `${value}px`, lineHeight: 1 }}>あ Aa</span>;
    case 'weight':
      return <span style={{ fontWeight: value as number, fontSize: '16px' }}>あ Aa</span>;
    case 'spacing':
      return (
        <span class="ladder-box" style={{ padding: `${value}px` }}>
          <span class="ladder-box-inner" />
        </span>
      );
    case 'radius':
      return <span class="ladder-swatch" style={{ borderRadius: value === 'full' ? '999px' : `${value}px` }} />;
    case 'scale': {
      const size = 32 * ((value as number) / 100);
      return <span class="ladder-swatch" style={{ width: size, height: size }} />;
    }
    case 'lineWidth':
      return <span class="ladder-line" style={{ borderTopWidth: `${value}px` }} />;
    case 'speed':
      return (
        <span class="ladder-speed-track">
          <span class="ladder-speed-dot" style={{ animationDuration: `${value}s` }} />
        </span>
      );
    case 'intensity': {
      const idx = LADDER_TABLE.intensity.steps.indexOf(value);
      return (
        <span class="ladder-meter">
          {LADDER_TABLE.intensity.steps.map((_, i) => (
            <span key={i} class={`ladder-meter-bar${i <= idx ? ' is-filled' : ''}`} />
          ))}
        </span>
      );
    }
  }
}

export function Ladder({ attr, value, onChange, hideRelative, hideNow, autoNow }: Props) {
  const def = LADDER_TABLE[attr];
  const targetStep = 'step' in value.target ? value.target.step : undefined;

  return (
    <div class="ladder">
      {!hideRelative && (
        <div class="chip-row">
          {RELATIVE_CHIPS.map((c) => (
            <button
              key={c.delta}
              class={`chip${'delta' in value.target && value.target.delta === c.delta ? ' is-active' : ''}`}
              onClick={() => onChange({ current: value.current, target: { delta: c.delta } })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      <div class="ladder-steps">
        {def.steps.map((s, i) => (
          <div class="ladder-step" key={i}>
            <button
              class={`ladder-thumb${targetStep === i ? ' is-target' : ''}${autoNow === i ? ' is-auto-now' : ''}`}
              title={autoNow === i ? `${s}${def.unit ?? ''}(実測値から今はここ)` : `${s}${def.unit ?? ''}`}
              onClick={() => onChange({ current: value.current, target: { step: i } })}
            >
              <StepPreview attr={attr} value={s} />
            </button>
            {!hideNow && autoNow === undefined && (
              <button
                class={`ladder-now${value.current === i ? ' is-now' : ''}`}
                title="今はこのくらい"
                onClick={() => onChange({ ...value, current: i })}
              >
                今
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
