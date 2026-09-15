import { useEffect, useMemo, useRef } from 'preact/hooks';
import { auditHoverSelectors, auditRuleCheckRequest, htmlAuditRecords, lens, nextSpotNumber, selectedSpotId, spaceHeld, updateBoard } from '../state';
import { containRect, clampRect, type FitResult } from '../lib/geometry';
import { useBoxSize } from '../lib/useBoxSize';
import { useBoardKeys } from '../lib/useBoardKeys';
import { attachPicker, readComputed, uniqueSelector } from '../lib/domPick';
import { spotsToCss } from '../lib/htmlCss';
import { collectElementRecords, findRuleDeviations } from '../lib/audit';
import { SpotRect } from './SpotRect';
import { LensToggle } from './LensToggle';
import { Palette } from './Palette';
import type { Board, ElementRef, Note, Page, PageSource, Rect, Spot } from '../schema';

// ponytail: 枠の再同期をこの差以上のときだけ行う。0.002は目安、実機で不自然なら調整する
const RECT_RESYNC_THRESHOLD = 0.002;

function buildFrameHtml(source: PageSource): string {
  const csp = source.allowExternal
    ? "default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:; media-src data: https:; connect-src 'none'"
    : "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'";
  // CSPメタは先頭でも動くが、#uic-previewは既存の<style>と同じ詳細度のとき「後勝ち」させたいので</head>直前に置く
  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
  const overrides = `<style id="uic-preview"></style><style id="uic-hover"></style><style id="uic-audit-hover"></style>`;
  if (/<\/head>/i.test(source.html)) {
    return source.html.replace(/<head[^>]*>/i, (m) => `${m}${meta}`).replace(/<\/head>/i, `${overrides}</head>`);
  }
  if (/<html[^>]*>/i.test(source.html)) return source.html.replace(/<html[^>]*>/i, (m) => `${m}<head>${meta}${overrides}</head>`);
  return `<head>${meta}${overrides}</head>${source.html}`;
}

