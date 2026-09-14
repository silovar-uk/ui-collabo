import { describe, expect, it } from 'vitest';
import source from '../public/bookmarklet.js?raw';

describe('bookmarklet capture contract', () => {
  it('flattening後に壊れる行コメントを含めない', () => {
    expect(source).not.toMatch(/(^|\n)\s*\/\//);
  });

  it('stylesheet由来のurlと主要resource属性を正規化する', () => {
    expect(source).toContain('cssUrls(r.cssText, base)');
    expect(source).toContain("'[src], [href], [poster]'");
    expect(source).toContain("'[srcset]'");
    expect(source).toContain("'[style]'");
  });

  it('fragment・data・blob URLを絶対化対象から外す', () => {
    expect(source).toContain('data:|blob:|javascript:|mailto:|tel:');
    expect(source).toContain('(?:#|data:');
  });
});
