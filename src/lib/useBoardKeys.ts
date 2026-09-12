import { useEffect } from 'preact/hooks';
import { currentBoard, deleteSpot, pickerOpen, redo, selectedSpotId, undo } from '../state';
import { getSpotEditTarget } from './spotTarget';
import { clampRect } from './geometry';

const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

function isTypingTarget(el: EventTarget | null): boolean {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/** Delete・Backspace・矢印キーは、フォーカスがbodyかボード内のときだけ効かせる(誤爆防止)。 */
function isBoardFocusTarget(): boolean {
  const active = document.activeElement;
  if (!active || active === document.body) return true;
  return !!active.closest('.board-surface');
}

/**
 * 画像ページ・HTMLページの両ボードに共通のキー操作(S6)。
 * Escapeは「開いているピッカー→箇所の選択」の順に1段ずつ閉じる。
 */
export function useBoardKeys(): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        if (pickerOpen.value) pickerOpen.value = false;
        else selectedSpotId.value = null;
        return;
      }
      if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        redo();
        return;
      }

      const board = currentBoard.value;
      if (!board || !isBoardFocusTarget()) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedSpotId.value) {
        deleteSpot(selectedSpotId.value);
      } else if (ARROW_KEYS.includes(e.key) && selectedSpotId.value) {
        e.preventDefault();
        const spot = board.spots.find((s) => s.id === selectedSpotId.value);
        if (!spot) return;
        const step = e.shiftKey ? 0.05 : 0.01;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const t = getSpotEditTarget(board, spot);
        t.apply(clampRect({ x: t.rect.x + dx, y: t.rect.y + dy, w: t.rect.w, h: t.rect.h }));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
