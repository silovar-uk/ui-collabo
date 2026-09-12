import { useEffect, useRef, useState } from 'preact/hooks';
import { handleHtml } from '../lib/intake';
import { BOOKMARKLET_URL } from '../bookmarklet';

export function HtmlIntakeDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [origin, setOrigin] = useState('');
  const [allowExternal, setAllowExternal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = modalRef.current;
    root?.querySelector<HTMLElement>('button, [href], textarea, input')?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]), [href], textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitText() {
    if (!text.trim()) return;
    await handleHtml(text, { origin: origin.trim() || undefined, allowExternal });
    onClose();
  }

  async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const raw = await file.text();
    await handleHtml(raw, { origin: origin.trim() || undefined, allowExternal });
    input.value = '';
    onClose();
  }

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div ref={modalRef} class="modal" role="dialog" aria-modal="true" aria-label="HTMLを読み込む" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>HTMLを読み込む</h2>
          <button class="btn-sm" onClick={onClose}>閉じる</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <span class="field-label">ページを取り込む(おすすめ)</span>
            <p class="muted">対象ページを開いてボタンを押すと、見た目そのままの内容がクリップボードに入ります。</p>
            <a class="btn bookmarklet-link" href={BOOKMARKLET_URL}>
              ページを取り込む
            </a>
            <p class="muted">↑ このボタンをブックマークバーにドラッグしてください</p>
            <ol class="bookmarklet-steps">
              <li>対象ページを開く</li>
              <li>ブックマークバーの「ページを取り込む」を押す</li>
              <li>下の欄に貼る(Ctrl+V)</li>
            </ol>
          </div>

          <label class="field">
            <span class="field-label">HTMLを貼る</span>
            <textarea
              class="text-area"
              rows={8}
              placeholder="ここに貼り付け(Ctrl+V)。自分で用意したHTMLソースでも構いません"
              value={text}
              onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
            />
          </label>

          <label class="field">
            <span class="field-label">元URL(任意。ブックマークレット経由なら自動で埋まります)</span>
            <input
              class="text-input"
              placeholder="https://..."
              value={origin}
              onInput={(e) => setOrigin((e.target as HTMLInputElement).value)}
            />
          </label>

          <label class="field-inline">
            <input type="checkbox" checked={allowExternal} onChange={(e) => setAllowExternal((e.target as HTMLInputElement).checked)} />
            <span>外部の画像・フォントを読み込む(元サイトへ通信します)</span>
          </label>

          <div class="chip-row">
            <button class="btn" onClick={submitText} disabled={!text.trim()}>
              取り込む
            </button>
            <button class="btn-sm" onClick={() => fileRef.current?.click()}>
              .html ファイルを選ぶ
            </button>
            <input ref={fileRef} type="file" accept=".html,.htm" hidden onChange={onFileChange} />
          </div>

          <p class="muted">
            クロスオリジンのCSS(Webフォントなど)は読み出せません。canvasの描画内容や擬似要素の背景画像も持ち出せません。
          </p>
        </div>
      </div>
    </div>
  );
}
