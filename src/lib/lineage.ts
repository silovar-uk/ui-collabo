import { deriveWorkflowState, type WorkflowState } from './workflow';
import type { Board } from '../schema';

export interface BoardLineage {
  root: Board;
  boards: Board[];
}

function rootFor(board: Board, byId: Map<string, Board>): Board {
  let current = board;
  const visited = new Set<string>();
  while (current.round?.prevBoardId) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    const prev = byId.get(current.round.prevBoardId);
    if (!prev) break;
    current = prev;
  }
  return current;
}

/** 既存prevBoardIdだけで版を束ねる。Project schemaはまだ導入しない。 */
export function buildLineages(boards: Board[]): BoardLineage[] {
  const byId = new Map(boards.map((board) => [board.id, board]));
  const groups = new Map<string, BoardLineage>();

  for (const board of boards) {
    const root = rootFor(board, byId);
    const existing = groups.get(root.id);
    if (existing) existing.boards.push(board);
    else groups.set(root.id, { root, boards: [board] });
  }

  const result = [...groups.values()];
  for (const lineage of result) {
    lineage.boards.sort((a, b) => {
      const roundA = a.round?.n ?? 1;
      const roundB = b.round?.n ?? 1;
      if (roundA !== roundB) return roundA - roundB;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }
  result.sort((a, b) => b.root.updatedAt.localeCompare(a.root.updatedAt));
  return result;
}

export function revisionStatus(board: Board): WorkflowState {
  return deriveWorkflowState(board);
}

export function revisionLabel(board: Board): string {
  const n = board.round?.n ?? 1;
  if (n === 1) return '初校';
  if (n === 2) return '再校';
  return `第${n}校`;
}
