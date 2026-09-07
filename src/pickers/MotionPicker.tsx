import { useState } from 'preact/hooks';
import { Ladder } from './Ladder';
import { LADDER_TABLE, MOTIONS, MOTION_TRIGGERS } from '../vocab';

interface Value {
  motion?: string;
  trigger: 'enter' | 'hover' | 'transition';
  speed?: number;
  intensity?: number;
}

interface Props {
  value: Value;
  onChange: (next: Value) => void;
}

function MotionBox({ id, label, active, duration, onPick }: { id: string; label: string; active: boolean; duration: number; onPick: () => void }) {
  const [tick, setTick] = useState(0);
  return (
    <button
      class={`motion-box${active ? ' is-active' : ''}`}
      onClick={() => {
        onPick();
        setTick((t) => t + 1);
      }}
      onMouseEnter={() => setTick((t) => t + 1)}
    >
      <span key={tick} class={`motion-target motion-${id}`} style={{ animationDuration: `${duration}s` }}>
        あ
      </span>
      <span class="motion-label">{label}</span>
    </button>
  );
}

export function MotionPicker({ value, onChange }: Props) {
  const speedIdx = value.speed !== undefined ? indexOfSpeed(value.speed) : 2;
  const duration = LADDER_TABLE.speed.steps[speedIdx] as number;
  const intensityIdx = value.intensity ?? 2;

  return (
    <div class="motion-picker">
      <div class="motion-grid">
        {MOTIONS.map((m) => (
          <MotionBox
            key={m.id}
            id={m.id}
            label={m.label}
            active={value.motion === m.id}
            duration={duration}
            onPick={() => onChange({ ...value, motion: m.id })}
          />
        ))}
      </div>

      <div class="field">
        <span class="field-label">きっかけ</span>
        <div class="chip-row">
          {MOTION_TRIGGERS.map((t) => (
            <button key={t.id} class={`chip${value.trigger === t.id ? ' is-active' : ''}`} onClick={() => onChange({ ...value, trigger: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div class="field">
        <span class="field-label">速さ</span>
        <Ladder
          attr="speed"
          value={{ target: { step: speedIdx } }}
          hideRelative
          hideNow
          onChange={(v) => onChange({ ...value, speed: 'step' in v.target ? (LADDER_TABLE.speed.steps[v.target.step] as number) : value.speed })}
        />
      </div>

      <div class="field">
        <span class="field-label">強さ</span>
        <Ladder
          attr="intensity"
          value={{ target: { step: intensityIdx } }}
          hideRelative
          hideNow
          onChange={(v) => onChange({ ...value, intensity: 'step' in v.target ? v.target.step : value.intensity })}
        />
      </div>
    </div>
  );
}

function indexOfSpeed(v: number): number {
  const idx = (LADDER_TABLE.speed.steps as number[]).indexOf(v);
  return idx === -1 ? 2 : idx;
}
