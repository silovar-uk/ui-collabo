const REMOVE_TAGS = ['script', 'iframe', 'object', 'embed'];

/** 取り込んだHTMLから script/iframe 等と on* 属性、javascript: URLを除去する。DOMParserはスクリプトを実行しない。 */
export function sanitizeHtml(raw: string): { html: string; title?: string } {
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  doc.querySelectorAll(REMOVE_TAGS.join(',')).forEach((el) => el.remove());

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
  return { html: doc.documentElement.outerHTML, title };
}
