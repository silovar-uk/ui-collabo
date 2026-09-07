import { useEffect, useState } from 'preact/hooks';
import { handleHtml } from '../lib/intake';

export function HtmlIntakeDialog({ onClose }: { onClose: () => void }) {
  const [html, setHtml] = useState('');
  const [origin, setOrigin] = useState('');
  const [useBase, setUseBase] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function submit() {
    if (!html.trim()) return;
    void handleHtml(html, { origin: origin.trim() || undefined, useBase });
    onClose();
  }

  return (
    <div class="drawer-backdrop dialog-backdrop" onClick={onClose}>
      <div class="html-dialog" role="dialog" aria-modal="true" aria-label="HTMLを読み込む" onClick={(e) => e.stopPropagation()}>
        <h2 class="dialog-title">HTMLを読み込む</h2>
        <label class="field">
          <span class="field-label">HTMLソース</span>
          <textarea
            class="text-area html-dialog-textarea"
            rows={10}
            placeholder="<html>...</html>"
            value={html}
            onInput={(e) => setHtml((e.target as HTMLTextAreaElement).value)}
          />
        </label>
        <label class="field">
          <span class="field-label">元URL(任意)</span>
          <input
            class="text-input"
            placeholder="https://example.com/"
            value={origin}
            onInput={(e) => setOrigin((e.target as HTMLInputElement).value)}
          />
        </label>
        <label class="field-inline">
          <input type="checkbox" checked={useBase} onChange={(e) => setUseBase((e.target as HTMLInputElement).checked)} />
          <span>元のCSSも読み込む(元サイトへ通信します)</span>
        </label>
        <div class="chip-row">
          <button class="btn-sm" onClick={onClose}>キャンセル</button>
          <button class="btn" onClick={submit} disabled={!html.trim()}>読み込む</button>
        </div>
      </div>
    </div>
  );
}
