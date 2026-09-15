import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { boardToLines } from '../export';
import { intentSuggestions, isIntentApplied, toggleIntent } from '../lib/intents';
import { describeComputed, spotDisplayName } from '../lib/describeElement';
import * as notes from '../lib/notes';
import { deleteSpot, paletteHint, selectedSpotId, showToast, undo, updateBoard } from '../state';
import { CommandPreviewView } from '../board/Palette';
import { SpotLines } from './Sheet';
import type { Board, Spot } from '../schema';

const NO_FLASH = new Set<string>();

function isTypingTarget(el: EventTarget | null): boolean {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/** H3改: 右パネル上部の「選択中」。言葉で選ぶ・入った指示を確かめる・箇所を管理する場所(4.1)。 */
export function SelectedSpot({ board }: { board: Board }) {
  const spot = board.spots.find((s) => s.id === selectedSpotId.value && board.pages.some((p) => p.id === s.pageId)) ?? null;
  if (!spot) return null;
  // key={spot.id}: 箇所ごとに入力欄(言葉で選ぶ)を初期化する
  return <SelectedSpotBody key={spot.id} board={board} spot={spot} />;
}

function SelectedSpotBody({ board, spot }: { board: Board; spot: Spot }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => intentSuggestions(query, spot), [query, spot]);
  const lines = useMemo(() => boardToLines(board).filter((l) => l.spotId === spot.id && (l.part === 'note' || l.part === 'position')), [board, spot.id]);
  const elementInfo = spot.element ? describeComputed(spot.element.computed).join('・') : null;

  // 箇所を選んだ状態で、入力中でもピッカーが開いてもいないときに文字キー(または/)を押したら、この入力欄へフォーカスする
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === '/' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && /^[\p{L}\p{N}]$/u.test(e.key))) {
        e.preventDefault();
        setQuery(e.key === '/' ? '' : e.key);
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function apply(commandId: string, label: string) {
    const wasApplied = isIntentApplied(commandId, spot);
    updateBoard((b) => {
      const currentSpot = b.spots.find((s) => s.id === spot.id);
      return currentSpot ? toggleIntent(b, currentSpot, commandId) : b;
    });
    setQuery('');
    showToast(wasApplied ? `「${label}」を外しました` : `「${label}」を追加しました`, () => undo());
  }

  return (
    <section class="selected-spot" aria-label="選択中の箇所">
      <div class="selected-spot-head">
        <span class="spot-badge">{spot.n}</span>
        <span class="selected-spot-name">{spotDisplayName(spot)}</span>
        <button class="btn-sm" onClick={() => (selectedSpotId.value = null)}>選択を解除</button>
      </div>
      {elementInfo && <p class="muted selected-spot-computed">{elementInfo}</p>}

      <label class="field">
        <span class="field-label">名前</span>
        <input
          class="text-input"
          placeholder={`箇所${spot.n}`}
          value={spot.label}
          onInput={(e) => updateBoard(notes.setLabel(spot.id, (e.target as HTMLInputElement).value))}
        />
      </label>

      <label class="field">
        <span class="field-label">言葉で選ぶ</span>
        <input
          ref={inputRef}
          class="text-input intent-input"
          placeholder="例: 大きく、余白、静かに"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <div class="intent-suggestions" aria-label={query ? '検索結果' : 'よく使う意図'}>
          {suggestions.map((s) => {
            const active = isIntentApplied(s.command.id, spot);
            return (
              <button
                key={s.command.id}
                class={`intent-chip${active ? ' is-active' : ''}`}
                aria-pressed={active}
                onClick={() => apply(s.command.id, s.label)}
              >
                {s.command.preview && (
                  <span class="command-preview">
                    <CommandPreviewView command={s.command} />
                  </span>
                )}
                {active ? `✓ ${s.label}` : s.label}
              </button>
            );
          })}
          {query && suggestions.length === 0 && <span class="muted intent-empty">候補がありません</span>}
        </div>
      </label>

      <p
        class="selected-spot-hint"
        tabIndex={0}
        onMouseEnter={() => (paletteHint.value = true)}
        onMouseLeave={() => (paletteHint.value = false)}
        onFocus={() => (paletteHint.value = true)}
        onBlur={() => (paletteHint.value = false)}
      >
        細かく指定する: 色・文字・大きさ・動き・ひとことは、ボード上の朱のバーから
      </p>

      <div class="field">
        <span class="field-label">この箇所の指示{lines.length > 0 ? `(${lines.length})` : ''}</span>
        {lines.length > 0 ? (
          <SpotLines spot={spot} lines={lines} flashKeys={NO_FLASH} />
        ) : (
          <p class="muted">まだありません。「言葉で選ぶ」か、ボード上の朱のバーから追加します</p>
        )}
      </div>

      <div class="chip-row selected-spot-actions">
        <button class={`btn-sm${spot.keep ? ' is-active' : ''}`} aria-pressed={spot.keep} onClick={() => updateBoard(notes.setKeep(spot.id, !spot.keep))}>
          変えない
        </button>
        <button class="btn-sm" onClick={() => deleteSpot(spot.id)}>この箇所を削除</button>
      </div>

      {spot.carried && (
        <div class="chip-row">
          <button class={`btn-sm${spot.check === 'ok' ? ' is-active' : ''}`} onClick={() => updateBoard(notes.setSpotCheck(spot.id, 'ok'))}>
            ○ 直った
          </button>
          <button class={`btn-sm${spot.check === 'ng' ? ' is-active' : ''}`} onClick={() => updateBoard(notes.setSpotCheck(spot.id, 'ng'))}>
            × まだ
          </button>
        </div>
      )}
    </section>
  );
}
