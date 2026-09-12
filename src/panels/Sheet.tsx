import { useEffect, useRef, useState } from 'preact/hooks';
import { boardToLines, boardToMarkdown, hasSpecifiedContent, renderProofSheet, type Line } from '../export';
import * as notes from '../lib/notes';
import { extractPalette, type PaletteColor } from '../lib/palette';
import { createRoundBoard, isProofed } from '../lib/round';
import { fileToImage } from '../lib/image';
import { tally, type TallyEntry } from '../lib/audit';
import {
  addAndOpenBoard,
  auditHoverSelectors,
  auditRuleCheckRequest,
  hoverLine,
  hoverSpotId,
  htmlAuditRecords,
  orderMode,
  paletteHoverColor,
  requestOpenCategory,
  selectedSpotId,
  updateBoard,
  type PaletteCategory,
} from '../state';
import { TONE_CHIPS } from '../vocab';
import type { Board, Note, Spot } from '../schema';

function categoryForNote(note: Note): PaletteCategory {
  return note.kind === 'ladder' ? 'ladder' : note.kind;
}

const PALETTE_ROLES: { role: 'bg' | 'text' | 'accent' | 'sub'; label: string }[] = [
  { role: 'bg', label: '背景' },
  { role: 'text', label: '文字' },
  { role: 'accent', label: '強調' },
  { role: 'sub', label: '補助' },
];

