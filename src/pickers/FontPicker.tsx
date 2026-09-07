import { FONT_MOODS } from '../vocab';

interface Props {
  sample: string;
  value?: string;
  onChange: (moodId: string) => void;
}

export function FontPicker({ sample, value, onChange }: Props) {
  return (
    <div class="font-grid">
      {FONT_MOODS.map((mood) => (
        <button
          key={mood.id}
          class={`font-card${value === mood.id ? ' is-active' : ''}`}
          style={{ fontFamily: `${mood.font}, ${mood.fallback}` }}
          onClick={() => onChange(mood.id)}
        >
          <span class="font-card-sample">{sample}</span>
          <span class="font-card-label">{mood.label}</span>
        </button>
      ))}
    </div>
  );
}
