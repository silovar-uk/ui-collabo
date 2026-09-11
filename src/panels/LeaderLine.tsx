import { useEffect, useState } from 'preact/hooks';
import { hoverLine } from '../state';

interface Points {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** H3: 指示文の行にホバーすると、行から箇所の辺へ朱の引き出し線を引く。 */
export function LeaderLine() {
  const [pts, setPts] = useState<Points | null>(null);
  const current = hoverLine.value;

  useEffect(() => {
    if (!current) {
      setPts(null);
      return;
    }
    let raf = 0;
    // ponytail: スクロール追従のためrAFで毎フレーム再計算する。1本だけなので負荷は無視できる
    function tick() {
      const lineEl = document.querySelector(`[data-line-key="${CSS.escape(current!.lineKey)}"]`);
      const spotEl = document.querySelector(`[data-spot-id="${CSS.escape(current!.spotId)}"]`);
      if (lineEl && spotEl) {
        const lr = lineEl.getBoundingClientRect();
        const sr = spotEl.getBoundingClientRect();
        setPts({ x1: lr.left, y1: lr.top + lr.height / 2, x2: sr.left, y2: sr.top + sr.height / 2 });
      } else {
        setPts(null);
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [current?.spotId, current?.lineKey]);

  if (!pts) return null;
  return (
    <svg class="leader-line-overlay">
      <line x1={pts.x1} y1={pts.y1} x2={pts.x2} y2={pts.y2} />
    </svg>
  );
}
