import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { boardToLines } from '../export';
import { intentSuggestions, isIntentApplied, toggleIntent } from '../lib/intents';
import { describeComputed } from '../lib/describeElement';
import * as notes from '../lib/notes';
import { deleteSpot, editingWishId, paletteHint, selectedSpotId, showToast, undo, updateBoard } from '../state';
import { CommandPreviewView } from '../board/Palette';
import { SpotLines } from './Sheet';
import type { Board, Spot } from '../schema';

const NO_FLASH = new Set<string>();
// H1: 8文字以下のときだけ既存コマンド検索を「候補」として出す(4.4)
const CANDIDATE_MAX_CHARS = 8;

function isTypingTarget(el: EventTarget | null): boolean {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

type WriteRow = { type: 'candidate'; label: string; commandId: string } | { type: 'raw'; label: string };

function buildRows(text: string, spot: Spot, editing: boolean): WriteRow[] {
  if (!text) return [];
  const rows: WriteRow[] = [];
  if (text.length <= CANDIDATE_MAX_CHARS) {
    for (const s of intentSuggestions(text, spot, 3)) rows.push({ type: 'candidate', label: s.label, commandId: s.command.id });
  }
  rows.push({ type: 'raw', label: editing ? `「${text}」に書き直す` : `「${text}」を書き込む` });
  return rows.slice(-6);
}

/** 強調の初期位置: 入力が既存候補と完全一致すればその候補、それ以外は「そのまま」(常に最後の行)。 */
function defaultHi(rows: WriteRow[], text: string): number {
  const exact = rows.findIndex((r) => r.type === 'candidate' && r.label === text);
  return exact >= 0 ? exact : rows.length - 1;
}

/** H3改: 右パネル上部の「選択中」。書き込む・入った指示を確かめる・箇所を管理する場所(4.1)。 */
export function SelectedSpot({ board }: { board: Board }) {
  const spot = board.spots.find((s) => s.id === selectedSpotId.value && board.pages.some((p) => p.id === s.pageId)) ?? null;
  if (!spot) return null;
  // key={spot.id}: 箇所ごとに書き込む欄を初期化する
  return <SelectedSpotBody key={spot.id} board={board} spot={spot} />;
}

function SelectedSpotBody({ board, spot }: { board: Board; spot: Spot }) {
  const [query, setQuery] = useState('');
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingId = editingWishId.value;
  const text = query.trim();
  const rows = useMemo(() => buildRows(text, spot, !!editingId), [text, spot, editingId]);
  const defaultChips = useMemo(() => intentSuggestions('', spot), [spot]);
  const lines = useMemo(() => boardToLines(board).filter((l) => l.spotId === spot.id && (l.part === 'note' || l.part === 'position')), [board, spot.id]);
  const elementInfo = spot.element ? describeComputed(spot.element.computed).join('・') : null;

  useEffect(() => setHi(defaultHi(rows, text)), [rows, text]);

  // 書き込む欄の行(要望)を押すと、その文が欄に戻り「書き直し中」になる
  useEffect(() => {
    if (!editingId) return;
    const note = spot.notes.find((n) => n.id === editingId);
    if (note?.kind !== 'wish') {
      editingWishId.value = null;
      return;
    }
    setQuery(note.text);
    requestAnimationFrame(() => inputRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

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
    showToast(wasApplied ? `「${label}」を外しました` : `「${label}」を追加しました`, () => undo());
  }

  function stopEditing() {
    editingWishId.value = null;
    setQuery('');
  }

  function commit(row: WriteRow | undefined) {
    if (!row) return;
    if (row.type === 'candidate') {
      apply(row.commandId, row.label);
      stopEditing();
      return;
    }
    // そのまま: wishノートを作る・書き直し中なら更新する(空ならその要望を削除する)
    if (editingId) updateBoard(notes.updateWishNote(spot.id, editingId, text));
    else if (text) updateBoard(notes.addWishNote(spot.id, text));
    stopEditing();
  }

  return (
    <section class="selected-spot" aria-label="選択中の箇所">
      <div class="selected-spot-head">
        <span class="spot-badge">{spot.n}</span>
        <input
          class="selected-spot-name"
          placeholder={`箇所${spot.n}`}
          aria-label="箇所の名前"
          value={spot.label}
          onInput={(e) => updateBoard(notes.setLabel(spot.id, (e.target as HTMLInputElement).value))}
        />
        <button class="btn-sm" onClick={() => (selectedSpotId.value = null)}>選択を解除</button>
      </div>
      {elementInfo && (
        <p class="muted selected-spot-computed" title={elementInfo}>
          {elementInfo}
        </p>
      )}

      <label class="field write-field">
        <span class="field-label">書き込む{editingId ? '(書き直し中)' : ''}</span>
        <input
          ref={inputRef}
          class="text-input intent-input"
          placeholder="書き込む 例: 下にボタン「詳しく見る」を足す"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.isComposing || e.keyCode === 229) return; // IME変換確定中のEnterでは書き込まない
            if (e.key === 'ArrowDown' && rows.length) {
              e.preventDefault();
              setHi((h) => (h + 1) % rows.length);
            } else if (e.key === 'ArrowUp' && rows.length) {
              e.preventDefault();
              setHi((h) => (h - 1 + rows.length) % rows.length);
            } else if (e.key === 'Enter' && rows.length) {
              e.preventDefault();
              commit(rows[hi]);
            } else if (e.key === 'Escape') {
              stopEditing();
            }
          }}
        />
        {rows.length > 0 && (
          <div class="write-rows" role="listbox">
            {rows.map((row, i) => (
              <button
                key={row.type === 'candidate' ? row.commandId : 'raw'}
                type="button"
                role="option"
                aria-selected={i === hi}
                class={`write-row${i === hi ? ' is-hi' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(row);
                }}
              >
                <span class="write-row-kind">{row.type === 'candidate' ? '候補' : editingId ? '書き直す' : 'そのまま'}</span>
                <span class="write-row-text">{row.label}</span>
                {i === hi && <span class="write-row-enter">Enter ↵</span>}
              </button>
            ))}
          </div>
        )}
        <div class="intent-suggestions" aria-label="よく使う意図">
          {defaultChips.map((s) => {
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
          <p class="muted">まだありません。上の「書き込む」か、ボード上の朱のバーから追加します</p>
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
