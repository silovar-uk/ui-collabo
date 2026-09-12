import { useEffect, useState } from 'preact/hooks';
import { activePageId, currentBoard, currentBoardId, ready, saveStatus, selectedSpotId, spaceHeld } from './state';
import { extractImageFiles } from './lib/image';
import { handleFiles, handleHtml } from './lib/intake';
import { hasSpecifiedContent } from './export';
import { isProofed } from './lib/round';
import { Board } from './board/Board';
import { HtmlBoard } from './board/HtmlBoard';
import { Empty } from './panels/Empty';
import { Sheet } from './panels/Sheet';
import { LeaderLine } from './panels/LeaderLine';
import { ExportDrawer } from './panels/ExportDrawer';
import { RulesDrawer } from './panels/RulesDrawer';
import { LibraryDrawer } from './panels/LibraryDrawer';
import { HtmlIntakeDialog } from './panels/HtmlIntakeDialog';
import { Toast } from './panels/Toast';
import markSmallUrl from '../brand/mark-small.svg';
import type { Board as BoardModel } from './schema';

type DrawerKind = 'export' | 'rules' | 'library' | null;

const LAB_PHASES = [
  { code: '01', en: 'INPUT', ja: '貼る' },
  { code: '02', en: 'MARK', ja: '囲う' },
  { code: '03', en: 'DEFINE', ja: '選ぶ' },
  { code: '04', en: 'HANDOFF', ja: '渡す' },
  { code: '05', en: 'VERIFY', ja: '照合' },
] as const;

function droppedHtmlFile(dt: DataTransfer): File | null {
  return Array.from(dt.files ?? []).find((f) => /\.html?$/i.test(f.name)) ?? null;
}

function labPhase(board: BoardModel): number {
  if (isProofed(board) || board.round) return 4;
  const activeSpots = board.spots.filter((spot) => !spot.keep);
  const specified = activeSpots.filter((spot) => hasSpecifiedContent(spot, board));
  if (specified.length > 0) return 3;
  if (activeSpots.length > 0) return 2;
  if (board.pages.some((page) => !!page.image || !!page.source)) return 1;
  return 0;
}

