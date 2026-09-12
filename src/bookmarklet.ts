import source from '../public/bookmarklet.js?raw';

// ブックマーク登録時に改行が失われるブラウザがあり、`//`行コメントだと
// 以降のコードごと1行に飲み込まれて構文エラーになる。改行依存をなくすため1行化する
const flattened = source.replace(/\s+/g, ' ').trim();

/** 取り込みダイアログの「ページを取り込む」リンクのhrefに使う javascript: URL。 */
export const BOOKMARKLET_URL = `javascript:${flattened}`;
