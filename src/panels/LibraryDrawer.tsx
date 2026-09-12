import { useRef } from 'preact/hooks';
import {
  applyRuleSet,
  createFromTemplate,
  deleteBoard,
  deleteRuleSet,
  deleteTemplate,
  exportLibraryJson,
  library,
  openBoard,
  replaceLibrary,
  saveAsTemplate,
} from '../state';
import { parseLibraryJson } from '../lib/libraryValidation';
import { Drawer } from './Drawer';
import type { Board } from '../schema';

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function backupName(): string {
  return `ui-collabo-library-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
}

export function LibraryDrawer({ board, onClose }: { board: Board; onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const lib = library.value;

  function download() {
    downloadText(exportLibraryJson(), 'ui-collabo-library.json');
  }

  async function handleImport(file: File) {
    try {
      const next = parseLibraryJson(await file.text());
      if (!confirm('現在のライブラリを読み込んだ内容で置き換えます。現在データは自動でバックアップします。続けますか?')) return;
      downloadText(exportLibraryJson(), backupName());
      replaceLibrary(next);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : '読み込みに失敗しました');
    }
  }

  return (
    <Drawer onClose={onClose} ariaLabel="ライブラリ" header={<span class="tab is-active">ライブラリ</span>}>
      <div class="drawer-body">
        <div class="field">
          <span class="field-label">保存したルール</span>
          {lib.ruleSets.length === 0 ? (
            <p class="muted">まだありません。ルールドロワーの「名前をつけて保存する」で追加できます</p>
          ) : (
            <ul class="board-list">
              {lib.ruleSets.map((rs) => (
                <li key={rs.id}>
                  <button class="board-list-item" onClick={() => applyRuleSet(rs.id)}>{rs.name}</button>
                  <button class="board-list-delete" onClick={() => deleteRuleSet(rs.id)}>削除</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div class="field">
          <span class="field-label">保存したボード</span>
          <ul class="board-list">
            {lib.boards.map((b) => (
              <li key={b.id}>
                <button class="board-list-item" disabled={b.id === board.id} onClick={() => { openBoard(b.id); onClose(); }}>
                  {b.title}{b.id === board.id ? '(このボード)' : ''}
                </button>
                <button class="board-list-delete" onClick={() => deleteBoard(b.id)}>削除</button>
              </li>
            ))}
          </ul>
        </div>

        <div class="field">
          <span class="field-label">型</span>
          <button class="btn-sm" onClick={saveAsTemplate}>現在のボードを型として保存</button>
          {lib.templates.length === 0 ? (
            <p class="muted">まだありません</p>
          ) : (
            <ul class="board-list">
              {lib.templates.map((t) => (
                <li key={t.id}>
                  <button class="board-list-item" onClick={() => { createFromTemplate(t.id); onClose(); }}>
                    {t.title}(型から新規)
                  </button>
                  <button class="board-list-delete" onClick={() => deleteTemplate(t.id)}>削除</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div class="field">
          <span class="field-label">書き出し / 読み込み</span>
          <p class="muted">読み込み前に構造を検証し、置き換え時は現在データを自動バックアップします。</p>
          <div class="chip-row">
            <button class="btn-sm" onClick={download}>書き出す</button>
            <button class="btn-sm" onClick={() => fileRef.current?.click()}>読み込む</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                input.value = '';
                if (file) void handleImport(file);
              }}
            />
          </div>
        </div>
      </div>
    </Drawer>
  );
}
