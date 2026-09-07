import { useEffect, useRef, useState } from 'preact/hooks';
import { containRect, type ContainRect } from '../lib/geometry';
import { attachPicker, readComputed, uniqueSelector } from '../lib/domPick';
import { spotsToCss } from '../lib/htmlCss';
import { currentBoard, nextSpotNumber, selectedSpotId, updateBoard } from '../state';
import type { Page, PageSource, Spot } from '../schema';
import { SpotRect } from './SpotRect';

/** srcdoc用にHTMLを組み立てる。useBase時は<base>を注入し、反映用/ホバー用の空<style>を足す。 */
function buildFrameHtml(source: PageSource): string {
  const doc = new DOMParser().parseFromString(source.html, 'text/html');
  if (source.useBase && source.origin) {
    const base = doc.createElement('base');
    base.href = source.origin;
    doc.head.prepend(base);
  }
  const preview = doc.createElement('style');
  preview.id = 'uic-preview';
  doc.head.appendChild(preview);
  const hover = doc.createElement('style');
  hover.id = 'uic-hover';
  doc.head.appendChild(hover);
  return doc.documentElement.outerHTML;
}

export function HtmlBoard({ page, source }: { page: Page; source: PageSource }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const detachRef = useRef<(() => void) | null>(null);
  const [measuredHeight, setMeasuredHeight] = useState(source.height);
  const [showCurrent, setShowCurrent] = useState(false);
  const [, force] = useState(0);

  const frameHtml = buildFrameHtml(source);
  const board = currentBoard.value;
  const spots = board?.spots.filter((s) => s.pageId === page.id) ?? [];

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    function onLoad() {
      const doc = iframe!.contentDocument;
      if (!doc) return;
      // documentElement.scrollHeight は「html要素の高さ」で、CSS上は最低でもiframeのviewport高(=現在のheightスタイル)
      // までクランプされる仕様のため、コンテンツ本来の高さは body 側で測る。
      const h = doc.body?.scrollHeight || doc.documentElement.scrollHeight;
      if (h > 0 && h !== source.height) {
        setMeasuredHeight(h);
        updateBoard((b) => ({
          ...b,
          pages: b.pages.map((p) => (p.id === page.id && p.source ? { ...p, source: { ...p.source, height: h } } : p)),
        }));
      }
      detachRef.current?.();
      detachRef.current = attachPicker(doc, pickElement);
      force((n) => n + 1);
    }
    // srcdocのiframeはeffect実行前(React commit前)に読み込みを終えてloadイベントを取りこぼすことがあるため、
    // 既に読み込み済みなら即座に測定する。
    if (iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    } else {
      iframe.addEventListener('load', onLoad);
    }
    return () => {
      iframe.removeEventListener('load', onLoad);
      detachRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameHtml]);

  // ノートが変わるたびに反映用CSSを書き直す
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    const styleEl = doc?.getElementById('uic-preview') as HTMLStyleElement | null;
    if (!styleEl) return;
    styleEl.textContent = spotsToCss(spots);
    styleEl.disabled = showCurrent;
  });

  function pickElement(el: Element): void {
    const b = currentBoard.value;
    if (!b) return;
    const selector = uniqueSelector(el);
    const existing = b.spots.find((s) => s.pageId === page.id && s.element?.selector === selector);
    if (existing) {
      selectedSpotId.value = existing.id;
      return;
    }
    // 分母はiframeの論理サイズ(常にsource.width×measuredHeight)を使う。documentElementのscrollWidth/Height
    // はviewport高未満のコンテンツだとクランプされて実際のコンテンツ高より大きく出るため使わない。
    const r = el.getBoundingClientRect();
    const rect = { x: r.left / source.width, y: r.top / measuredHeight, w: r.width / source.width, h: r.height / measuredHeight };
    const text = el.textContent?.trim().replace(/\s+/g, ' ').slice(0, 40) || undefined;
    const spot: Spot = {
      id: crypto.randomUUID(),
      pageId: page.id,
      n: nextSpotNumber(b),
      label: text ? text.slice(0, 20) : el.tagName.toLowerCase(),
      rect,
      keep: false,
      notes: [],
      element: { selector, tag: el.tagName.toLowerCase(), text, computed: readComputed(el) },
    };
    updateBoard((cur) => ({ ...cur, spots: [...cur.spots, spot] }));
    selectedSpotId.value = spot.id;
  }

  const cr: ContainRect = containerRef.current
    ? containRect(containerRef.current.clientWidth, containerRef.current.clientHeight, source.width, measuredHeight)
    : { left: 0, top: 0, width: source.width, height: measuredHeight };
  const scale = source.width > 0 ? cr.width / source.width : 1;

  return (
    <div class="html-board">
      <div class="html-board-toolbar">
        <button class={`toggle${!showCurrent ? ' is-active' : ''}`} onClick={() => setShowCurrent(false)}>
          こうしたい
        </button>
        <button class={`toggle${showCurrent ? ' is-active' : ''}`} onClick={() => setShowCurrent(true)}>
          いま
        </button>
      </div>
      <div class="board-surface html-board-surface" ref={containerRef} style={{ aspectRatio: `${source.width} / ${measuredHeight}` }}>
        <iframe
          ref={iframeRef}
          class="html-frame"
          srcDoc={frameHtml}
          sandbox="allow-same-origin"
          style={{ width: `${source.width}px`, height: `${measuredHeight}px`, transform: `scale(${scale})` }}
        />
        <div class="html-board-overlay">
          {spots.map((spot) => (
            <SpotRect key={spot.id} spot={spot} cr={cr} selected={selectedSpotId.value === spot.id} onSelect={() => {}} />
          ))}
        </div>
      </div>
    </div>
  );
}
