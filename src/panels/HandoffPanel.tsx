import { useEffect, useState } from 'preact/hooks';
import { copyText } from '../lib/clipboard';
import type { PreparedHandoff } from '../lib/handoff';
import { fileToImage } from '../lib/image';
import { createRoundBoard } from '../lib/round';
import { askBack, TONE_TO_CONCRETE, type AskItem } from '../lib/askBack';
import { toggleIntent } from '../lib/intents';
import * as notes from '../lib/notes';
import { activePageId, addAndOpenBoard, handoffOpen, selectedSpotId, updateBoard } from '../state';
import type { Board } from '../schema';

type Dest = 'chatgpt' | 'claude' | 'copy';

const DEST_LABEL: Record<Dest, string> = { chatgpt: 'ChatGPT', claude: 'Claude', copy: 'コピーだけ' };
const CHAT: Record<'chatgpt' | 'claude', { prompt: string; top: string; max: number }> = {
  chatgpt: { prompt: 'https://chatgpt.com/?prompt=', top: 'https://chatgpt.com/', max: 7000 },
  claude: { prompt: 'https://claude.ai/new?q=', top: 'https://claude.ai/new', max: 7000 },
};
const DEST_STORAGE_KEY = 'ui-collabo/handoff-dest';

function readStoredDest(): Dest {
  try {
    const v = localStorage.getItem(DEST_STORAGE_KEY);
    return v === 'chatgpt' || v === 'claude' || v === 'copy' ? v : 'chatgpt';
  } catch {
    return 'chatgpt';
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 04: 送り状。宛先・届けるもの・文面を1画面にまとめ、1回の押下でAIへ届ける(4.7・4.10)。 */
export function HandoffPanel({
  board,
  prepared,
  delivered,
  onDelivered,
  resetDelivered,
}: {
  board: Board;
  prepared: PreparedHandoff | null;
  delivered: boolean;
  onDelivered: () => void;
  resetDelivered: () => void;
}) {
  const [dest, setDest] = useState<Dest>(readStoredDest);
  const [includeHtml, setIncludeHtml] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const [showText, setShowText] = useState(false);
  // 4.8: 「このままでいい」で消した項目は、送り状を閉じるまで(=このコンポーネントが生きている間)だけ覚える
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const asks = askBack(board).filter((a) => !dismissed.has(a.key));

  useEffect(() => {
    try {
      localStorage.setItem(DEST_STORAGE_KEY, dest);
    } catch {
      /* 保存できなくても致命的ではない */
    }
    setMessages([]);
    resetDelivered();
    // 既定はチャットの宛先でオン、コピーだけでオフ(4.7)
    setIncludeHtml(dest !== 'copy');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dest, board.id]);

  const proof = prepared?.assets.find((a) => a.kind === 'proof-packet');
  const htmlBundle = prepared?.assets.find((a) => a.kind === 'html-bundle');
  const hasHtmlPages = (prepared?.htmlPageCount ?? 0) > 0;
  const lineCount = prepared ? prepared.prompt.split('\n').length : 0;
  // 05: 画像ページの再校・照合の入口(既存機能。届けた後に出す)
  const roundable = board.imageRole === 'draft' && board.pages.length > 0 && board.pages.every((p) => !!p.image);

  async function handleRoundFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;
    if (files.length !== board.pages.length) {
      alert(`再校画像は p.1〜p.${board.pages.length} の順に${board.pages.length}枚選んでください(選択: ${files.length}枚)`);
      return;
    }
    try {
      const pages = [];
      for (let i = 0; i < files.length; i++) {
        pages.push({ id: crypto.randomUUID(), label: board.pages[i]?.label, image: await fileToImage(files[i]) });
      }
      addAndOpenBoard(createRoundBoard(board, pages));
    } catch (err) {
      alert(err instanceof Error ? err.message : '再校画像の読み込みに失敗しました');
    }
  }

  async function copyProofImage(): Promise<boolean> {
    if (!proof) return false;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('非対応');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': proof.blob })]);
      return true;
    } catch {
      return false;
    }
  }

  async function handleCopyOnly() {
    const copied = await copyText(prepared?.prompt ?? '');
    setMessages([copied ? '文面をコピーしました' : 'コピーできませんでした。「渡す文面を見る」から手動でコピーしてください']);
    onDelivered();
  }

  async function handleCopyProof() {
    const copied = await copyProofImage();
    setMessages((m) => [...m, copied ? '校正紙をコピーしました' : '校正紙のコピーに失敗しました。保存しました']);
    if (!copied && proof) downloadBlob(proof.blob, proof.filename);
    onDelivered();
  }

  async function handleDeliver() {
    if (!prepared || dest === 'copy') return;
    const cfg = CHAT[dest];
    const out: string[] = [];

    if (proof) {
      const copied = await copyProofImage();
      out.push(copied ? '校正紙をクリップボードへコピーしました(開いたらCtrl+V)' : '校正紙をコピーできなかったため保存しました。手動で添付してください');
      if (!copied) downloadBlob(proof.blob, proof.filename);
    }
    if (includeHtml && htmlBundle) {
      downloadBlob(htmlBundle.blob, htmlBundle.filename);
      out.push('HTMLソースを保存しました。手動で添付してください');
    }

    const promptUrl = `${cfg.prompt}${encodeURIComponent(prepared.prompt)}`;
    if (promptUrl.length <= cfg.max) {
      out.push('指示文を入力欄に入れて開きます');
      const opened = window.open(promptUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        setMessages(['開けませんでした。ポップアップを許可してください']);
        return;
      }
    } else {
      try {
        if (proof) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': proof.blob, 'text/plain': new Blob([prepared.prompt], { type: 'text/plain' }) }),
          ]);
        }
      } catch {
        /* 貼り付け用のクリップボードは best effort */
      }
      window.open(cfg.top, '_blank', 'noopener,noreferrer');
      out.push('文面が長いため、貼り付けで入らなければ「文面をコピー」でもう一度');
    }
    setMessages(out);
    onDelivered();
  }

  function goWrite(spotId: string) {
    const spot = board.spots.find((s) => s.id === spotId);
    if (!spot) return;
    activePageId.value = spot.pageId;
    selectedSpotId.value = spotId;
    handoffOpen.value = false;
  }

  function applyCommand(spotId: string, commandId: string) {
    updateBoard((b) => {
      const spot = b.spots.find((s) => s.id === spotId);
      return spot ? toggleIntent(b, spot, commandId) : b;
    });
  }

  return (
    <div class="handoff-panel">
      <div class="handoff-panel-scroll">
        <div class="handoff-panel-head">
          <div>
            <span class="micro">HANDOFF</span>
            <strong>送り状</strong>
          </div>
          <button class="btn-sm" onClick={() => (handoffOpen.value = false)}>
            ← 戻って直す
          </button>
        </div>

        {!delivered && prepared && prepared.warnings.length > 0 && (
          <p class="muted handoff-warnings">{prepared.warnings.join('。')}</p>
        )}

        {delivered && (
          <div class="handoff-after">
            <strong>届けました。</strong>
            <ul>
              {messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            {roundable && (
              <label class="btn-sm handoff-round-entry">
                {board.pages.length > 1 ? `AIが直した画像をp.1〜p.${board.pages.length}の順に選んで照合` : 'AIが直したら、直った画像を貼って照合'}
                <input type="file" accept="image/*" multiple={board.pages.length > 1} hidden onChange={handleRoundFiles} />
              </label>
            )}
          </div>
        )}

        <div class="field-label">宛先</div>
        <div class="handoff-dest">
          {(['chatgpt', 'claude', 'copy'] as Dest[]).map((d) => (
            <button key={d} class={`btn-sm${dest === d ? ' is-active' : ''}`} aria-pressed={dest === d} onClick={() => setDest(d)}>
              {DEST_LABEL[d]}
            </button>
          ))}
        </div>

        <div class="field-label handoff-field-label-row">
          <span>AIが聞き返しそうなこと({asks.length})</span>
          <span class="muted">答えなくても渡せます</span>
        </div>
        {asks.map((item) => (
          <AskCard
            key={item.key}
            item={item}
            onGoWrite={() => goWrite(item.spotId)}
            onKeep={() => updateBoard(notes.setKeep(item.spotId, true))}
            onRemove={() => updateBoard(notes.toggleRemoveNote(item.spotId))}
            onApplyCommand={(commandId) => applyCommand(item.spotId, commandId)}
            onDismiss={() => setDismissed((prev) => new Set(prev).add(item.key))}
            onSetLabel={(noteId, label) => updateBoard(notes.patchAddNote(item.spotId, noteId, { label }))}
            onSetColorRole={(noteId, role) => updateBoard(notes.patchColorNote(item.spotId, noteId, { role }))}
            onSetSpotLabel={(label) => updateBoard(notes.setLabel(item.spotId, label))}
          />
        ))}

        <div class="field-label">届けるもの</div>
        <ul class="handoff-pack">
          <li>
            <span class="handoff-pack-ok">{proof ? '✓' : '—'}</span>
            校正紙{proof ? ' 1枚' : ''}
            <span class="handoff-pack-how">{dest === 'copy' ? '「校正紙をコピー」で' : 'クリップボードへ → 開いたらCtrl+V'}</span>
          </li>
          <li>
            <span class="handoff-pack-ok">✓</span>
            指示文 {lineCount}行
            <span class="handoff-pack-how">{dest === 'copy' ? '「文面をコピー」で' : '入力欄に入れて開く'}</span>
          </li>
          {hasHtmlPages && (
            <li>
              <span class="handoff-pack-ok">{includeHtml ? '✓' : '—'}</span>
              <label class="handoff-pack-checkbox">
                <input type="checkbox" checked={includeHtml} onChange={(e) => setIncludeHtml((e.target as HTMLInputElement).checked)} />
                HTMLソース
              </label>
              <span class="handoff-pack-how">保存して添付</span>
            </li>
          )}
        </ul>

        <details class="handoff-text-details" open={showText} onToggle={(e) => setShowText((e.currentTarget as HTMLDetailsElement).open)}>
          <summary class="muted">文面を見る</summary>
          <pre class="export-pre">{prepared?.prompt ?? ''}</pre>
        </details>
      </div>

      <div class="handoff-panel-foot">
        {dest === 'copy' ? (
          <>
            <button class="btn" onClick={handleCopyOnly}>
              文面をコピー
            </button>
            {proof && (
              <button class="btn-sm handoff-copy-proof" onClick={handleCopyProof}>
                校正紙をコピー
              </button>
            )}
          </>
        ) : (
          <button class="btn" disabled={!prepared} onClick={handleDeliver}>
            {DEST_LABEL[dest]}で開く
          </button>
        )}
      </div>
    </div>
  );
}

