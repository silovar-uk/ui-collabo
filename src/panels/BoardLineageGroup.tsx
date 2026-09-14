import { revisionLabel, revisionStatus, type BoardLineage } from '../lib/lineage';

const STATUS_LABEL = {
  input: '未着手',
  mark: '対象あり',
  define: '指示待ち',
  handoff: '受け渡し待ち',
  verify: '照合中',
  proofed: '校了',
} as const;

export function BoardLineageGroup({
  lineage,
  currentBoardId,
  onOpen,
  onDelete,
}: {
  lineage: BoardLineage;
  currentBoardId: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section class="board-lineage-group">
      <div class="board-lineage-head">
        <strong>{lineage.root.title.replace(/(?:\(再校\))+$/, '')}</strong>
        <span>{lineage.boards.length}版</span>
      </div>
      <ul class="board-list board-lineage-list">
        {lineage.boards.map((board) => {
          const status = revisionStatus(board);
          const unresolved = board.spots.filter((spot) => spot.carried && spot.check !== 'ok').length;
          return (
            <li key={board.id}>
              <button class="board-list-item" disabled={board.id === currentBoardId} onClick={() => onOpen(board.id)}>
                <span class="board-lineage-round">{revisionLabel(board)}</span>
                <span class="board-lineage-status">{STATUS_LABEL[status]}{unresolved > 0 ? ` · ${unresolved}件` : ''}</span>
              </button>
              <button class="board-list-delete" onClick={() => onDelete(board.id)}>削除</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
