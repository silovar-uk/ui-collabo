import { rgbStringToHex } from './color';
import type { ComputedKey } from '../schema';

const HOVER_COLOR = '#E4572E';
const MAX_ANCESTOR_DEPTH = 5;

function isValidIdent(s: string): boolean {
  return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(s);
}

function safeCount(doc: Document, selector: string): number {
  try {
    return doc.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

/** タグ名+単独classで一意になる候補を探す(複数classがあれば1つずつ試す)。 */
function tagWithClassSelector(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  for (const cls of Array.from(el.classList)) {
    if (!cls || !isValidIdent(cls)) continue;
    const sel = `${tag}.${CSS.escape(cls)}`;
    if (safeCount(el.ownerDocument, sel) === 1) return sel;
  }
  return null;
}

function nthChildSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const parent = el.parentElement;
  if (!parent) return tag;
  const index = Array.from(parent.children).indexOf(el) + 1;
  return `${tag}:nth-child(${index})`;
}

/** 一意なCSSセレクタを組み立てる: id → タグ+class → 祖先を辿った合成(最後の手段はnth-child)。 */
export function uniqueSelector(el: Element): string {
  const doc = el.ownerDocument;

  if (el.id && isValidIdent(el.id)) {
    const sel = `#${CSS.escape(el.id)}`;
    if (safeCount(doc, sel) === 1) return sel;
  }

  const withClass = tagWithClassSelector(el);
  if (withClass) return withClass;

  const parts: string[] = [];
  let cur: Element | null = el;
  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && cur && cur !== doc.documentElement; depth++) {
    parts.unshift(tagWithClassSelector(cur) ?? nthChildSelector(cur));
    const candidate = parts.join(' > ');
    if (safeCount(doc, candidate) === 1) return candidate;
    cur = cur.parentElement;
  }

  // 最後の手段: 全階層 nth-child の完全パス
  const fullParts: string[] = [];
  cur = el;
  while (cur && cur !== doc.documentElement) {
    fullParts.unshift(nthChildSelector(cur));
    cur = cur.parentElement;
  }
  return fullParts.join(' > ');
}

const COMPUTED_PROP: Record<ComputedKey, string> = {
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'font-family': 'fontFamily',
  color: 'color',
  'background-color': 'backgroundColor',
  'border-color': 'borderTopColor',
  margin: 'marginTop',
  padding: 'paddingTop',
  'border-radius': 'borderTopLeftRadius',
  'border-width': 'borderTopWidth',
};

const COLOR_KEYS: ComputedKey[] = ['color', 'background-color', 'border-color'];

/** 要素の実測CSS値を読む。色は rgb(...) を hex に正規化する。 */
export function readComputed(el: Element): Partial<Record<ComputedKey, string>> {
  const view = el.ownerDocument.defaultView;
  if (!view) return {};
  const cs = view.getComputedStyle(el);
  const out: Partial<Record<ComputedKey, string>> = {};
  for (const key of Object.keys(COMPUTED_PROP) as ComputedKey[]) {
    const raw = cs[COMPUTED_PROP[key] as keyof CSSStyleDeclaration] as string;
    if (!raw) continue;
    out[key] = COLOR_KEYS.includes(key) ? (rgbStringToHex(raw) ?? raw) : raw;
  }
  return out;
}

/**
 * ドキュメント上で要素の選択を待ち受ける。ホバーで枠線を、クリックで onPick を呼ぶ。
 * html/body はクリック対象から除外する。戻り値でリスナーを外す。
 */
export function attachPicker(doc: Document, onPick: (el: Element) => void): () => void {
  function isPickable(el: Element | null): el is Element {
    return !!el && el !== doc.documentElement && el !== doc.body;
  }

  function hoverStyle(): HTMLStyleElement | null {
    return doc.getElementById('uic-hover') as HTMLStyleElement | null;
  }

  function onMouseOver(e: MouseEvent) {
    const style = hoverStyle();
    if (!style) return;
    const el = e.target as Element;
    style.textContent = isPickable(el) ? `${uniqueSelector(el)} { outline: 2px solid ${HOVER_COLOR} !important; outline-offset: -2px; }` : '';
  }

  function onClick(e: MouseEvent) {
    const el = e.target as Element;
    if (!isPickable(el)) return;
    e.preventDefault();
    onPick(el);
  }

  doc.addEventListener('mouseover', onMouseOver);
  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('mouseover', onMouseOver);
    doc.removeEventListener('click', onClick, true);
    const style = hoverStyle();
    if (style) style.textContent = '';
  };
}
