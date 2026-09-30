import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { boardToLines } from '../export';
import { intentSuggestions, isIntentApplied, toggleIntent } from '../lib/intents';
import { describeComputed } from '../lib/describeElement';
import * as notes from '../lib/notes';
import { parseWish, pickVocab, PART_LABEL, PLACE_LABEL, type ParsedWish } from '../lib/wishParse';
import { defaultAddRect } from '../lib/addParts';
import { pageCanvasSize } from '../lib/geometry';
import { deleteSpot, draftWish, editingWishId, paletteHint, selectedSpotId, showToast, undo, updateBoard } from '../state';
import { CommandPreviewView } from '../board/Palette';
import { SpotLines } from './Sheet';
import type { AddPart, AddPlace, Board, Spot } from '../schema';

const NO_FLASH = new Set<string>();
// H1: 8文字以下のときだけ既存コマンド検索を「候補」として出す(4.4)
const CANDIDATE_MAX_CHARS = 8;
// H1: 位置の語だけ打ったとき、続けてよく使う部品を提示する(4.2)
const PLACE_ONLY_RE = /^(上|下|左|右|横|中)(に|へ)?$/;
const PLACE_ONLY_MAP: Record<string, AddPlace> = { 上: 'above', 下: 'below', 左: 'left', 右: 'right', 横: 'right', 中: 'inside' };
const PLACE_ONLY_PARTS: AddPart[] = ['button', 'text', 'heading', 'image'];

function isTypingTarget(el: EventTarget | null): boolean {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

type WriteRow =
  | { type: 'interp'; label: string; interp: ParsedWish }
  | { type: 'pick'; label: string; commandId: string }
  | { type: 'candidate'; label: string; commandId: string }
  | { type: 'raw'; label: string };

function buildRows(text: string, spot: Spot, editing: boolean): WriteRow[] {
  if (!text) return [];
  const rows: WriteRow[] = [];
  const interp = parseWish(text);
  const placeOnly = text.match(PLACE_ONLY_RE);
  if (!interp && placeOnly) {
    const place = PLACE_ONLY_MAP[placeOnly[1]];
    for (const part of PLACE_ONLY_PARTS) {
      rows.push({
        type: 'interp',
        label: `${PLACE_LABEL[place]}に ${PART_LABEL[part]}`,
        interp: { kind: 'add', part, place, said: `${text}${PART_LABEL[part]}` },
      });
    }
  }
  if (interp) {
    rows.push({
      type: 'interp',
      label: interp.kind === 'add' ? `${PLACE_LABEL[interp.place]}に ${PART_LABEL[interp.part]}${interp.label ? `「${interp.label}」` : ''}` : 'この要素を取り除く',
      interp,
    });
  }
  for (const p of pickVocab(text)) rows.push({ type: 'pick', label: p.label, commandId: p.id });
  if (text.length <= CANDIDATE_MAX_CHARS) {
    for (const s of intentSuggestions(text, spot, 3)) rows.push({ type: 'candidate', label: s.label, commandId: s.command.id });
  }
  rows.push({ type: 'raw', label: editing ? `「${text}」に書き直す` : `「${text}」を書き込む` });
  return rows.slice(-6);
}

/** 強調の初期位置: 読み取りがあればそれ、入力が既存候補と完全一致すればその候補、それ以外は「そのまま」。 */
function defaultHi(rows: WriteRow[], text: string): number {
  const interpIdx = rows.findIndex((r) => r.type === 'interp');
  if (interpIdx >= 0) return interpIdx;
  const exact = rows.findIndex((r) => (r.type === 'candidate' || r.type === 'pick') && r.label === text);
  return exact >= 0 ? exact : rows.length - 1;
}

function rowKey(row: WriteRow): string {
  if (row.type === 'interp') return `interp:${row.interp.kind}`;
  if (row.type === 'raw') return 'raw';
  return row.commandId;
}

function rowKind(row: WriteRow, editing: boolean): string {
  if (row.type === 'interp') return row.interp.kind === 'add' ? '足す' : '消す';
  if (row.type === 'pick') return '拾った';
  if (row.type === 'candidate') return '候補';
  return editing ? '書き直す' : 'そのまま';
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

  // H1: 書くと、生える(4.3)。強調中の行が「足す/消す」と読めている間だけ、選択中の箇所に下書きを出す
  useEffect(() => {
    const row = rows[hi];
    draftWish.value = row?.type === 'interp' ? { spotId: spot.id, interp: row.interp } : null;
    return () => {
      if (draftWish.value?.spotId === spot.id) draftWish.value = null;
    };
  }, [rows, hi, spot.id]);

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
    if (row.type === 'interp') {
      if (row.interp.kind === 'add') {
        // H1: 書くと、生える(4.3)。既定位置は今すぐ計算して持たせる(ドラッグするまで待たない)
        const page = board.pages.find((p) => p.id === spot.pageId);
        const rect = page ? defaultAddRect(row.interp.part, row.interp.place, spot.rect, pageCanvasSize(board, page)) : undefined;
        updateBoard(notes.addAddNote(spot.id, row.interp.part, row.interp.place, rect, row.interp.label, row.interp.said));
      } else {
        updateBoard(notes.toggleRemoveNote(spot.id, row.interp.said));
      }
      if (editingId) updateBoard(notes.updateWishNote(spot.id, editingId, ''));
      stopEditing();
      return;
    }
    if (row.type === 'pick') {
      // H1: 拾った語彙を適用しても、続けて書けるよう入力欄の文は残す(4.4)
      apply(row.commandId, row.label);
      return;
    }
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
                key={rowKey(row)}
                type="button"
                role="option"
                aria-selected={i === hi}
                class={`write-row${i === hi ? ' is-hi' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(row);
                }}
              >
                <span class="write-row-kind">{rowKind(row, !!editingId)}</span>
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
