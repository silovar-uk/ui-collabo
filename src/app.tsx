import { useEffect, useState } from 'preact/hooks';
import { activePageId, currentBoard, currentBoardId, ready, selectedSpotId, spaceHeld, updateBoard } from './state';
import { extractImageFiles } from './lib/image';
import { handleFiles, handleHtml } from './lib/intake';
import { Board } from './board/Board';
import { HtmlBoard } from './board/HtmlBoard';
import { Empty } from './panels/Empty';
import { BoardPanel } from './panels/BoardPanel';
import { SpotPanel } from './panels/SpotPanel';
import { LivePreview } from './panels/LivePreview';
import { ExportDrawer } from './panels/ExportDrawer';
import { RulesDrawer } from './panels/RulesDrawer';
import { LibraryDrawer } from './panels/LibraryDrawer';
import { HtmlIntakeDialog } from './panels/HtmlIntakeDialog';
import { Toast } from './panels/Toast';
import markSmallUrl from '../brand/mark-small.svg';
import type { Board as BoardData } from './schema';

type DrawerKind = 'export' | 'rules' | 'library' | null;

function droppedHtmlFile(dt: DataTransfer): File | null {
  return Array.from(dt.files ?? []).find((f) => /\.html?$/i.test(f.name)) ?? null;
}

export function App() {
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [dragOver, setDragOver] = useState(false);
  const [htmlDialogOpen, setHtmlDialogOpen] = useState(false);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData) return;
      const files = extractImageFiles(e.clipboardData);
      if (files.length > 0) void handleFiles(files);
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // レンズ(H1): スペースを押している間だけ「いま」を覗ける(写真編集ソフトの前後比較と同じ型)
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      const tag = (el as HTMLElement | null)?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA';
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' || isTypingTarget(e.target)) return;
      e.preventDefault();
      spaceHeld.value = true;
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code !== 'Space') return;
      spaceHeld.value = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  if (!ready.value) return <div class="loading">読み込み中…</div>;

  const board = currentBoard.value;
  const spot = board?.spots.find((s) => s.id === selectedSpotId.value) ?? null;
  const page = board?.pages.find((p) => p.id === activePageId.value) ?? null;

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
        const htmlFile = droppedHtmlFile(e.dataTransfer!);
        if (htmlFile) {
          void htmlFile.text().then((raw) => handleHtml(raw, { allowExternal: false }));
          return;
        }
        void handleFiles(extractImageFiles(e.dataTransfer!));
      }}
    >
      <header class="topbar">
        <button class="wordmark" onClick={() => (currentBoardId.value = null)} title="ボード一覧に戻る">
          <img class="wordmark-mark" src={markSmallUrl} alt="" width={20} height={20} />
          UI ColLabo
        </button>
        {board && <span class="topbar-title">{board.title}</span>}
        <div class="topbar-spacer" />
        {board && (
          <>
            <button class="btn-sm" onClick={() => setHtmlDialogOpen(true)}>HTMLを読み込む</button>
            <button class="btn-sm" onClick={() => setDrawer('rules')}>ルール</button>
            <button class="btn-sm" onClick={() => setDrawer('library')}>ライブラリ</button>
            <button class="btn" onClick={() => setDrawer('export')}>
              AIに渡す
              {specifiedSpotCount(board) > 0 && <span class="btn-badge">{specifiedSpotCount(board)}</span>}
            </button>
          </>
        )}
      </header>

      {!board ? (
        <Empty dragOver={dragOver} onOpenHtmlIntake={() => setHtmlDialogOpen(true)} />
      ) : (
        <main class="main-layout">
          <div class="board-column">
            {page?.source ? <HtmlBoard key={page.id} board={board} page={page} /> : <Board />}
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
            <div class="side-panel-top">
              {board.imageRole === null && board.pages.some((p) => p.image) ? (
                <ImageRolePrompt />
              ) : spot ? (
                <SpotPanel spot={spot} />
              ) : (
                <BoardPanel />
              )}
            </div>
            <LivePreview board={board} selectedN={spot?.n ?? null} />
          </aside>
        </main>
      )}

      {drawer === 'export' && board && <ExportDrawer board={board} onClose={() => setDrawer(null)} />}
      {drawer === 'rules' && board && <RulesDrawer board={board} onClose={() => setDrawer(null)} />}
      {drawer === 'library' && board && <LibraryDrawer board={board} onClose={() => setDrawer(null)} />}
      {htmlDialogOpen && <HtmlIntakeDialog onClose={() => setHtmlDialogOpen(false)} />}
      <Toast />
    </div>
  );
}

/** 「AIに渡す」の進捗バッジ用。1つ以上ノートを持つか、残す指定がある箇所の数。 */
function specifiedSpotCount(board: BoardData): number {
  return board.spots.filter((s) => s.notes.length > 0 || s.keep).length;
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
