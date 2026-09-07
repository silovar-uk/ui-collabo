// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { uniqueSelector } from '../src/lib/domPick';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('uniqueSelector', () => {
  it('idがあればidを使う', () => {
    const doc = parse('<body><h1 id="title">見出し</h1></body>');
    const el = doc.getElementById('title')!;
    expect(uniqueSelector(el)).toBe('#title');
  });

  it('idがなくクラスで一意ならタグ+クラスを使う', () => {
    const doc = parse('<body><div class="hero"><h1 class="title">見出し</h1></div></body>');
    const el = doc.querySelector('h1.title')!;
    expect(uniqueSelector(el)).toBe('h1.title');
  });

  it('タグ+クラスでも一意にならない場合は祖先を辿って合成する', () => {
    const doc = parse(`
      <body>
        <div class="card"><p class="text">A</p></div>
        <div class="card"><p class="text">B</p></div>
      </body>
    `);
    const els = doc.querySelectorAll('p.text');
    const selector = uniqueSelector(els[1]);
    expect(doc.querySelectorAll(selector)).toHaveLength(1);
    expect(doc.querySelector(selector)?.textContent?.trim()).toBe('B');
  });

  it('クラスもidもない場合はnth-childにフォールバックする', () => {
    const doc = parse('<body><ul><li>1</li><li>2</li><li>3</li></ul></body>');
    const el = doc.querySelectorAll('li')[2];
    const selector = uniqueSelector(el);
    expect(doc.querySelectorAll(selector)).toHaveLength(1);
    expect(doc.querySelector(selector)?.textContent).toBe('3');
  });
});