/** R1-b: この画面の色の棚卸し(画像ページのみ)。 */
function ImagePaletteCard({ board }: { board: Board }) {
  const [colors, setColors] = useState<PaletteColor[] | null>(null);
  const page = board.pages.find((p) => p.image);
  const dataUrl = page?.image?.dataUrl;

  useEffect(() => {
    if (!dataUrl) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const scale = 200 / Math.min(img.naturalWidth, img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      setColors(extractPalette(ctx.getImageData(0, 0, w, h).data));
    };
    img.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  if (!page?.image || !colors || colors.length === 0) return null;

  return (
    <div class="sheet-card">
      <span class="field-label">この画面の色</span>
      <div class="palette-swatch-row">
        {colors.map((c) => (
          <div
            key={c.hex}
            class="palette-swatch-item"
            onMouseEnter={() => (paletteHoverColor.value = c.hex)}
            onMouseLeave={() => {
              if (paletteHoverColor.value === c.hex) paletteHoverColor.value = null;
            }}
          >
            <span class="swatch" style={{ background: c.hex }} />
            <span class="muted">{c.hex}({Math.round(c.share * 100)}%)</span>
            <div class="chip-row">
              {PALETTE_ROLES.map(({ role, label }) => (
                <button
                  key={role}
                  class="btn-sm"
                  onClick={() =>
                    updateBoard((b) => ({
                      ...b,
                      rules: { ...b.rules, palette: [...b.rules.palette.filter((p) => p.role !== role), { role, hex: c.hex }] },
                    }))
                  }
                >
                  {label}に
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TYPE_ROLES: { role: 'heading' | 'body' | 'caption'; label: string }[] = [
  { role: 'heading', label: '見出し' },
  { role: 'body', label: '本文' },
  { role: 'caption', label: '注釈' },
];

const AUDIT_KEYS: { key: 'fontSize' | 'color' | 'background' | 'radius'; label: string }[] = [
  { key: 'fontSize', label: '文字サイズ' },
  { key: 'color', label: '文字色' },
  { key: 'background', label: '背景色' },
  { key: 'radius', label: '角丸' },
];

function AuditRow({ entry, canPromote, onPromote }: { entry: TallyEntry; canPromote: boolean; onPromote?: (role: string) => void }) {
  return (
    <div
      class="audit-row"
      onMouseEnter={() => (auditHoverSelectors.value = entry.selectors)}
      onMouseLeave={() => {
        if (auditHoverSelectors.value === entry.selectors) auditHoverSelectors.value = null;
      }}
    >
      <span class="muted">{entry.value}({entry.count})</span>
      {canPromote && onPromote && (
        <div class="chip-row">
          {(entry.value.startsWith('#') || entry.value.startsWith('rgb')
            ? PALETTE_ROLES.map((r) => ({ role: r.role, label: r.label }))
            : TYPE_ROLES.map((r) => ({ role: r.role, label: r.label }))
          ).map(({ role, label }) => (
            <button key={role} class="btn-sm" onClick={() => onPromote(role)}>
              {label}の基準に
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** R1-c: ばらつき診断(HTMLページのみ)。 */
function HtmlAuditCard({ board }: { board: Board }) {
  const records = htmlAuditRecords.value;
  if (!records || records.length === 0) return null;

  const tallies = AUDIT_KEYS.map(({ key, label }) => ({ key, label, entries: tally(records, key) }));
  if (tallies.every((t) => t.entries.length === 0)) return null;

  function promoteFontSize(px: string, role: 'heading' | 'body' | 'caption') {
    const size = Math.round(parseFloat(px));
    updateBoard((b) => {
      const existing = b.rules.type.find((t) => t.role === role);
      const type = existing ? b.rules.type.map((t) => (t.role === role ? { ...t, size } : t)) : [...b.rules.type, { role, size }];
      return { ...b, rules: { ...b.rules, type } };
    });
  }

  function promoteColor(hex: string, role: 'bg' | 'text' | 'accent' | 'sub') {
    updateBoard((b) => ({ ...b, rules: { ...b.rules, palette: [...b.rules.palette.filter((p) => p.role !== role), { role, hex }] } }));
  }

  return (
    <div class="sheet-card">
      <span class="field-label">
        {tallies.filter((t) => t.entries.length > 0).map((t) => `${t.label} ${t.entries.length}種類`).join(' / ')}
      </span>
      {tallies.map(
        ({ key, label, entries }) =>
          entries.length > 0 && (
            <details key={key}>
              <summary>{label}({entries.length}種類)</summary>
              {entries.map((entry) => (
                <AuditRow
                  key={entry.value}
                  entry={entry}
                  canPromote={key === 'fontSize' || key === 'color' || key === 'background'}
                  onPromote={
                    key === 'fontSize'
                      ? (role) => promoteFontSize(entry.value, role as 'heading' | 'body' | 'caption')
                      : key === 'color' || key === 'background'
                        ? (role) => promoteColor(entry.value, role as 'bg' | 'text' | 'accent' | 'sub')
                        : undefined
                  }
                />
              ))}
            </details>
          ),
      )}
      {(board.rules.type.length > 0 || board.rules.palette.length > 0) && (
        <button class="btn-sm" onClick={() => (auditRuleCheckRequest.value = true)}>
          ルールで校正する
        </button>
      )}
    </div>
  );
}

async function copyMarkdown(board: Board): Promise<void> {
  await navigator.clipboard.writeText(boardToMarkdown(board));
}

function openChatGpt(board: Board): void {
  const url = `https://chatgpt.com/?prompt=${encodeURIComponent(boardToMarkdown(board))}`;
  const opened = window.open(url, '_blank');
  if (opened) {
    try {
      opened.opener = null;
    } catch {
      /* noopenerの設定に失敗しても遷移自体は成立している */
    }
    return;
  }
  window.location.assign(url);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** R3: H5で渡す画像は校正紙(画像1枚で箇所と指示の両方が読める)を既定にする。 */
async function numberedImageBlob(board: Board): Promise<Blob | null> {
  const page = board.pages.find((p) => p.image);
  if (!page?.image) return null;
  const pageSpots = board.spots.filter((s) => s.pageId === page.id);
  const canvas = await renderProofSheet({ image: page.image }, pageSpots, boardToLines(board));
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像の生成に失敗しました'))), 'image/png'));
}

type ImageHandoffStatus = 'copied' | 'downloaded' | 'unavailable' | null;

/** H5: 「AIに渡す」を1つの入口にする。画像を準備したあと、ChatGPTを指示文入りで開く。 */
function ExportButton({ board }: { board: Board }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [exported, setExported] = useState(false);
  const [imageStatus, setImageStatus] = useState<ImageHandoffStatus>(null);
  useEffect(() => {
    setStep(1);
    setExported(false);
    setImageStatus(null);
  }, [board.id]);
  const hasImages = board.pages.some((p) => p.image);

  async function handleClick() {
    if (!hasImages) {
      void copyMarkdown(board).catch(() => {});
      openChatGpt(board);
      setExported(true);
      return;
    }
    if (step === 1) {
      try {
        const blob = await numberedImageBlob(board);
        if (!blob) throw new Error('画像なし');
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('画像コピー非対応');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setImageStatus('copied');
      } catch {
        try {
          const blob = await numberedImageBlob(board);
          if (!blob) throw new Error('画像なし');
          downloadBlob(blob, `${board.title || 'board'}.png`);
          setImageStatus('downloaded');
        } catch {
          setImageStatus('unavailable');
        }
      }
      setStep(2);
      return;
    }
    void copyMarkdown(board).catch(() => {});
    openChatGpt(board);
    setStep(1);
    setImageStatus(null);
    setExported(true);
  }

  async function handleRoundFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!file) return;
    const img = await fileToImage(file);
    const next = createRoundBoard(board, { id: crypto.randomUUID(), image: img });
    addAndOpenBoard(next);
  }

  const handoffMessage =
    imageStatus === 'copied'
      ? '画像をコピーしました。次にChatGPTを開き、入力欄へ貼り付けてください。'
      : imageStatus === 'downloaded'
        ? '画像コピーが使えなかったためPNGを保存しました。ChatGPTでその画像を添付してください。'
        : imageStatus === 'unavailable'
          ? '画像を自動で渡せませんでした。ChatGPTで元画像を添付してください。'
          : null;

  return (
    <div class="sheet-export">
      {hasImages && step === 2 && handoffMessage && <p class="muted">{handoffMessage}</p>}
      <button class="btn sheet-export-btn" onClick={handleClick}>
        {hasImages && step === 2 ? '② ChatGPTで開く' : 'AIに渡す'}
      </button>
      {/* R2: 渡したあとに、直った版を貼って照合する入口 */}
      {exported && hasImages && board.imageRole === 'draft' && (
        <label class="btn-sm sheet-round-entry">
          AIが直したら、直った画像を貼って照合
          <input type="file" accept="image/*" hidden onChange={handleRoundFile} />
        </label>
      )}
    </div>
  );
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
      {spot.carried && (
        <div class="sheet-card-check">
          <button class={`btn-sm${spot.check === 'ok' ? ' is-active' : ''}`} onClick={() => updateBoard(notes.setSpotCheck(spot.id, 'ok'))}>
            ○ 直った
          </button>
          <button class={`btn-sm${spot.check === 'ng' ? ' is-active' : ''}`} onClick={() => updateBoard(notes.setSpotCheck(spot.id, 'ng'))}>
            × まだ
          </button>
        </div>
      )}
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
      {isProofed(board) && <div class="sheet-proofed">校了。直すところはありません</div>}
      <BoardCard board={board} />
      <ImagePaletteCard board={board} />
      <HtmlAuditCard board={board} />
      {order.map((spotId) => {
        const spot = board.spots.find((s) => s.id === spotId);
        if (!spot) return null;
        return <SpotCard key={spotId} spot={spot} lines={bySpot.get(spotId)!} selected={selectedSpotId.value === spotId} flashKeys={flashKeys} />;
      })}
      {emptySpots.map((spot) => (
        <EmptySpotCard key={spot.id} spot={spot} selected={selectedSpotId.value === spot.id} />
      ))}
      {order.length === 0 && emptySpots.length === 0 && <p class="muted sheet-empty">画像の上をドラッグして、気になる箇所を囲んでください。</p>}
      <ExportButton board={board} />
    </div>
  );
}
