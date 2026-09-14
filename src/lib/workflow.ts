import { hasSpecifiedContent } from './instructions';
import { isProofed } from './round';
import type { Board } from '../schema';

export type WorkflowState = 'input' | 'mark' | 'define' | 'handoff' | 'verify' | 'proofed';

/**
 * 画面上の工程は保存せず、Boardの事実から毎回導出する。
 * 再校でも、新規指示または「×まだ」の指示があればHANDOFFへ戻れる。
 */
export function deriveWorkflowState(board: Board): WorkflowState {
  if (isProofed(board)) return 'proofed';

  const activeSpots = board.spots.filter((spot) => !spot.keep);
  const specified = activeSpots.filter((spot) => hasSpecifiedContent(spot, board));

  if (board.round) {
    const needsAnotherHandoff = specified.some((spot) => !spot.carried || spot.check === 'ng');
    if (needsAnotherHandoff) return 'handoff';

    const pendingVerification = board.spots.some((spot) => spot.carried && spot.check === undefined);
    if (pendingVerification) return 'verify';
  }

  if (specified.length > 0) return 'handoff';
  if (activeSpots.length > 0) return 'define';
  if (board.pages.length > 0) return 'mark';
  return 'input';
}

export function workflowPhaseIndex(state: WorkflowState): number {
  switch (state) {
    case 'input': return 0;
    case 'mark': return 1;
    case 'define': return 2;
    case 'handoff': return 3;
    case 'verify':
    case 'proofed':
      return 4;
  }
}
