/** 貼り付け/ファイル/ブックマークレット経由のHTMLを、表示可能な安全な形にする。 */
export function sanitizeHtml(raw: string): { html: string; title?: string; origin?: string } {
  const doc = new DOMParser().parseFromString(raw, 'text/html');

  const origin = doc.querySelector('meta[name="uic-origin"]')?.getAttribute('content') ?? undefined;

  doc.querySelectorAll('script, iframe, object, embed').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if ((name === 'href' || name === 'src' || name === 'action') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  });

  const title = doc.querySelector('title')?.textContent?.trim() || undefined;
  return { html: doc.documentElement.outerHTML, title, origin };
}