function formatLabel(board: BoardModel): string {
  if (board.format.kind === 'web') return 'WEB';
  if (board.format.kind === 'slide') return `SLIDE ${board.format.aspect}`;
  return 'FREE';
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

  if (!ready.value) {
    return (
      <div class="loading lab-loading">
        <span class="lab-loading-code">LAB / BOOT</span>
        <span>読み込み中…</span>
      </div>
    );
  }

  const board = currentBoard.value;
  const page = board?.pages.find((p) => p.id === activePageId.value) ?? null;
  const phase = board ? labPhase(board) : 0;
  const activeSpots = board?.spots.filter((spot) => !spot.keep) ?? [];
  const specifiedCount = board ? activeSpots.filter((spot) => hasSpecifiedContent(spot, board)).length : 0;
  const keptCount = board?.spots.filter((spot) => spot.keep).length ?? 0;
  const pageIndex = board && page ? board.pages.findIndex((p) => p.id === page.id) : -1;
  const specimenKind = page?.source ? 'HTML' : page?.image ? 'IMAGE' : 'BLANK';
  const specimenSize = page?.image ? `${page.image.width}×${page.image.height}` : null;

  return (
    <div
      class={`app-shell lab-shell${dragOver ? ' is-drag-over' : ''}`}
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
      <header class="topbar lab-topbar">
        <button class="wordmark lab-wordmark" onClick={() => (currentBoardId.value = null)} title="ボード一覧に戻る">
          <span class="lab-wordmark-plate">
            <img class="wordmark-mark" src={markSmallUrl} alt="" width={20} height={20} />
          </span>
          <span class="lab-wordmark-copy">
            <strong>UI ColLabo</strong>
            <small>DESIGN REVIEW LAB</small>
          </span>
        </button>

        {board && (
          <div class="lab-board-identity">
            <span class="lab-micro-label">EXPERIMENT</span>
            <span class="topbar-title">{board.title}</span>
          </div>
        )}

        <div class="topbar-spacer" />

        {board && saveStatus.value !== 'idle' && (
          <span class={`save-status lab-save-status is-${saveStatus.value}`} aria-live="polite">
            <span class="lab-status-lamp" aria-hidden="true" />
            {saveStatus.value === 'saving' ? '保存中' : saveStatus.value === 'error' ? '保存失敗' : '保存済み'}
          </span>
        )}

        {board && (
          <div class="lab-top-actions" aria-label="ツール">
            <button class="btn-sm lab-action" onClick={() => setHtmlDialogOpen(true)}><span>IMPORT</span>HTML</button>
            <button class="btn-sm lab-action" onClick={() => setDrawer('rules')}><span>STANDARD</span>ルール</button>
            <button class="btn-sm lab-action" onClick={() => setDrawer('library')}><span>ARCHIVE</span>ライブラリ</button>
            <button class="btn-sm lab-action" onClick={() => setDrawer('export')}><span>OUTPUT</span>書き出し</button>
          </div>
        )}
      </header>

      {board && (
        <div class="lab-sequence" aria-label={`現在の工程: ${LAB_PHASES[phase].ja}`}>
          <div class="lab-sequence-meta">
            <span class="lab-micro-label">PROTOCOL</span>
            <strong>{board.round ? 'REVISION' : 'BASE'} / {formatLabel(board)}</strong>
          </div>
          <ol class="lab-phase-list">
            {LAB_PHASES.map((item, index) => (
              <li class={`${index === phase ? 'is-current' : ''}${index < phase ? ' is-complete' : ''}`} key={item.code}>
                <span class="lab-phase-code">{item.code}</span>
                <span class="lab-phase-en">{item.en}</span>
                <span class="lab-phase-ja">{item.ja}</span>
              </li>
            ))}
          </ol>
          <div class="lab-sequence-readout" aria-label="ボード状態">
            <span><b>{String(board.pages.length).padStart(2, '0')}</b> specimens</span>
            <span><b>{String(specifiedCount).padStart(2, '0')}</b> instructions</span>
          </div>
        </div>
      )}

      {!board ? (
        <Empty dragOver={dragOver} onOpenHtmlIntake={() => setHtmlDialogOpen(true)} />
      ) : (
        <main class="main-layout lab-workbench">
          <nav class="specimen-rail" aria-label="ページ一覧">
            <div class="specimen-rail-head">
              <span>SPEC</span>
              <strong>{String(Math.max(pageIndex + 1, 1)).padStart(2, '0')}/{String(board.pages.length).padStart(2, '0')}</strong>
            </div>
            <div class="specimen-rail-list">
              {board.pages.map((p, i) => (
                <button
                  key={p.id}
                  class={`page-thumb specimen-thumb${activePageId.value === p.id ? ' is-active' : ''}`}
                  onClick={() => {
                    activePageId.value = p.id;
                    selectedSpotId.value = null;
                  }}
                  aria-label={`標本 ${i + 1}${activePageId.value === p.id ? ' 選択中' : ''}`}
                >
                  <span class="specimen-thumb-code">{String(i + 1).padStart(2, '0')}</span>
                  {p.image ? <img src={p.image.dataUrl} alt="" /> : <span class="specimen-thumb-blank">{p.source ? 'HTML' : 'BLANK'}</span>}
                </button>
              ))}
            </div>
          </nav>

          <section class="board-column lab-bench" aria-label="標本作業台">
            <div class="lab-bench-header">
              <div>
                <span class="lab-micro-label">SPECIMEN {String(Math.max(pageIndex + 1, 1)).padStart(2, '0')}</span>
                <strong>{page?.label || specimenKind}</strong>
              </div>
              <div class="lab-bench-readouts">
                <span>TYPE <b>{specimenKind}</b></span>
                {specimenSize && <span>SIZE <b>{specimenSize}</b></span>}
                <span>MARKS <b>{String(activeSpots.length).padStart(2, '0')}</b></span>
              </div>
              <span class="lab-bench-hint">ドラッグして気になる箇所を囲う</span>
            </div>
            <div class="lab-bench-surface">
              {page?.source ? <HtmlBoard key={page.id} board={board} page={page} /> : <Board />}
            </div>
          </section>

          <aside class="side-panel lab-protocol-panel">
            <div class="lab-panel-header">
              <div>
                <span class="lab-micro-label">PROTOCOL / LIVE</span>
                <strong>指示書</strong>
              </div>
              <div class="lab-panel-counts">
                <span>{specifiedCount} 指示</span>
                {keptCount > 0 && <span>{keptCount} 固定</span>}
              </div>
            </div>
            <Sheet board={board} />
          </aside>
          <LeaderLine />
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
