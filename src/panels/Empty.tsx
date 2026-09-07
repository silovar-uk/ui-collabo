import { cloneAndOpenBoard, createBoard, createFromTemplate, deleteBoard, deleteTemplate, library, openBoard, updateBoard } from '../state';
import { SAMPLES } from '../samples';
import type { Format } from '../schema';

function createBlankBoard(format: Format) {
  createBoard(format);
  updateBoard((b) => ({ ...b, pages: [{ id: crypto.randomUUID(), image: null }] }));
}

const FORMATS: { format: Format; label: string }[] = [
  { format: { kind: 'web' }, label: 'Web(縦長)' },
  { format: { kind: 'slide', aspect: '16:9' }, label: 'スライド 16:9' },
  { format: { kind: 'slide', aspect: '4:3' }, label: 'スライド 4:3' },
];

export function Empty() {
  const boards = library.value.boards;
  const templates = library.value.templates;
  const hasAnything = boards.length > 0 || templates.length > 0;

  return (
    <div class="empty-screen">
      <div class="empty-entry">
        <h2>貼る</h2>
        <p>スクリーンショットを貼り付け(Ctrl+V)、またはここにドロップ</p>
      </div>

      <div class="empty-entry">
        <h2>白紙から</h2>
        <div class="empty-format-list">
          {FORMATS.map(({ format, label }) => (
            <button key={label} class="btn" onClick={() => createBlankBoard(format)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div class="empty-entry">
        <h2>開く</h2>
        {!hasAnything && <p class="muted">保存したボード・型はまだありません</p>}
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
        <p class="field-label">サンプル</p>
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
  );
}
