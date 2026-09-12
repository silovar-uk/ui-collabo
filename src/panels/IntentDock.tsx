import { useMemo, useState } from 'preact/hooks';
import { selectedSpotId, updateBoard } from '../state';
import { intentSuggestions } from '../lib/intents';
import type { Board } from '../schema';

export function IntentDock({ board }: { board: Board }) {
  const [query, setQuery] = useState('');
  const spot = board.spots.find((candidate) => candidate.id === selectedSpotId.value) ?? null;
  const suggestions = useMemo(() => intentSuggestions(query), [query]);

  if (!spot) return null;
  const spotId = spot.id;

  function apply(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    updateBoard((current) => {
      const currentSpot = current.spots.find((candidate) => candidate.id === spotId);
      return currentSpot ? suggestion.command.apply(current, currentSpot) : current;
    });
    setQuery('');
  }

  return (
    <section class="intent-dock" aria-label="こうしたい">
      <div class="intent-dock-head">
        <div>
          <span class="lab-micro-label">INTENT</span>
          <strong>こうしたい</strong>
        </div>
        <span class="intent-target">#{spot.n} {spot.label || `箇所${spot.n}`}</span>
      </div>
      <input
        class="text-input intent-input"
        value={query}
        placeholder="例: 大きく、右へ、静かに"
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && suggestions.length > 0) {
            e.preventDefault();
            apply(0);
          }
        }}
      />
      <div class="intent-suggestions" aria-label={query ? '検索結果' : 'よく使う意図'}>
        {suggestions.map((suggestion, index) => (
          <button class="intent-chip" key={suggestion.command.id} onClick={() => apply(index)}>
            {suggestion.label}
          </button>
        ))}
        {query && suggestions.length === 0 && <span class="muted intent-empty">候補がありません。対象上のツールから細かく指定できます。</span>}
      </div>
      <p class="intent-foot">細かい色・文字・位置・動きは、対象上のツールから直接指定できます。</p>
    </section>
  );
}
