import { useEffect, useState } from 'preact/hooks';
import { library, nextSpotNumber, selectedSpotId, updateBoard } from '../state';
import { diffRegionKey, diffRegionToSpot } from '../lib/diffTriage';
import { analyzeImageDiff, type ExpectedDiffTarget, type VisualDiffResult } from '../lib/visualDiff';
import type { Board, Rect } from '../schema';

type TriageResolution = 'spot' | 'ignored';

function regionStyle(rect: Rect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}

/**
 * R2: 表示中ページに対応する前回画像を重ねる。
 * 前回/今回の画像差分を「指示内 / 要確認」の候補として可視化し、
 * 要確認候補は既存Spotへ昇格できる。差分だけでSpotの○/×は自動確定しない。
 */
export function RoundCompare({ board, pageId }: { board: Board; pageId: string }) {
  const [opacity, setOpacity] = useState(0);
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState<VisualDiffResult | null>(null);
  const [diffState, setDiffState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selectedUnexpectedKey, setSelectedUnexpectedKey] = useState<string | null>(null);
  const [triaged, setTriaged] = useState<Record<string, TriageResolution>>({});

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
  const expectedSpotCount = new Set(expectedTargets.map((target) => target.id)).size;
  const targetKey = expectedTargets
    .map((target) => `${target.id}:${target.rect.x},${target.rect.y},${target.rect.w},${target.rect.h}`)
    .join('|');

  useEffect(() => {
    setSelectedUnexpectedKey(null);
    setTriaged({});
  }, [pageId, prevImage?.dataUrl, currentImage?.dataUrl]);

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

  const unexpectedEntries = (diff?.unexpected ?? []).map((region) => ({ region, key: diffRegionKey(region) }));
  const pendingUnexpected = unexpectedEntries.filter((entry) => !triaged[entry.key]);
  const selectedUnexpected = pendingUnexpected.find((entry) => entry.key === selectedUnexpectedKey) ?? null;
  const spotizedCount = Object.values(triaged).filter((value) => value === 'spot').length;
  const ignoredCount = Object.values(triaged).filter((value) => value === 'ignored').length;

  function createInstructionFromSelected(): void {
    if (!selectedUnexpected) return;
    let createdId: string | null = null;
    updateBoard((liveBoard) => {
      const spot = diffRegionToSpot({
        region: selectedUnexpected.region,
        pageId,
        n: nextSpotNumber(liveBoard),
      });
      createdId = spot.id;
      return { ...liveBoard, spots: [...liveBoard.spots, spot] };
    });
    if (createdId) selectedSpotId.value = createdId;
    setTriaged((current) => ({ ...current, [selectedUnexpected.key]: 'spot' }));
    setSelectedUnexpectedKey(null);
  }

  function ignoreSelectedForSession(): void {
    if (!selectedUnexpected) return;
    setTriaged((current) => ({ ...current, [selectedUnexpected.key]: 'ignored' }));
    setSelectedUnexpectedKey(null);
  }

  function toggleDiff(): void {
    if (showDiff) setSelectedUnexpectedKey(null);
    setShowDiff((value) => !value);
  }

  return (
    <div class="round-compare">
      <img class="round-compare-image" src={prevImage.dataUrl} style={{ opacity: opacity / 100 }} draggable={false} />

      {showDiff && diff && (
        <div class="visual-diff-overlay">
          {diff.expected.map((region, index) => (
            <div
              key={`expected-${index}`}
              class="visual-diff-region is-expected"
              style={regionStyle(region.rect)}
              aria-hidden="true"
            >
              <span>指示内</span>
            </div>
          ))}
          {pendingUnexpected.map(({ region, key }, index) => (
            <button
              key={key}
              type="button"
              class={`visual-diff-region is-unexpected${selectedUnexpectedKey === key ? ' is-selected' : ''}`}
              style={regionStyle(region.rect)}
              aria-label={`要確認の差分候補 ${index + 1}`}
              aria-pressed={selectedUnexpectedKey === key}
              onClick={() => setSelectedUnexpectedKey((current) => (current === key ? null : key))}
            >
              <span>要確認</span>
            </button>
          ))}
        </div>
      )}

      <div
        class="visual-diff-controls"
        data-expected-spots={expectedSpotCount}
        data-pending-unexpected={pendingUnexpected.length}
      >
        <button
          type="button"
          class={`btn-sm visual-diff-toggle${showDiff ? ' is-active' : ''}`}
          aria-pressed={showDiff}
          aria-label={showDiff ? '差分候補を隠す' : '差分候補を表示'}
          onClick={toggleDiff}
        >
          {diffState === 'loading' ? '差分を計算中…' : showDiff ? '差分候補 ON' : '差分候補'}
        </button>
        {showDiff && (
          <div class="visual-diff-summary" role="status">
            <span>指示対象 <b>{expectedSpotCount}</b></span>
            {diff && <span>指示内 <b>{diff.expected.length}</b></span>}
            {diff && <span>要確認 <b>{pendingUnexpected.length}</b></span>}
            {diff?.dimensionMismatch && <span class="visual-diff-warning">画像サイズ差あり</span>}
          </div>
        )}
        {showDiff && selectedUnexpected && (
          <div class="visual-diff-triage" aria-label="差分候補の処理">
            <strong>この変化をどうする？</strong>
            <button type="button" class="btn-sm" onClick={createInstructionFromSelected}>修正指示にする</button>
            <button
              type="button"
              class="btn-sm visual-diff-ignore"
              title="この画面を開いている間だけ候補から外します"
              onClick={ignoreSelectedForSession}
            >
              今回は無視
            </button>
          </div>
        )}
        {showDiff && expectedSpotCount === 0 && <span class="visual-diff-warning">比較対象の指示なし</span>}
        {showDiff && diffState === 'error' && <span class="visual-diff-warning">差分を計算できません</span>}
        {showDiff && (spotizedCount > 0 || ignoredCount > 0) && (
          <small class="visual-diff-triage-result">
            {spotizedCount > 0 ? `指示化 ${spotizedCount}` : ''}
            {spotizedCount > 0 && ignoredCount > 0 ? ' / ' : ''}
            {ignoredCount > 0 ? `無視 ${ignoredCount}（再読み込みで戻る）` : ''}
          </small>
        )}
        {showDiff && <small>要確認候補を押すと修正指示にできます。○/×は人が確認</small>}
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
