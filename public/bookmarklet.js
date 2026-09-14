(async () => {
  const skip = (u) => !u || /^\s*(?:#|data:|blob:|javascript:|mailto:|tel:)/i.test(u);
  const abs = (u, base = location.href) => {
    if (skip(u)) return u;
    try { return new URL(u, base).href; } catch { return u; }
  };
  const cssUrls = (text, base) => text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (full, quote, raw) => {
    const value = raw.trim();
    if (/^javascript:/i.test(value)) return 'url("")';
    const next = abs(value, base);
    if (next === value) return full;
    return `url(${quote || '"'}${next}${quote || '"'})`;
  });
  const srcset = (value) => {
    if (!value || /^\s*data:/i.test(value)) return value;
    return value.split(',').map((candidate) => {
      const match = candidate.trim().match(/^(\S+)(\s+.+)?$/);
      return match ? `${abs(match[1])}${match[2] || ''}` : candidate.trim();
    }).join(', ');
  };

  /* 適用中のCSSをすべて文字列にする。各stylesheetの相対url()は、そのstylesheet自身を基準に絶対URL化する。 */
  const css = [...document.styleSheets].map((s) => {
    const base = s.href || location.href;
    try { return [...s.cssRules].map((r) => cssUrls(r.cssText, base)).join('\n'); }
    catch { return s.href ? `@import url("${abs(s.href)}");` : ''; }
  }).join('\n');

  const root = document.documentElement.cloneNode(true);
  root.querySelectorAll('script, iframe, object, embed, base, link[rel~="stylesheet"], style').forEach((e) => e.remove());
  root.querySelectorAll('[src], [href], [poster]').forEach((e) => {
    for (const a of ['src', 'href', 'poster']) if (e.hasAttribute(a)) e.setAttribute(a, abs(e.getAttribute(a)));
  });
  root.querySelectorAll('[srcset]').forEach((e) => {
    e.setAttribute('srcset', srcset(e.getAttribute('srcset')));
  });
  root.querySelectorAll('[style]').forEach((e) => {
    e.setAttribute('style', cssUrls(e.getAttribute('style') || '', location.href));
  });

  const head = root.querySelector('head') || root;
  const style = document.createElement('style');
  style.textContent = css;
  head.appendChild(style);

  const meta = document.createElement('meta');
  meta.setAttribute('name', 'uic-origin');
  meta.setAttribute('content', location.href);
  head.prepend(meta);

  const out = '<!doctype html>\n' + root.outerHTML;
  let copied = false;
  try {
    await navigator.clipboard.writeText(out);
    copied = true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = out;
    document.body.appendChild(ta);
    ta.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    ta.remove();
  }
  if (copied) {
    alert(`UI ColLabo: ${Math.round(out.length / 1024)} KB をコピーしました`);
  } else {
    /* 両方の方法が失敗した場合(Permissions-Policyでクリップボード禁止など)は
       「コピーできた」と偽らずpromptの選択済みテキストを手動コピーしてもらう */
    prompt('自動コピーに失敗しました。この内容を選択(Ctrl+A)してコピー(Ctrl+C)してください:', out);
  }
})();
