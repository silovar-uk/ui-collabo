import { cloneAndOpenBoard, createBoard, createFromTemplate, deleteBoard, deleteTemplate, library, openBoard, updateBoard } from '../state';
import { handleFiles } from '../lib/intake';
import { SAMPLES } from '../samples';
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
  { n: 1, verb: '貼る', desc: '画像を貼る' },
  { n: 2, verb: '囲う', desc: '気になる箇所を囲む' },
  { n: 3, verb: '選ぶ', desc: 'こうしたいを選ぶ' },
  { n: 4, verb: '渡す', desc: '指示文をコピーしてAIへ' },
];

function onFileInputChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length > 0) void handleFiles(files);
  input.value = '';
}

export function Empty({ dragOver }: { dragOver: boolean }) {
  const boards = library.value.boards;
  const templates = library.value.templates;

  return (
    <div class="empty-screen">
      <div class="empty-hero">
        <img class="empty-mark" src={markUrl} alt="" width={40} height={40} />
        <div>
          <h1 class="empty-title">UI ColLabo</h1>
          <p class="empty-tagline">「なんか違う」を、伝わる形に。</p>
        </div>
      </div>

      <div class="empty-intake">
        <label class={`empty-dropzone${dragOver ? ' is-drag-over' : ''}`}>
          <p class="empty-dropzone-title">{dragOver ? 'ここに落とす' : 'スクリーンショットをここにドロップ'}</p>
          <p class="muted">Ctrl+V で貼り付け、またはクリックしてファイルを選ぶ</p>
          <input type="file" accept="image/*" multiple hidden onChange={onFileInputChange} />
        </label>

        <div class="empty-samples">
          <h2>まず触ってみる</h2>
          <ul class="board-list">
            {SAMPLES.map((sample) => (
              <li key={sample.id}>
                <button class="board-list-item" onClick={() => cloneAndOpenBoard(sample.board)}>
                  {sample.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ol class="empty-steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span class="empty-step-n">{s.n}</span>
            <span class="empty-step-verb">{s.verb}</span>
            <span class="empty-step-desc">{s.desc}</span>
          </li>
        ))}
      </ol>

      <details class="empty-section">
        <summary>白紙から始める</summary>
        <div class="empty-format-list">
          {FORMATS.map(({ format, label }) => (
            <button key={label} class="btn-sm" onClick={() => createBlankBoard(format)}>
              {label}
            </button>
          ))}
        </div>
      </details>

      {(boards.length > 0 || templates.length > 0) && (
        <details class="empty-section" open>
          <summary>保存したボード({boards.length + templates.length}件)</summary>
          {templates.length > 0 && (
            <ul class="board-list">
              {templates.map((t) => (
                <li key={t.id}>
                  <button class="board-list-item" onClick={() => createFromTemplate(t.id)}>
                    {t.title}(型から新規)
                  </button>
                  <button class="board-list-delete" title="削除" onClick={() => deleteTemplate(t.id)}>削除</button>
                </li>
              ))}
            </ul>
          )}
          {boards.length > 0 && (
            <ul class="board-list">
              {boards.map((b) => (
                <li key={b.id}>
                  <button class="board-list-item" onClick={() => openBoard(b.id)}>
                    {b.title}
                  </button>
                  <button
                    class="board-list-delete"
                    title="削除"
                    onClick={() => {
                      if (confirm(`「${b.title}」を削除しますか?`)) deleteBoard(b.id);
                    }}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </div>
  );
}
