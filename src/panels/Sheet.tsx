import { useEffect, useRef, useState } from 'preact/hooks';
import { boardToLines, hasSpecifiedContent, type Line } from '../export';
import * as notes from '../lib/notes';
import { hoverLine, hoverSpotId, orderMode, requestOpenCategory, selectedSpotId, updateBoard, type PaletteCategory } from '../state';
import { TONE_CHIPS } from '../vocab';
import type { Board, Note, Spot } from '../schema';

function categoryForNote(note: Note): PaletteCategory {
  return note.kind === 'ladder' ? 'ladder' : note.kind;
}

function lineKey(spotId: string, index: number): string {
  return `${spotId}:${index}`;
}

function BoardCard({ board }: { board: Board }) {
  const hasImage = board.pages.some((p) => p.image);

  function toggleChip(chip: string) {
    updateBoard((b) => {
      const has = b.tone.chips.includes(chip);
      return { ...b, tone: { ...b.tone, chips: has ? b.tone.chips.filter((c) => c !== chip) : [...b.tone.chips, chip] } };
    });
  }

  return (
    <div class="sheet-card sheet-card-board">
      <label class="field">
        <span class="field-label"># デザイン指示</span>
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
            <button class={`chip${board.imageRole === 'draft' ? ' is-active' : ''}`} aria-pressed={board.imageRole === 'draft'} onClick={() => updateBoard((b) => ({ ...b, imageRole: 'draft' }))}>
              直したいもの
            </button>
            <button class={`chip${board.imageRole === 'reference' ? ' is-active' : ''}`} aria-pressed={board.imageRole === 'reference'} onClick={() => updateBoard((b) => ({ ...b, imageRole: 'reference' }))}>
              参考にしたいもの
            </button>
          </div>
        </div>
      )}

      <div class="field">
        <span class="field-label">全体のひとこと</span>
        <div class="chip-row">
          {TONE_CHIPS.map((chip) => (
            <button key={chip} class={`chip${board.tone.chips.includes(chip) ? ' is-active' : ''}`} aria-pressed={board.tone.chips.includes(chip)} onClick={() => toggleChip(chip)}>
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

interface SpotCardProps {
  spot: Spot;
  lines: Line[];
  selected: boolean;
  flashKeys: Set<string>;
}

function SpotCard({ spot, lines, selected, flashKeys }: SpotCardProps) {
  function open(category: PaletteCategory) {
    selectedSpotId.value = spot.id;
    requestOpenCategory.value = { spotId: spot.id, category };
  }

  return (
    <div class={`sheet-card${selected ? ' is-selected' : ''}`}>
      {selected && (
        <div class="sheet-card-head">
          <input
            class="text-input"
            placeholder={`箇所${spot.n}`}
            value={spot.label}
            onInput={(e) => updateBoard(notes.setLabel(spot.id, (e.target as HTMLInputElement).value))}
          />
          <label class="field-inline">
            <input type="checkbox" checked={spot.keep} onChange={(e) => updateBoard(notes.setKeep(spot.id, (e.target as HTMLInputElement).checked))} />
            <span>残す(変えない)</span>
          </label>
        </div>
      )}
      {lines.map((line, i) => {
        const key = lineKey(spot.id, i);
        const clickCategory: PaletteCategory | null = line.noteId
          ? categoryForNote(spot.notes.find((n) => n.id === line.noteId)!)
          : /^- (位置|大きさ)/.test(line.text.trim())
            ? 'position'
            : null;
        return (
          <button
            key={key}
            data-line-key={key}
            class={`sheet-line${flashKeys.has(key) ? ' is-flash' : ''}`}
            onMouseEnter={() => {
              hoverSpotId.value = spot.id;
              hoverLine.value = { spotId: spot.id, lineKey: key };
            }}
            onMouseLeave={() => {
              if (hoverSpotId.value === spot.id) hoverSpotId.value = null;
              if (hoverLine.value?.lineKey === key) hoverLine.value = null;
            }}
            onClick={() => {
              selectedSpotId.value = spot.id;
              if (clickCategory) open(clickCategory);
            }}
          >
            <span class="sheet-line-text">{line.text}</span>
            {line.noteId && (
              <span
                class="sheet-line-remove"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  updateBoard(notes.removeNote(spot.id, line.noteId!));
                }}
              >
                ×
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function EmptySpotCard({ spot, selected }: { spot: Spot; selected: boolean }) {
  return (
    <div
      class={`sheet-card sheet-card-empty${selected ? ' is-selected' : ''}`}
      onMouseEnter={() => (hoverSpotId.value = spot.id)}
      onMouseLeave={() => { if (hoverSpotId.value === spot.id) hoverSpotId.value = null; }}
      onClick={() => (selectedSpotId.value = spot.id)}
    >
      <div class="sheet-line">{spot.n} {spot.label || `箇所${spot.n}`}</div>
      <p class="muted">まだ「こうしたい」がありません(このままでは渡されません)</p>
    </div>
  );
}

/** H3: 指示書。右パネル全体を使い、行はボタン(クリックでピッカーを開く)。 */
export function Sheet({ board }: { board: Board }) {
  const lines = boardToLines(board);
  const prevRef = useRef<Map<string, string>>(new Map());
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prevMap = prevRef.current;
    const nextMap = new Map<string, string>();
    const changed = new Set<string>();
    let spotId: string | undefined;
    let idx = 0;
    for (const line of lines) {
      if (line.spotId !== spotId) {
        spotId = line.spotId;
        idx = 0;
      }
      if (line.spotId && line.noteId) {
        const key = lineKey(line.spotId, idx);
        nextMap.set(key, line.text);
        if (prevMap.has(key) && prevMap.get(key) !== line.text) changed.add(key);
      }
      idx++;
    }
    prevRef.current = nextMap;
    if (changed.size === 0) return;
    setFlashKeys(changed);
    const t = setTimeout(() => setFlashKeys(new Set()), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  const bySpot = new Map<string, Line[]>();
  const order: string[] = [];
  for (const line of lines) {
    if (!line.spotId) continue;
    if (!bySpot.has(line.spotId)) {
      bySpot.set(line.spotId, []);
      order.push(line.spotId);
    }
    bySpot.get(line.spotId)!.push(line);
  }

  const isBrief = board.imageRole === null;
  const emptySpots = isBrief
    ? []
    : board.spots.filter((s) => !s.keep && !hasSpecifiedContent(s, board));

  return (
    <div class="sheet">
      <BoardCard board={board} />
      {order.map((spotId) => {
        const spot = board.spots.find((s) => s.id === spotId);
        if (!spot) return null;
        return <SpotCard key={spotId} spot={spot} lines={bySpot.get(spotId)!} selected={selectedSpotId.value === spotId} flashKeys={flashKeys} />;
      })}
      {emptySpots.map((spot) => (
        <EmptySpotCard key={spot.id} spot={spot} selected={selectedSpotId.value === spot.id} />
      ))}
      {order.length === 0 && emptySpots.length === 0 && <p class="muted sheet-empty">画像の上をドラッグして、気になる箇所を囲んでください。</p>}
    </div>
  );
}