const COLOR_ROLE_CHOICES: { role: 'text' | 'bg' | 'line'; label: string }[] = [
  { role: 'text', label: '文字' },
  { role: 'bg', label: '背景' },
  { role: 'line', label: '線' },
];

/** 4.8: 聞き返し1件の質問カード。答えるとaskBackの次の計算結果からその項目が消える。 */
function AskCard({
  item,
  onGoWrite,
  onKeep,
  onRemove,
  onApplyCommand,
  onDismiss,
  onSetLabel,
  onSetColorRole,
  onSetSpotLabel,
}: {
  item: AskItem;
  onGoWrite: () => void;
  onKeep: () => void;
  onRemove: () => void;
  onApplyCommand: (commandId: string) => void;
  onDismiss: () => void;
  onSetLabel: (noteId: string, label: string) => void;
  onSetColorRole: (noteId: string, role: 'text' | 'bg' | 'line') => void;
  onSetSpotLabel: (label: string) => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <div class="handoff-ask">
      <p class="handoff-ask-q">
        <span class="spot-badge">{item.spotLabel}</span>
        {item.question}
      </p>
      <div class="chip-row">
        {item.type === 'empty' && (
          <>
            <button class="chip" onClick={onKeep}>変えない</button>
            <button class="chip" onClick={onRemove}>消す</button>
            <button class="chip" onClick={onGoWrite}>書き込む →</button>
          </>
        )}
        {item.type === 'tone-only' && (
          <>
            {(TONE_TO_CONCRETE[item.chip] ?? []).map((c) => (
              <button key={c.commandId} class="chip" onClick={() => onApplyCommand(c.commandId)}>
                {c.label}
              </button>
            ))}
            <button class="chip" onClick={onDismiss}>このままでいい</button>
          </>
        )}
        {item.type === 'label' && (
          <>
            <input class="text-input" placeholder="例: 詳しく見る" value={draft} onInput={(e) => setDraft((e.target as HTMLInputElement).value)} />
            <button class="chip" onClick={() => onSetLabel(item.noteId, draft.trim())}>決める</button>
            <button class="chip" onClick={() => onSetLabel(item.noteId, '')}>おまかせ</button>
          </>
        )}
        {item.type === 'color-role' && COLOR_ROLE_CHOICES.map((c) => (
          <button key={c.role} class="chip" onClick={() => onSetColorRole(item.noteId, c.role)}>
            {c.label}
          </button>
        ))}
        {item.type === 'selector' && (
          <>
            <input class="text-input" placeholder="例: 申し込みボタン" value={draft} onInput={(e) => setDraft((e.target as HTMLInputElement).value)} />
            <button class="chip" onClick={() => onSetSpotLabel(draft.trim())}>決める</button>
          </>
        )}
      </div>
    </div>
  );
}
