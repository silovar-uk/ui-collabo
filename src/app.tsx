import { useEffect, useState } from 'preact/hooks';
import { activePageId, createBoard, currentBoard, currentBoardId, ready, selectedSpotId, updateBoard } from './state';
import { extractImageFiles, fileToImage } from './lib/image';
import { Board } from './board/Board';
import { Empty } from './panels/Empty';
import { BoardPanel } from './panels/BoardPanel';
import { SpotPanel } from './panels/SpotPanel';
import { ExportDrawer } from './panels/ExportDrawer';
import { RulesDrawer } from './panels/RulesDrawer';
import { LibraryDrawer } from './panels/LibraryDrawer';
import type { Page } from './schema';

type DrawerKind = 'export' | 'rules' | 'library' | null;

async function filesToPages(files: File[]): Promise<Page[]> {
  const pages: Page[] = [];
  for (const file of files) {
    const img = await fileToImage(file);
    pages.push({ id: crypto.randomUUID(), image: img });
  }
  return pages;
}

export function App() {
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    const pages = await filesToPages(files);
    if (!currentBoard.value) createBoard({ kind: 'web' });
    updateBoard((b) => ({ ...b, pages: [...b.pages, ...pages] }));
    activePageId.value = pages[0].id;
  }

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const files = extractImageFiles(e.clipboardData);
      if (files.length > 0) void handleFiles(files);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  if (!ready.value) return <div class="loading">読み込み中…</div>;

  const board = currentBoard.value;
  const spot = board?.spots.find((s) => s.id === selectedSpotId.value) ?? null;

  return (
    <div
      class={`app-shell${dragOver ? ' is-drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(extractImageFiles(e.dataTransfer!));
      }}
    >
      <header class="topbar">
        <button class="wordmark" onClick={() => (currentBoardId.value = null)} title="ボード一覧に戻る">
          UI ColLabo
        </button>
        {board && <span class="topbar-title">{board.title}</span>}
        <div class="topbar-spacer" />
        {board && (
          <>
            <button class="btn-sm" onClick={() => setDrawer('rules')}>ルール</button>
            <button class="btn-sm" onClick={() => setDrawer('library')}>ライブラリ</button>
            <button class="btn" onClick={() => setDrawer('export')}>AIに渡す</button>
          </>
        )}
      </header>

      {!board ? (
        <Empty />
      ) : (
        <main class="main-layout">
          <div class="board-column">
            <Board />
            {board.pages.length > 1 && (
              <div class="page-strip">
                {board.pages.map((p, i) => (
                  <button
                    key={p.id}
                    class={`page-thumb${activePageId.value === p.id ? ' is-active' : ''}`}
                    onClick={() => {
                      activePageId.value = p.id;
                      selectedSpotId.value = null;
                    }}
                  >
                    {p.image ? <img src={p.image.dataUrl} /> : <span>{i + 1}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <aside class="side-panel">
            {board.imageRole === null && board.pages.some((p) => p.image) ? (
              <ImageRolePrompt />
            ) : spot ? (
              <SpotPanel spot={spot} />
            ) : (
              <BoardPanel />
            )}
          </aside>
        </main>
      )}

      {drawer === 'export' && board && <ExportDrawer board={board} onClose={() => setDrawer(null)} />}
      {drawer === 'rules' && board && <RulesDrawer board={board} onClose={() => setDrawer(null)} />}
      {drawer === 'library' && board && <LibraryDrawer board={board} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function ImageRolePrompt() {
  return (
    <div class="panel-content">
      <p class="field-label">この画像は?</p>
      <div class="chip-row">
        <button class="btn" onClick={() => updateBoard((b) => ({ ...b, imageRole: 'draft' }))}>
          直したいもの
        </button>
        <button class="btn" onClick={() => updateBoard((b) => ({ ...b, imageRole: 'reference' }))}>
          参考にしたいもの
        </button>
      </div>
    </div>
  );
}
