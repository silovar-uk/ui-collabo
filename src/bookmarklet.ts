import source from '../public/bookmarklet.js?raw';

/** 取り込みダイアログの「ページを取り込む」リンクのhrefに使う javascript: URL。 */
export const BOOKMARKLET_URL = `javascript:${source}`;
