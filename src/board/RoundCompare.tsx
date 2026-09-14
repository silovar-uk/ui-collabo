import { useEffect, useState } from 'preact/hooks';
import { library } from '../state';
import { analyzeImageDiff, type ExpectedDiffTarget, type VisualDiffResult } from '../lib/visualDiff';
import type { Board } from '../schema';

/**
 * R2: 表示中ページに対応する前回画像を重ねる。
 * 次フェーズでは、前回/今回の画像差分を「指示内 / 想定外」の候補として可視化する。
 * 差分は補助情報であり、Spotの○/×を自動確定しない。
 */
export function RoundCompare({ board, pageId }: { board: Board; pageId: string }) {
  const [opacity, setOpacity] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState<VisualDiffResult | null>(null);
  const [diffState, setDiffState] = useState<'idle' | 'loading' | 'error'>('idle');

  const pageIndex = board.pages.findIndex((p) => p.id === pageId);
  const prev = board.round ? library.value.boards.find((b) => b.id === board.round!.prevBoardId) : undefined;
  const prevImage = pageIndex >= 0 ? prev?.pages[pageIndex]?.image : null;
  const currentImage = pageIndex >= 0 ? board.pages[pageIndex]?.image : null;

  const expectedTargets: ExpectedDiffTarget[] = board.spots
    .filter((spot) => spot.pageId === pageId && spot.carried && !spot.keep)
    .flatMap((spot) => {
      const targets: ExpectedDiffTarget[] = [{ id: spot.id, rect: spot.rect }];
      if (spot.targetRect) targets.push({ id: spot.id, rect: spot.targetRect });
      return targets;
    });
  const targetKey = expectedTargets
    .map((target) => `${target.id}:${target.rect.x},${target.rect.y},${target.rect.w},${target.rect.h}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;
    if (!showDiff || !prevImage || !currentImage) {
      setDiff(null);
      setDiffState('idle');
      return () => { cancelled = true; };
    }

    setDiffState('loading');
    void analyzeImageDiff(prevImage, currentImage, expectedTargets)
      .then((result) => {
        if (cancelled) return;
        setDiff(result);
        setDiffState('idle');
      })
      .catch(() => {
        if (cancelled) return;
        setDiff(null);
        setDiffState('error');
      });

    return () => { cancelled = true; };
  }, [showDiff, prevImage?.dataUrl, currentImage?.dataUrl, targetKey]);

  if (!board.round || pageIndex < 0 || !prevImage || !currentImage) return null;

  return (
    <div class="round-compare">
      <img class="round-compare-image" src={prevImage.dataUrl} style={{ opacity: opacity / 100 }} draggable={false} />

      {showDiff && diff && (
        <div class="visual-diff-overlay" aria-hidden="true">
          {diff.regions.map((region, index) => (
            <div
              key={`${region.kind}-${index}`}
              class={`visual-diff-region is-${region.kind}`}
              style={{
                left: `${region.rect.x * 100}%`,
                top: `${region.rect.y * 100}%`,
                width: `${region.rect.w * 100}%`,
                height: `${region.rect.h * 100}%`,
              }}
            >
              <span>{region.kind === 'expected' ? '指示内' : '想定外'}</span>
            </div>
          ))}
        </div>
      )}

      <div class="visual-diff-controls">
        <button
          type="button"
          class={`btn-sm visual-diff-toggle${showDiff ? ' is-active' : ''}`}
          aria-pressed={showDiff}
          aria-label={showDiff ? '差分候補を隠す' : '差分候補を表示'}
          onClick={() => setShowDiff((value) => !value)}
        >
          {diffState === 'loading' ? '差分を計算中…' : showDiff ? '差分候補 ON' : '差分候補'}
        </button>
        {showDiff && diff && (
          <div class="visual-diff-summary" role="status">
            <span>指示内 <b>{diff.expected.length}</b></span>
            <span>想定外 <b>{diff.unexpected.length}</b></span>
            {diff.dimensionMismatch && <span class="visual-diff-warning">画像サイズ差あり</span>}
          </div>
        )}
        {showDiff && diffState === 'error' && <span class="visual-diff-warning">差分を計算できません</span>}
        {showDiff && <small>候補表示のみ。○/×は人が確認</small>}
      </div>

      <div class="round-compare-slider">
        <span>今回</span>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          aria-label="前回画像の重ね合わせ"
          onInput={(e) => setOpacity(Number((e.target as HTMLInputElement).value))}
        />
        <span>前回</span>
      </div>
    </div>
  );
}
