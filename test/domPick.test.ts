// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { uniqueSelector } from '../src/lib/domPick';

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('uniqueSelector', () => {
  it('idがあればidを優先する', () => {
    const doc = parse('<body><h1 id="title" class="big">見出し</h1></body>');
    const el = doc.getElementById('title')!;
    expect(uniqueSelector(el)).toBe('#title');
  });

  it('idがなければタグ+単独classで一意にする', () => {
    const doc = parse('<body><h1 class="hero-title">A</h1><h1 class="other">B</h1></body>');
    const el = doc.querySelector('.hero-title')!;
    expect(uniqueSelector(el)).toBe('h1.hero-title');
  });

  it('classが重複して一意にならない場合はnth-childの完全パスへフォールバックする', () => {
    const doc = parse('<body><div class="card"><p class="text">A</p></div><div class="card"><p class="text">B</p></div></body>');
    const target = doc.querySelectorAll('.text')[1];
    const selector = uniqueSelector(target);
    expect(doc.querySelectorAll(selector).length).toBe(1);
    expect(doc.querySelectorAll(selector)[0]).toBe(target);
    expect(selector).toContain(':nth-child');
  });
});
