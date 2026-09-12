import { lens } from '../state';

/** レンズ切替(H1)。両ページ種別共通の「いま/こうしたい」トグル。 */
export function LensToggle() {
  return (
    <div class="lens-toggle">
      <button class={`btn-sm${lens.value === 'after' ? ' is-active' : ''}`} onClick={() => (lens.value = 'after')}>
        こうしたい
      </button>
      <button class={`btn-sm${lens.value === 'before' ? ' is-active' : ''}`} onClick={() => (lens.value = 'before')}>
        いま
      </button>
    </div>
  );
}
