import { useEffect, useRef, useState } from 'preact/hooks';
import { boardToMarkdown } from '../export';
import type { PreparedHandoff } from '../lib/handoff';
import type { Board } from '../schema';

/** 04: 「AIに届く校正紙」。校正紙パケット(4.9)があれば画像で、なければ指示文を紙の体裁で見せる。 */
export function HandoffPreview({ board, prepared, delivered }: { board: Board; prepared: PreparedHandoff | null; delivered: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const packet = prepared?.assets.find((a) => a.kind === 'proof-packet');
    const next = packet ? URL.createObjectURL(packet.blob) : null;
    setUrl(next);
    urlRef.current = next;
    return () => {
      if (next) URL.revokeObjectURL(next);
    };
  }, [prepared]);

  return (
    <div class="handoff-preview">
      <div class="handoff-preview-head">
        <span class="micro">HANDOFF / PREVIEW</span>
        <strong>AIに届く校正紙</strong>
      </div>
      <div class="handoff-preview-body">
        {!prepared && <p class="handoff-skeleton muted">校正紙を作っています…</p>}
        {prepared && !url && <pre class="handoff-paper">{boardToMarkdown(board)}</pre>}
        {url && (
          <div class="handoff-proof-wrap">
            <img class="handoff-proof-img" src={url} alt="AIに届く校正紙" />
            {delivered && (
              <div class="proof-stamp handoff-stamp">
                送付
                <small>COPIED</small>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
