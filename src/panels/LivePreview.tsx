import { useEffect, useRef, useState } from 'preact/hooks';
import { boardToMarkdown } from '../export';
import type { Board } from '../schema';

interface Block {
  n: number | null;
  text: string;
}

/** `### {n} ...` 見出し行で区切ってブロック化する。見出しがない出力(白紙ボード)は1ブロックのまま。 */
function splitBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let current: Block = { n: null, text: '' };
  for (const line of markdown.split('\n')) {
    const m = /^### (\d+) /.exec(line);
    if (m) {
      if (current.text) blocks.push(current);
      current = { n: Number(m[1]), text: line };
    } else {
      current.text += current.text ? `\n${line}` : line;
    }
  }
  if (current.text) blocks.push(current);
  return blocks;
}

export function LivePreview({ board, selectedN }: { board: Board; selectedN: number | null }) {
  const currentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const hasSpots = board.spots.length > 0;
  const markdown = hasSpots ? boardToMarkdown(board) : '';
  const blocks = hasSpots ? splitBlocks(markdown) : [];

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedN]);

  return (
    <details class="live-preview" open>
      <summary>いま、こう伝わります</summary>
      <div class="live-preview-body">
        {hasSpots ? (
          <>
            <button
              class="btn-sm copy-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(markdown);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'コピーしました' : 'コピー'}
            </button>
            <pre class="export-pre">
              {blocks.map((b, i) => (
                <div key={i} ref={b.n !== null && b.n === selectedN ? currentRef : undefined} class={b.n !== null && b.n === selectedN ? 'is-current' : undefined}>
                  {b.text}
                </div>
              ))}
            </pre>
          </>
        ) : (
          <p class="muted">
            {board.pages.some((p) => p.source)
              ? '要素をクリックして、気になる箇所を選んでください。'
              : '画像の上をドラッグして、気になる箇所を囲んでください。'}
          </p>
        )}
      </div>
    </details>
  );
}
