import type { ComputedKey } from '../schema';
import { rgbStringToHex } from './color';

const COMPUTED_KEYS: ComputedKey[] = [
  'font-size',
  'font-weight',
  'font-family',
  'color',
  'background-color',
  'border-color',
  'margin',
  'padding',
  'border-radius',
  'border-width',
];

const MAX_ANCESTOR_DEPTH = 5;

function isValidIdent(id: string): boolean {
  return /^[a-zA-Z][\w-]*$/.test(id);
}

function tagAndClassSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = el.classList[0];
  return cls ? `${tag}.${cls}` : tag;
}

/** doc内で一意なCSSセレクタを組み立てる。id → tag+class → 祖先パス → nth-childの完全パスの順で試す。 */
export function uniqueSelector(el: Element): string {
  const doc = el.ownerDocument;
  const unique = (sel: string): boolean => {
    try {
      return doc.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };

  if (el.id && isValidIdent(el.id)) {
    const sel = `#${el.id}`;
    if (unique(sel)) return sel;
  }

  const tag = el.tagName.toLowerCase();
  for (const c of Array.from(el.classList)) {
    const sel = `${tag}.${c}`;
    if (unique(sel)) return sel;
  }

  const parts: string[] = [];
  let node: Element | null = el;
  for (let depth = 0; depth < MAX_ANCESTOR_DEPTH && node && node !== doc.documentElement; depth++) {
    parts.unshift(tagAndClassSelector(node));
    const candidate = parts.join(' > ');
    if (unique(candidate)) return candidate;
    node = node.parentElement;
  }

  // 最後の手段: ルートまでの全階層に nth-child を付けた完全パス
  const fullParts: string[] = [];
  node = el;
  while (node && node !== doc.documentElement) {
    const parent: Element | null = node.parentElement;
    const index = parent ? Array.from(parent.children).indexOf(node) + 1 : 1;
    fullParts.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
    node = parent;
  }
  return fullParts.join(' > ');
}

/** getComputedStyle から実測値を読む。色は rgb(...) を #rrggbb に正規化する。 */
export function readComputed(el: Element): Partial<Record<ComputedKey, string>> {
  const view = el.ownerDocument.defaultView;
  if (!view) return {};
  const cs = view.getComputedStyle(el);
  const result: Partial<Record<ComputedKey, string>> = {};
  for (const key of COMPUTED_KEYS) {
    const raw = cs.getPropertyValue(key);
    if (!raw) continue;
    result[key] = /^rgba?\(/.test(raw) ? (rgbStringToHex(raw) ?? raw) : raw;
  }
  return result;
}

function isPickable(el: Element | null, doc: Document): el is Element {
  return !!el && el !== doc.documentElement && el !== doc.body;
}

/** iframe内のdocumentにホバー枠とクリック採取を付ける。戻り値でリスナーを外す。 */
export function attachPicker(doc: Document, onPick: (el: Element) => void): () => void {
  const hoverStyle = doc.getElementById('uic-hover') as HTMLStyleElement | null;

  function onMouseOver(e: MouseEvent) {
    const el = e.target as Element;
    if (!hoverStyle || !isPickable(el, doc)) return;
    hoverStyle.textContent = `${uniqueSelector(el)} { outline: 2px solid #E4572E !important; outline-offset: -2px; }`;
  }

  function onClick(e: MouseEvent) {
    const el = e.target as Element;
    e.preventDefault();
    if (!isPickable(el, doc)) return;
    onPick(el);
  }

  doc.addEventListener('mouseover', onMouseOver);
  doc.addEventListener('click', onClick, true);
  return () => {
    doc.removeEventListener('mouseover', onMouseOver);
    doc.removeEventListener('click', onClick, true);
    if (hoverStyle) hoverStyle.textContent = '';
  };
}
