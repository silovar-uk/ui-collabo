import { useEffect, useRef, useState } from 'preact/hooks';
import { ratioToPx, type ContainRect } from '../lib/geometry';
import { ghostStyle, recolor } from '../lib/ghost';
import type { Page, Spot } from '../schema';

const REPLAY_MS = 1800;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Props {
  spot: Spot;
  page: Page;
  cr: ContainRect;
}

/** H1: 「こうしたい」をスクショの上で見せる透かし。元の位置には和紙色のベールを掛ける。 */
export function Ghost({ spot, page, cr }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [everHovered, setEverHovered] = useState(false);
  const reduced = prefersReducedMotion();
  const showMotion = !reduced || everHovered;
  const colorNote = spot.notes.find((n) => n.kind === 'color' && n.current !== undefined) as
    | Extract<Spot['notes'][number], { kind: 'color' }>
    | undefined;

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = page.image;
    if (!canvas || !img) return;
    const el = new Image();
    el.onload = () => {
      const sx = spot.rect.x * img.width;
      const sy = spot.rect.y * img.height;
      const sw = spot.rect.w * img.width;
      const sh = spot.rect.h * img.height;
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(el, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      if (colorNote?.current) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        imageData.data.set(recolor(imageData.data, colorNote.current, colorNote.target, 40));
        ctx.putImageData(imageData, 0, 0);
      }
    };
    el.src = img.dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.image?.dataUrl, spot.rect.x, spot.rect.y, spot.rect.w, spot.rect.h, colorNote?.current, colorNote?.target]);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setReplayKey((k) => k + 1), REPLAY_MS);
    return () => clearInterval(id);
  }, [reduced]);

  // アニメーションだけ再生し直す(reflowトリック)。key remountだとcanvasの描画内容ごと消えてしまう
  useEffect(() => {
    const el = ghostElRef.current;
    if (!el || replayKey === 0) return;
    el.style.animation = 'none';
    void el.offsetHeight;
    el.style.animation = '';
  }, [replayKey]);

  if (!page.image) return null;
  const veilPx = ratioToPx(spot.rect, cr);
  const targetRect = spot.targetRect ?? spot.rect;
  const px = ratioToPx(targetRect, cr);
  const style = ghostStyle(spot, cr.width / 1280);

  return (
    <>
      <div class="ghost-veil" style={{ left: veilPx.x, top: veilPx.y, width: veilPx.w, height: veilPx.h }} />
      <div
        ref={ghostElRef}
        class={`ghost${showMotion && style.motionClass ? ` ${style.motionClass}` : ''}`}
        style={{
          left: px.x,
          top: px.y,
          width: px.w,
          height: px.h,
          transform: style.transform,
          transformOrigin: style.transformOrigin,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
          animationDuration: style.animationDuration,
        }}
        onMouseEnter={() => {
          if (reduced) {
            setEverHovered(true);
            setReplayKey((k) => k + 1);
          }
        }}
      >
        <canvas ref={canvasRef} class="ghost-canvas" style={{ borderRadius: style.borderRadius }} />
        <span class="ghost-badge">イメージ</span>
      </div>
    </>
  );
}
