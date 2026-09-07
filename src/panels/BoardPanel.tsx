import { currentBoard, orderMode, updateBoard } from '../state';
import { TONE_CHIPS } from '../vocab';

export function BoardPanel() {
  const board = currentBoard.value;
  if (!board) return null;
  const hasImage = board.pages.some((p) => p.image);

  function toggleChip(chip: string) {
    updateBoard((b) => {
      const has = b.tone.chips.includes(chip);
      return { ...b, tone: { ...b.tone, chips: has ? b.tone.chips.filter((c) => c !== chip) : [...b.tone.chips, chip] } };
    });
  }

  return (
    <div class="panel-content">
      <label class="field">
        <span class="field-label">ボード名</span>
        <input
          class="text-input"
          value={board.title}
          onInput={(e) => updateBoard((b) => ({ ...b, title: (e.target as HTMLInputElement).value }))}
        />
      </label>

      {hasImage && (
        <div class="field">
          <span class="field-label">この画像は?</span>
          <div class="chip-row">
            <button
              class={`chip${board.imageRole === 'draft' ? ' is-active' : ''}`}
              aria-pressed={board.imageRole === 'draft'}
              onClick={() => updateBoard((b) => ({ ...b, imageRole: 'draft' }))}
            >
              直したいもの
            </button>
            <button
              class={`chip${board.imageRole === 'reference' ? ' is-active' : ''}`}
              aria-pressed={board.imageRole === 'reference'}
              onClick={() => updateBoard((b) => ({ ...b, imageRole: 'reference' }))}
            >
              参考にしたいもの
            </button>
          </div>
        </div>
      )}

      <div class="field">
        <span class="field-label">全体のひとこと</span>
        <div class="chip-row">
          {TONE_CHIPS.map((chip) => (
            <button
              key={chip}
              class={`chip${board.tone.chips.includes(chip) ? ' is-active' : ''}`}
              aria-pressed={board.tone.chips.includes(chip)}
              onClick={() => toggleChip(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
        <textarea
          class="text-area"
          rows={2}
          placeholder="自由に書く"
          value={board.tone.text}
          onInput={(e) => updateBoard((b) => ({ ...b, tone: { ...b.tone, text: (e.target as HTMLTextAreaElement).value } }))}
        />
      </div>

      {board.spots.filter((s) => !s.keep).length > 1 && (
        <div class="field">
          <span class="field-label">見る順</span>
          {orderMode.value ? (
            <>
              <p class="muted">ボード上の箇所を、見せたい順にクリックしてください。</p>
              <ol class="order-list">
                {board.order.map((id) => {
                  const s = board.spots.find((sp) => sp.id === id);
                  return s ? <li key={id}>{s.n} {s.label || `箇所${s.n}`}</li> : null;
                })}
              </ol>
              <div class="chip-row">
                <button class="btn-sm" onClick={() => updateBoard((b) => ({ ...b, order: [] }))}>クリア</button>
                <button class="btn" onClick={() => (orderMode.value = false)}>決定</button>
              </div>
            </>
          ) : (
            <button class="btn-sm" onClick={() => (orderMode.value = true)}>見る順を決める</button>
          )}
        </div>
      )}
    </div>
  );
}
