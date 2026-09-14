// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isUiCollaboCapture, rebaseCssUrls, sanitizeHtml } from '../src/lib/html';

describe('HTML intake reliability', () => {
  it('UI ColLabo captureをuic-originで検出する', () => {
    expect(isUiCollaboCapture('<html><head><meta name="uic-origin" content="https://example.com/page"></head></html>')).toBe(true);
    expect(isUiCollaboCapture('<html><head></head><body>plain</body></html>')).toBe(false);
  });

  it('元URLを基準に相対リソースを絶対URLへ直す', () => {
    const raw = `<!doctype html>
      <html>
        <head>
          <meta name="uic-origin" content="https://example.com/dir/page.html">
          <base href="https://evil.example/">
          <link rel="stylesheet" href="./css/main.css">
          <style>@import "./css/extra.css"; .hero{background-image:url('../img/bg.png')}</style>
        </head>
        <body>
          <img src="./img/a.png" srcset="./img/a.png 1x, ./img/a@2x.png 2x">
          <video poster="../video/poster.jpg"></video>
          <div style="background:url('./img/inline.png')"></div>
          <a href="#section">jump</a>
        </body>
      </html>`;

    const result = sanitizeHtml(raw);
    const doc = new DOMParser().parseFromString(result.html, 'text/html');

    expect(result.origin).toBe('https://example.com/dir/page.html');
    expect(doc.querySelector('base')).toBeNull();
    expect(doc.querySelector('link')?.getAttribute('href')).toBe('https://example.com/dir/css/main.css');
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://example.com/dir/img/a.png');
    expect(doc.querySelector('img')?.getAttribute('srcset')).toBe('https://example.com/dir/img/a.png 1x, https://example.com/dir/img/a@2x.png 2x');
    expect(doc.querySelector('video')?.getAttribute('poster')).toBe('https://example.com/video/poster.jpg');
    expect(doc.querySelector('div')?.getAttribute('style')).toContain('https://example.com/dir/img/inline.png');
    expect(doc.querySelector('style')?.textContent).toContain('https://example.com/img/bg.png');
    expect(doc.querySelector('style')?.textContent).toContain('https://example.com/dir/css/extra.css');
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('#section');
  });

  it('明示した元URLを埋め込みoriginより優先する', () => {
    const raw = '<meta name="uic-origin" content="https://old.example/a/"><img src="./x.png">';
    const result = sanitizeHtml(raw, 'https://new.example/b/page.html');
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    expect(result.origin).toBe('https://new.example/b/page.html');
    expect(doc.querySelector('img')?.getAttribute('src')).toBe('https://new.example/b/x.png');
  });

  it('script・iframe・イベント属性・javascript URLを除去する', () => {
    const result = sanitizeHtml(`
      <html><body>
        <script>alert(1)</script>
        <iframe src="https://example.com"></iframe>
        <button onclick="alert(1)">x</button>
        <a href="javascript:alert(1)">x</a>
        <div style="background:url(javascript:alert(1))"></div>
      </body></html>
    `, 'https://example.com/');
    const doc = new DOMParser().parseFromString(result.html, 'text/html');

    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('iframe')).toBeNull();
    expect(doc.querySelector('button')?.hasAttribute('onclick')).toBe(false);
    expect(doc.querySelector('a')?.hasAttribute('href')).toBe(false);
    expect(doc.querySelector('div')?.getAttribute('style')).not.toContain('javascript:');
  });

  it('取り込み元のCSPとmeta refreshを捨て、preview側の制御を優先する', () => {
    const result = sanitizeHtml(`
      <html><head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'">
        <meta http-equiv="refresh" content="0;url=https://example.org/away">
      </head><body>safe</body></html>
    `);
    const doc = new DOMParser().parseFromString(result.html, 'text/html');
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')).toBeNull();
    expect(doc.querySelector('meta[http-equiv="refresh"]')).toBeNull();
  });

  it('CSS url()はdata/blob/fragmentを壊さず相対URLだけ直す', () => {
    const css = rebaseCssUrls(
      `.a{background:url(../a.png)} .b{background:url("data:image/png;base64,aaa")} .c{mask:url(#mask)} .d{background:url(blob:https://example.com/id)}`,
      'https://example.com/css/main.css',
    );
    expect(css).toContain('https://example.com/a.png');
    expect(css).toContain('data:image/png;base64,aaa');
    expect(css).toContain('url(#mask)');
    expect(css).toContain('blob:https://example.com/id');
  });
});
