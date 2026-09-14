const SKIP_ABSOLUTIZE_RE = /^\s*(?:#|data:|blob:|javascript:|mailto:|tel:)/i;

function absoluteUrl(value: string, baseUrl: string): string {
  if (!value.trim() || SKIP_ABSOLUTIZE_RE.test(value)) return value;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return value;
  }
}

/** CSS内の相対url()を、元のページ/stylesheetを基準に絶対URLへ直す。 */
export function rebaseCssUrls(css: string, baseUrl: string): string {
  return css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote: string, rawValue: string) => {
    const value = rawValue.trim();
    if (/^javascript:/i.test(value)) return 'url("")';
    const rebased = absoluteUrl(value, baseUrl);
    if (rebased === value) return full;
    const q = quote || '"';
    return `url(${q}${rebased}${q})`;
  });
}

function rebaseSrcset(value: string, baseUrl: string): string {
  // data URL はカンマを含むため、すでに自己完結しているsrcsetは触らない。
  if (/^\s*data:/i.test(value)) return value;
  return value
    .split(',')
    .map((candidate) => {
      const trimmed = candidate.trim();
      if (!trimmed) return trimmed;
      const match = trimmed.match(/^(\S+)(\s+.+)?$/);
      if (!match) return trimmed;
      return `${absoluteUrl(match[1], baseUrl)}${match[2] ?? ''}`;
    })
    .join(', ');
}

function normalizeResourceUrls(doc: Document, baseUrl: string): void {
  doc.querySelectorAll<HTMLElement>('[src]').forEach((el) => {
    const value = el.getAttribute('src');
    if (value) el.setAttribute('src', absoluteUrl(value, baseUrl));
  });
  doc.querySelectorAll<HTMLElement>('[poster]').forEach((el) => {
    const value = el.getAttribute('poster');
    if (value) el.setAttribute('poster', absoluteUrl(value, baseUrl));
  });
  doc.querySelectorAll<HTMLElement>('[srcset]').forEach((el) => {
    const value = el.getAttribute('srcset');
    if (value) el.setAttribute('srcset', rebaseSrcset(value, baseUrl));
  });
  doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]').forEach((el) => {
    const value = el.getAttribute('href');
    if (value) el.setAttribute('href', absoluteUrl(value, baseUrl));
  });
  doc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const value = el.getAttribute('style');
    if (value) el.setAttribute('style', rebaseCssUrls(value, baseUrl));
  });
  doc.querySelectorAll<HTMLStyleElement>('style').forEach((el) => {
    el.textContent = rebaseCssUrls(el.textContent ?? '', baseUrl);
  });
}

/** UI ColLaboのブックマークレットで採取したHTMLかを判定する。 */
export function isUiCollaboCapture(raw: string): boolean {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  return !!doc.querySelector('meta[name="uic-origin"][content]');
}

/** 貼り付け/ファイル/ブックマークレット経由のHTMLを、表示可能な安全な形にする。 */
export function sanitizeHtml(raw: string, explicitOrigin?: string): { html: string; title?: string; origin?: string } {
  const doc = new DOMParser().parseFromString(raw, 'text/html');

  const embeddedOrigin = doc.querySelector('meta[name="uic-origin"]')?.getAttribute('content') ?? undefined;
  const origin = explicitOrigin || embeddedOrigin;

  // 取り込み元のbase要素がUI ColLabo内のリンク解決を乗っ取らないよう除去し、
  // 必要なリソースURLはoriginを使って明示的に正規化する。
  doc.querySelectorAll('base').forEach((el) => el.remove());
  doc.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src' || name === 'action' || name === 'poster') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  if (origin) normalizeResourceUrls(doc, origin);

  const title = doc.querySelector('title')?.textContent?.trim() || undefined;
  return { html: doc.documentElement.outerHTML, title, origin };
}
