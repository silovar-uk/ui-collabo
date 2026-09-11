import { useEffect, useRef, useState } from 'preact/hooks';
import { lens, nextSpotNumber, selectedSpotId, spaceHeld, updateBoard } from '../state';
import { containRect, clampRect } from '../lib/geometry';
import { useBoxSize } from '../lib/useBoxSize';
import { useBoardKeys } from '../lib/useBoardKeys';
import { attachPicker, readComputed, uniqueSelector } from '../lib/domPick';
import { spotsToCss } from '../lib/htmlCss';
import { SpotRect } from './SpotRect';
import { LensToggle } from './LensToggle';
import type { Board, ElementRef, Page, PageSource, Spot } from '../schema';

function buildFrameHtml(source: PageSource): string {
  const csp = source.allowExternal
    ? "default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:"
    : "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";
  // CSPメタは先頭でも動くが、#uic-previewは既存の<style>と同じ詳細度のとき「後勝ち」させたいので</head>直前に置く
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const overrides = `<style id="uic-preview"></style><style id="uic-hover"></style>`;
  if (/<\/head>/i.test(source.html)) {
    return source.html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`).replace(/<\/head>/i, `${overrides}</head>`);
  }
  if (/<html[^>]*>/i.test(source.html)) return source.html.replace(/<html[^>]*>/i, (m) => `${m}<head>${meta}${overrides}</head>`);
  return `<head>${meta}${overrides}</head>${source.html}`;
}

export function HtmlBoard({ board, page }: { board: Board; page: Page }) {
  const source = page.source!;
  const [containerRef, boxSize] = useBoxSize<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [frameHtml] = useState(() => buildFrameHtml(source));
  const showingBefore = spaceHeld.value || lens.value === 'before';
  const handlePickRef = useRef<(el: Element) => void>(() => {});

  useBoardKeys();

  // クリック時に呼ぶ処理を常に最新の board/page に保つ(iframeの再読み込みなしにノートだけ変わることが多いため)
  useEffect(() => {
    handlePickRef.current = (el: Element) => {
      const selector = uniqueSelector(el);
      const pageSpots = board.spots.filter((s) => s.pageId === page.id);
      const existing = pageSpots.find((s) => s.element?.selector === selector);
      if (existing) {
        selectedSpotId.value = existing.id;
        return;
      }
      const computed = readComputed(el);
      const box = el.getBoundingClientRect();
      const rect = clampRect({
        x: box.x / source.width,
        y: box.y / source.height,
        w: box.width / source.width,
        h: box.height / source.height,
      });
      const text = (el.textContent ?? '').trim().slice(0, 40) || undefined;
      const label = text ? text.slice(0, 20) : el.tagName.toLowerCase();
      const element: ElementRef = { selector, tag: el.tagName.toLowerCase(), text, computed };
      const n = nextSpotNumber(board);
      const spot: Spot = { id: crypto.randomUUID(), pageId: page.id, n, label, rect, keep: false, notes: [], element };
      updateBoard((b) => ({ ...b, spots: [...b.spots, spot] }));
      selectedSpotId.value = spot.id;
    };
  });

  function onFrameLoad() {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    // scrollHeightはiframe自身の高さを下限として返すため、計測中だけ0に潰して実際の中身の高さを取る
    const prevHeight = iframe.style.height;
    iframe.style.height = '0px';
    const height = doc.documentElement.scrollHeight;
    iframe.style.height = prevHeight;
    if (height > 0 && Math.abs(height - source.height) > 1) {
      updateBoard((b) => ({
        ...b,
        pages: b.pages.map((p) => (p.id === page.id && p.source ? { ...p, source: { ...p.source, height } } : p)),
      }));
    }
    attachPicker(doc, (el) => handlePickRef.current(el));
  }

  // ノート(こうしたい)の反映。iframeの再読み込みはせず、中の<style>だけ書き換える
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    const styleEl = doc?.getElementById('uic-preview') as HTMLStyleElement | null;
    if (!styleEl) return;
    const spots = board.spots.filter((s) => s.pageId === page.id);
    styleEl.textContent = spotsToCss(spots);
    styleEl.disabled = showingBefore;
  });

  const cr = containRect(boxSize.width, boxSize.height, source.width, source.height);
  const scale = cr.width / source.width;

  return (
    <div class="board-surface html-board-surface" ref={containerRef} style={{ aspectRatio: `${source.width} / ${source.height}` }}>
      <iframe
        ref={iframeRef}
        class="html-frame"
        srcdoc={frameHtml}
        sandbox="allow-same-origin"
        onLoad={onFrameLoad}
        style={{ left: cr.left, top: cr.top, width: source.width, height: source.height, transform: `scale(${scale})` }}
      />
      <div class="html-frame-overlay">
        {board.spots
          .filter((s) => s.pageId === page.id)
          .map((spot) => (
            <SpotRect key={spot.id} spot={spot} cr={cr} selected={selectedSpotId.value === spot.id} onSelect={() => (selectedSpotId.value = spot.id)} />
          ))}
      </div>
      <LensToggle />
    </div>
  );
}