export function HtmlBoard({ board, page, fit }: { board: Board; page: Page; fit: FitResult }) {
  const source = page.source!;
  const [containerRef, boxSize] = useBoxSize<HTMLDivElement>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameHtml = useMemo(() => buildFrameHtml(source), [source.html, source.allowExternal]);
  const showingBefore = spaceHeld.value || lens.value === 'before';
  const handlePickRef = useRef<(el: Element) => void>(() => {});
  const pickerCleanupRef = useRef<(() => void) | null>(null);

  useBoardKeys();

  useEffect(() => {
    return () => {
      pickerCleanupRef.current?.();
      pickerCleanupRef.current = null;
      htmlAuditRecords.value = null;
      auditHoverSelectors.value = null;
    };
  }, []);

  // クリック時に呼ぶ処理を常に最新の board/page に保つ(iframeの再読み込みなしにノートだけ変わることが多いため)
  useEffect(() => {
    handlePickRef.current = (el: Element) => {
      const existing = findSpotBySelector(uniqueSelector(el));
      if (existing) {
        selectedSpotId.value = existing.id;
        return;
      }
      const spot = createSpotForElement(el, nextSpotNumber(board));
      updateBoard((b) => ({ ...b, spots: [...b.spots, spot] }));
      selectedSpotId.value = spot.id;
    };
  });

  function findSpotBySelector(selector: string): Spot | undefined {
    return board.spots.find((s) => s.pageId === page.id && s.element?.selector === selector);
  }

  function createSpotForElement(el: Element, n: number): Spot {
    const selector = uniqueSelector(el);
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
    return { id: crypto.randomUUID(), pageId: page.id, n, label, rect, keep: false, notes: [], element };
  }

  function enableExternalResources() {
    updateBoard((b) => ({
      ...b,
      pages: b.pages.map((p) => (
        p.id === page.id && p.source
          ? { ...p, source: { ...p.source, allowExternal: true } }
          : p
      )),
    }));
  }

  // R1-c: 「ルールで校正する」。ルールの段から外れた要素を面積の大きい順に最大12個、箇所にして「ルール」ノートを付ける
  useEffect(() => {
    if (!auditRuleCheckRequest.value) return;
    auditRuleCheckRequest.value = false;
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const records = collectElementRecords(doc);
    const deviations = findRuleDeviations(records, board.rules);
    updateBoard((b) => {
      let spots = b.spots.filter((s) => s.pageId === page.id);
      const rest = b.spots.filter((s) => s.pageId !== page.id);
      let nextN = nextSpotNumber(b);
      for (const dev of deviations) {
        let spot = spots.find((s) => s.element?.selector === dev.selector);
        if (!spot) {
          const el = doc.querySelector(dev.selector);
          if (!el) continue;
          spot = createSpotForElement(el, nextN++);
          spots = [...spots, spot];
        }
        if (spot.notes.some((n) => n.kind === 'rule' && n.ruleRef === dev.ruleRef)) continue;
        const note: Note = { id: crypto.randomUUID(), kind: 'rule', ruleRef: dev.ruleRef };
        spots = spots.map((s) => (s.id === spot!.id ? { ...s, notes: [...s.notes, note] } : s));
      }
      return { ...b, spots: [...rest, ...spots] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditRuleCheckRequest.value]);

  async function onFrameLoad() {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    await doc.fonts?.ready?.catch(() => {});

    // scrollHeightはiframe自身の高さを下限として返すため、計測中だけ高さを変えて中身の実高さを取る。
    // overflow指定のないアプリ画面(100dvh)は高さ0で潰れて記録されるため、viewport高さでの計測も併せて大きい方を採る
    const prevHeight = iframe.style.height;
    iframe.style.height = '0px';
    const height0 = doc.documentElement.scrollHeight;
    const viewportHeight = source.capture?.viewportHeight ?? 800;
    iframe.style.height = `${viewportHeight}px`;
    const heightAtViewport = doc.body?.scrollHeight ?? 0;
    const height = Math.max(height0, heightAtViewport);
    iframe.style.height = `${height}px`;

    const rectUpdates = new Map<string, Rect>();
    for (const spot of board.spots) {
      if (spot.pageId !== page.id || !spot.element) continue;
      const el = doc.querySelector(spot.element.selector);
      if (!el) continue;
      const box = el.getBoundingClientRect();
      const rect = clampRect({ x: box.x / source.width, y: box.y / height, w: box.width / source.width, h: box.height / height });
      const diff = Math.abs(rect.x - spot.rect.x) + Math.abs(rect.y - spot.rect.y) + Math.abs(rect.w - spot.rect.w) + Math.abs(rect.h - spot.rect.h);
      if (diff > RECT_RESYNC_THRESHOLD) rectUpdates.set(spot.id, rect);
    }

    const heightChanged = height > 0 && Math.abs(height - source.height) > 1;
    if (heightChanged || rectUpdates.size > 0) {
      updateBoard((b) => ({
        ...b,
        pages: b.pages.map((p) => (p.id === page.id && p.source ? { ...p, source: { ...p.source, height } } : p)),
        spots: b.spots.map((s) => (rectUpdates.has(s.id) ? { ...s, rect: rectUpdates.get(s.id)! } : s)),
      }));
    } else {
      iframe.style.height = prevHeight;
    }

    pickerCleanupRef.current?.();
    pickerCleanupRef.current = attachPicker(doc, (el) => handlePickRef.current(el));
    htmlAuditRecords.value = collectElementRecords(doc);
  }

  // R1-c: 診断の値にホバーすると、該当要素をiframe内で朱の点線で囲む
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    const styleEl = doc?.getElementById('uic-audit-hover') as HTMLStyleElement | null;
    if (!styleEl) return;
    const selectors = auditHoverSelectors.value;
    styleEl.textContent = selectors ? selectors.map((s) => `${s} { outline: 2px dashed #E4572E !important; outline-offset: -2px; }`).join('\n') : '';
  }, [auditHoverSelectors.value]);

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
    <div class="board-surface html-board-surface" ref={containerRef} style={{ width: fit.width, height: fit.height }}>
      {source.origin && !source.allowExternal && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: '8px',
            top: '8px',
            zIndex: 7,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: 'calc(100% - 110px)',
            padding: '6px 8px',
            background: 'rgba(255, 254, 249, .96)',
            border: '1px solid var(--line)',
            fontSize: '10px',
            lineHeight: 1.4,
          }}
        >
          <span>元サイトのCSS・画像・フォントを停止中</span>
          <button class="btn-sm" onClick={enableExternalResources}>許可して再描画</button>
        </div>
      )}
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
      {(() => {
        const spot = board.spots.find((s) => s.id === selectedSpotId.value && s.pageId === page.id);
        return spot ? <Palette board={board} spot={spot} cr={cr} /> : null;
      })()}
    </div>
  );
}
