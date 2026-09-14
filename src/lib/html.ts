const SKIP_ABSOLUTIZE_RE = /^\s*(?:#|data:|blob:|javascript:|mailto:|tel:)/i;

function absoluteUrl(value: string, baseUrl: string): string {
  if (!value.trim() || SKIP_ABSOLUTIZE_RE.test(value)) return value;
  try { return new URL(value, baseUrl).href; } catch { return value; }
}

export function rebaseCssUrls(css: string, baseUrl: string): string {
  const rebasedUrls = css.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote: string, rawValue: string) => {
    const value = rawValue.trim();
    if (/^javascript:/i.test(value)) return 'url("")';
    const rebased = absoluteUrl(value, baseUrl);
    if (rebased === value) return full;
    const q = quote || '"';
    return `url(${q}${rebased}${q})`;
  });
  return rebasedUrls.replace(/@import\s+(["'])([^"']+)\1/gi, (full, quote: string, rawValue: string) => {
    const rebased = absoluteUrl(rawValue.trim(), baseUrl);
    return rebased === rawValue.trim() ? full : `@import ${quote}${rebased}${quote}`;
  });
}

function rebaseSrcset(value: string, baseUrl: string): string {
  if (/^\s*data:/i.test(value)) return value;
  return value.split(',').map((candidate) => {
    const trimmed = candidate.trim();
    if (!trimmed) return trimmed;
    const match = trimmed.match(/^(\S+)(\s+.+)?$/);
    if (!match) return trimmed;
    return `${absoluteUrl(match[1], baseUrl)}${match[2] ?? ''}`;
  }).join(', ');
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

function boundedMetaNumber(doc: Document, name: string, min: number, max: number): number | undefined {
  const raw = doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= min && value <= max ? value : undefined;
}

export interface HtmlCaptureMetadata {
  origin?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
}

export function readCaptureMetadata(doc: Document): HtmlCaptureMetadata {
  return {
    origin: doc.querySelector('meta[name="uic-origin"]')?.getAttribute('content') ?? undefined,
    viewportWidth: boundedMetaNumber(doc, 'uic-viewport-width', 240, 10000),
    viewportHeight: boundedMetaNumber(doc, 'uic-viewport-height', 240, 50000),
    devicePixelRatio: boundedMetaNumber(doc, 'uic-device-pixel-ratio', 0.5, 10),
  };
}

export function isUiCollaboCapture(raw: string): boolean {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  return !!doc.querySelector('meta[name="uic-origin"][content]');
}

export interface SanitizedHtml {
  html: string;
  title?: string;
  origin?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
}

export function sanitizeHtml(raw: string, explicitOrigin?: string): SanitizedHtml {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const capture = readCaptureMetadata(doc);
  const origin = explicitOrigin || capture.origin;

  doc.querySelectorAll('base').forEach((el) => el.remove());
  doc.querySelectorAll('meta[http-equiv]').forEach((el) => {
    const value = el.getAttribute('http-equiv')?.trim().toLowerCase();
    if (value === 'content-security-policy' || value === 'refresh') el.remove();
  });
  doc.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'src' || name === 'action' || name === 'poster') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name);
    }
  });

  if (origin) normalizeResourceUrls(doc, origin);
  const title = doc.querySelector('title')?.textContent?.trim() || undefined;
  return {
    html: doc.documentElement.outerHTML,
    title,
    origin,
    viewportWidth: capture.viewportWidth,
    viewportHeight: capture.viewportHeight,
    devicePixelRatio: capture.devicePixelRatio,
  };
}
