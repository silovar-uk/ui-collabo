(async () => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };

  // 適用中のCSSをすべて文字列にする。読めないシート(クロスオリジン)は @import で残す
  const css = [...document.styleSheets].map((s) => {
    try { return [...s.cssRules].map((r) => r.cssText).join('\n'); }
    catch { return s.href ? `@import url("${s.href}");` : ''; }
  }).join('\n');

  const root = document.documentElement.cloneNode(true);
  root.querySelectorAll('script, link[rel~="stylesheet"], style').forEach((e) => e.remove());
  root.querySelectorAll('[src], [href]').forEach((e) => {
    for (const a of ['src', 'href']) if (e.hasAttribute(a)) e.setAttribute(a, abs(e.getAttribute(a)));
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
  try {
    await navigator.clipboard.writeText(out);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = out;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  alert(`UI ColLabo: ${Math.round(out.length / 1024)} KB をコピーしました`);
})();
