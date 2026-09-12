import { useEffect, useState } from 'preact/hooks';
import { boardToExportJson, boardToLines, boardToMarkdown, renderNumberedImage, renderProofSheet } from '../export';
import { Drawer } from './Drawer';
import type { Board } from '../schema';

type Tab = 'markdown' | 'json' | 'images';

export function ExportDrawer({ board, onClose }: { board: Board; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('markdown');
  const markdown = boardToMarkdown(board);
  const json = JSON.stringify(boardToExportJson(board), null, 2);
  const hasImages = board.pages.some((p) => p.image);

  return (
    <Drawer
      onClose={onClose}
      ariaLabel="AIに渡す"
      header={
        <>
          <button class={`tab${tab === 'markdown' ? ' is-active' : ''}`} onClick={() => setTab('markdown')}>指示文</button>
          <button class={`tab${tab === 'json' ? ' is-active' : ''}`} onClick={() => setTab('json')}>JSON</button>
          {hasImages && (
            <button class={`tab${tab === 'images' ? ' is-active' : ''}`} onClick={() => setTab('images')}>画像</button>
          )}
        </>
      }
    >
      {tab === 'markdown' && <TextTab content={markdown} />}
      {tab === 'json' && <TextTab content={json} />}
      {tab === 'images' && <ImagesTab board={board} />}
    </Drawer>
  );
}

function TextTab({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div class="drawer-body">
      <button
        class="btn copy-btn"
        onClick={async () => {
          await navigator.clipboard.writeText(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'コピーしました' : 'コピー'}
      </button>
      <pre class="export-pre">{content}</pre>
    </div>
  );
}

/** R3: 校正紙(既定)と、従来の番号付き画像を選べるようにする。 */
function ImagesTab({ board }: { board: Board }) {
  const [kind, setKind] = useState<'proof' | 'numbered'>('proof');
  const [urls, setUrls] = useState<{ pageId: string; url: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: { pageId: string; url: string }[] = [];
      const lines = boardToLines(board);
      for (const page of board.pages) {
        if (!page.image) continue;
        const pageSpots = board.spots.filter((s) => s.pageId === page.id);
        const canvas =
          kind === 'proof' ? await renderProofSheet({ image: page.image }, pageSpots, lines) : await renderNumberedImage({ image: page.image }, pageSpots);
        const url = await new Promise<string>((resolve) => canvas.toBlob((b) => resolve(URL.createObjectURL(b!)), 'image/png'));
        results.push({ pageId: page.id, url });
      }
      if (!cancelled) setUrls(results);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, kind]);

  if (board.pages.every((p) => !p.image)) return <div class="drawer-body muted">白紙のボードには画像がありません</div>;

  return (
    <div class="drawer-body">
      <div class="chip-row">
        <button class={`chip${kind === 'proof' ? ' is-active' : ''}`} onClick={() => setKind('proof')}>校正紙</button>
        <button class={`chip${kind === 'numbered' ? ' is-active' : ''}`} onClick={() => setKind('numbered')}>番号付き画像</button>
      </div>
      {urls.map((u, i) => (
        <div class="export-image-row" key={u.pageId}>
          <img src={u.url} class="export-image-preview" />
          <a class="btn-sm" href={u.url} download={`${board.title || 'board'}-p${i + 1}.png`}>
            保存
          </a>
        </div>
      ))}
    </div>
  );
}
