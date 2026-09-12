import { cloneAndOpenBoard, createBoard, createFromTemplate, deleteBoard, deleteTemplate, library, openBoard, updateBoard } from '../state';
import { handleFiles } from '../lib/intake';
import { SAMPLES } from '../samples';
import { EmptyGhostPreview } from './EmptyGhostPreview';
import type { Format } from '../schema';
import markUrl from '../../brand/mark.svg';

function createBlankBoard(format: Format) {
  createBoard(format);
  updateBoard((b) => ({ ...b, pages: [{ id: crypto.randomUUID(), image: null }] }));
}

const FORMATS: { format: Format; label: string }[] = [
  { format: { kind: 'web' }, label: 'Web(縦長)' },
  { format: { kind: 'slide', aspect: '16:9' }, label: 'スライド 16:9' },
  { format: { kind: 'slide', aspect: '4:3' }, label: 'スライド 4:3' },
];

const STEPS = [
  { n: 1, code: 'INPUT', verb: '貼る', desc: '画像を貼る' },
  { n: 2, code: 'MARK', verb: '囲う', desc: '気になる箇所を囲む' },
  { n: 3, code: 'DEFINE', verb: '選ぶ', desc: 'こうしたいを選ぶ' },
  { n: 4, code: 'HANDOFF', verb: '渡す', desc: '校正画像と指示をAIへ' },
  { n: 5, code: 'VERIFY', verb: '照合', desc: '直った版を貼って確かめる' },
];

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length > 0) void handleFiles(files);
  input.value = '';
}

export function Empty({ dragOver, onOpenHtmlIntake }: { dragOver: boolean; onOpenHtmlIntake: () => void }) {
  const boards = library.value.boards;
  const templates = library.value.templates;

  return (
    <div class="empty-screen lab-home">
      <header class="lab-home-head">
        <div class="empty-hero lab-home-brand">
          <span class="lab-home-mark-plate">
            <img class="empty-mark" src={markUrl} alt="" width={40} height={40} />
          </span>
          <div>
            <span class="lab-kicker">DESIGN REVIEW LAB / 00</span>
            <h1 class="empty-title">UI ColLabo</h1>
            <p class="empty-tagline">「なんか違う」を、伝わる形に。</p>
          </div>
        </div>
        <div class="lab-home-idcard" aria-label="UI ColLaboの役割">
          <span class="lab-micro-label">PURPOSE</span>
          <strong>Visual feedback → AI-ready instructions</strong>
          <p>編集ツールではなく、観察と指示をつなぐ下ごしらえの作業台。</p>
        </div>
      </header>

      <section class="lab-home-module lab-intake-module">
        <div class="lab-module-head">
          <div>
            <span class="lab-module-no">01</span>
            <span class="lab-micro-label">SPECIMEN INTAKE</span>
            <h2>まず、対象を入れる</h2>
          </div>
          <span class="lab-module-state">READY</span>
        </div>

        <div class="empty-intake lab-intake-grid">
          <label class={`empty-dropzone lab-dropzone${dragOver ? ' is-drag-over' : ''}`}>
            <span class="lab-dropzone-cross" aria-hidden="true">＋</span>
            <p class="empty-dropzone-title">{dragOver ? 'ここに落とす' : 'スクリーンショットをここにドロップ'}</p>
            <p class="muted">Ctrl+V で貼り付け / クリックして選択</p>
            <span class="lab-dropzone-foot">PNG / JPEG / WEBP ・ 複数ページ対応</span>
            <input type="file" accept="image/*" multiple hidden onChange={onFileInputChange} />
          </label>

          <div class="lab-intake-side">
            <div class="lab-intake-option">
              <span class="lab-micro-label">ALTERNATIVE INPUT</span>
              <strong>HTMLを観察する</strong>
              <p>Webページは要素を直接選び、CSSの現在値まで指示へつなげます。</p>
              <button class="btn-sm lab-secondary-action" onClick={onOpenHtmlIntake}>HTMLを読み込む</button>
            </div>
            <div class="lab-intake-note">
              <span class="lab-micro-label">LOCAL FIRST</span>
              <p>編集中の画像・ボードはブラウザ内に保存。AIへ渡す操作をするまでは外部へ送りません。</p>
            </div>
          </div>
        </div>
      </section>

      <div class="lab-home-grid">
        <section class="lab-home-module lab-calibration-module">
          <div class="lab-module-head">
            <div>
              <span class="lab-module-no">02</span>
              <span class="lab-micro-label">CALIBRATION SAMPLE</span>
              <h2>まず触ってみる</h2>
            </div>
          </div>
          <div class="empty-samples lab-samples">
            <EmptyGhostPreview />
            <ul class="board-list lab-sample-list">
              {SAMPLES.slice(1).map((sample) => (
                <li key={sample.id}>
                  <button class="board-list-item" onClick={() => cloneAndOpenBoard(sample.board)}>
                    <span class="lab-sample-dot" aria-hidden="true" />
                    {sample.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section class="lab-home-module lab-protocol-module">
          <div class="lab-module-head">
            <div>
              <span class="lab-module-no">03</span>
              <span class="lab-micro-label">STANDARD PROTOCOL</span>
              <h2>5つの工程だけ覚える</h2>
            </div>
          </div>
          <ol class="empty-steps lab-home-steps">
            {STEPS.map((s, i) => (
              <li key={s.n}>
                <span class="empty-step-n">{String(s.n).padStart(2, '0')}</span>
                <span class="lab-step-code">{s.code}</span>
                <span class="empty-step-verb">{s.verb}</span>
                <span class="empty-step-desc">{s.desc}</span>
                {i === STEPS.length - 1 && <span class="empty-step-loop" aria-hidden="true">↺</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div class="lab-home-lower">
        <details class="empty-section lab-home-details">
          <summary><span class="lab-micro-label">BLANK SPECIMEN</span> 白紙から始める</summary>
          <div class="empty-format-list">
            {FORMATS.map(({ format, label }) => (
              <button key={label} class="btn-sm" onClick={() => createBlankBoard(format)}>{label}</button>
            ))}
          </div>
        </details>

        {(boards.length > 0 || templates.length > 0) && (
          <details class="empty-section lab-home-details" open>
            <summary><span class="lab-micro-label">ARCHIVE</span> 保存したボード({boards.length + templates.length}件)</summary>
            {templates.length > 0 && (
              <ul class="board-list">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button class="board-list-item" onClick={() => createFromTemplate(t.id)}>{t.title}(型から新規)</button>
                    <button class="board-list-delete" title="削除" onClick={() => deleteTemplate(t.id)}>削除</button>
                  </li>
                ))}
              </ul>
            )}
            {boards.length > 0 && (
              <ul class="board-list">
                {boards.map((b) => (
                  <li key={b.id}>
                    <button class="board-list-item" onClick={() => openBoard(b.id)}>{b.title}</button>
                    <button
                      class="board-list-delete"
                      title="削除"
                      onClick={() => {
                        if (confirm(`「${b.title}」を削除しますか?`)) deleteBoard(b.id);
                      }}
                    >削除</button>
                  </li>
                ))}
              </ul>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
