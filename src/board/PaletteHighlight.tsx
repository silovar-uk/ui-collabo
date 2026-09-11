import { useEffect, useRef } from 'preact/hooks';
import { buildHighlightMask } from '../lib/highlightMask';
import type { ContainRect } from '../lib/geometry';
import type { Page } from '../schema';

/** R1-b: 色見本にホバーすると、その色が使われている画素をボード上で朱に点滅させる。 */
export function PaletteHighlight({ page, cr, hex }: { page: Page; cr: ContainRect; hex: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = page.image;
    if (!canvas || !img) return;
    const el = new Image();
    el.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(el, 0, 0, img.width, img.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      imageData.data.set(buildHighlightMask(imageData.data, hex));
      ctx.putImageData(imageData, 0, 0);
    };
    el.src = img.dataUrl;
  }, [page.image?.dataUrl, hex]);

  return <canvas ref={canvasRef} class="palette-highlight-canvas" style={{ left: cr.left, top: cr.top, width: cr.width, height: cr.height }} />;
}
