import { LADDER_TABLE, relativeWordLabel, RELATIVE_CHIPS } from '../vocab';
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

function clampStep(max: number, i: number): number {
  return Math.min(max, Math.max(0, i));
}

/**
 * H2: 全段を実物で横一列に並べるのではなく、1行の目盛りにする。
 * 上に朱の▼(こうしたい)、下に墨の▲(今)を置き、隙間そのものが「ズレ」を表す。
 */
export function Ladder({ attr, value, onChange, hideRelative, hideNow, autoNow }: Props) {
  const def = LADDER_TABLE[attr];
  const lastStep = def.steps.length - 1;
  const targetStep = 'step' in value.target ? value.target.step : undefined;
  const nowStep = autoNow ?? value.current;
  const manualNow = autoNow === undefined;

  function setTarget(step: number) {
    onChange({ current: value.current, target: { step } });
  }

  function onSliderKeyDown(e: KeyboardEvent) {
    if (targetStep === undefined) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setTarget(clampStep(lastStep, targetStep + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setTarget(clampStep(lastStep, targetStep - 1));
    }
  }

  const valueText =
    targetStep !== undefined
      ? `${def.steps[targetStep]}${def.unit ?? ''}${
          'delta' in value.target ? '' : nowStep !== undefined && nowStep !== targetStep ? `、今から${targetStep > nowStep ? '増やす' : '減らす'}` : ''
        }`
      : '';

  return (
    <div class="ladder">
      <div
        class="ladder-gauge"
        role="slider"
        tabIndex={0}
        aria-label={def.label}
        aria-valuemin={0}
        aria-valuemax={lastStep}
        aria-valuenow={targetStep}
        aria-valuetext={valueText}
        onKeyDown={onSliderKeyDown}
      >
        <div class="ladder-gauge-row ladder-gauge-target">
          {def.steps.map((_, i) => (
            <button
              key={i}
              class={`ladder-cell${targetStep === i ? ' is-target' : ''}`}
              title={`${def.steps[i]}${def.unit ?? ''}`}
              onClick={() => setTarget(i)}
            >
              {targetStep === i ? '▼' : ''}
            </button>
          ))}
        </div>
        <div class="ladder-gauge-row ladder-gauge-values">
          {def.steps.map((s, i) => (
            <span key={i} class="ladder-cell ladder-value-label">
              {s}
              {def.unit ?? ''}
            </span>
          ))}
        </div>
        {!hideNow && (
          <div class="ladder-gauge-row ladder-gauge-now">
            {def.steps.map((_, i) => (
              <button
                key={i}
                class={`ladder-cell${nowStep === i ? ' is-now' : ''}`}
                disabled={!manualNow}
                title={manualNow ? `今はこのくらい: ${def.steps[i]}${def.unit ?? ''}` : `実測値から今はここ: ${def.steps[i]}${def.unit ?? ''}`}
                onClick={() => manualNow && onChange({ ...value, current: i })}
              >
                {nowStep === i ? '▲' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <div class="ladder-preview">
        {!hideNow && (
          <div class="ladder-preview-item">
            <span class="ladder-preview-label">今</span>
            {nowStep !== undefined ? <StepPreview attr={attr} value={def.steps[nowStep]} /> : <span class="muted">?</span>}
          </div>
        )}
        {targetStep !== undefined && (
          <div class="ladder-preview-item">
            <span class="ladder-preview-label">こうしたい</span>
            <StepPreview attr={attr} value={def.steps[targetStep]} />
          </div>
        )}
      </div>

      {!hideRelative && (
        <div class="chip-row">
          {RELATIVE_CHIPS.map((c) => {
            const isActive = 'delta' in value.target && value.target.delta === c.delta;
            const label = relativeWordLabel(attr, c.delta);
            const toStep = value.current !== undefined ? clampStep(lastStep, value.current + c.delta) : undefined;
            const withValue = toStep !== undefined ? `${label}(${def.steps[toStep]}${def.unit ?? ''})` : label;
            return (
              <button
                key={c.delta}
                class={`chip${isActive ? ' is-active' : ''}`}
                aria-pressed={isActive}
                onClick={() => onChange({ current: value.current, target: { delta: c.delta } })}
              >
                {withValue}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
