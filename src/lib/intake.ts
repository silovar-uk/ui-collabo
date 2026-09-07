import { activePageId, createBoard, currentBoard, updateBoard } from '../state';
import { fileToImage } from './image';
import { sanitizeHtml } from './html';
import type { Page, PageSource } from '../schema';

const DEFAULT_HTML_WIDTH = 1280;
const DEFAULT_HTML_HEIGHT = 800;

async function filesToPages(files: File[]): Promise<Page[]> {
  const pages: Page[] = [];
  for (const file of files) {
    const img = await fileToImage(file);
    pages.push({ id: crypto.randomUUID(), image: img });
  }
  return pages;
}

/** 画像ファイルをページとしてボードに取り込む。ボードがなければ新規作成する。 */
export async function handleFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  const pages = await filesToPages(files);
  if (!currentBoard.value) createBoard({ kind: 'web' });
  updateBoard((b) => ({ ...b, pages: [...b.pages, ...pages] }));
  activePageId.value = pages[0].id;
}

/** HTMLソースをページとして取り込む。<script>等を除去し、常に「直したいもの」として扱う。 */
export async function handleHtml(html: string, opts: { origin?: string; useBase: boolean }): Promise<void> {
  const { html: sanitized, title } = sanitizeHtml(html);
  const source: PageSource = {
    kind: 'html',
    html: sanitized,
    title,
    origin: opts.origin,
    useBase: opts.useBase,
    width: DEFAULT_HTML_WIDTH,
    height: DEFAULT_HTML_HEIGHT,
  };
  const page: Page = { id: crypto.randomUUID(), image: null, source };
  if (!currentBoard.value) createBoard({ kind: 'web' });
  updateBoard((b) => ({
    ...b,
    title: b.title === '無題のボード' && title ? title : b.title,
    imageRole: 'draft',
    pages: [...b.pages, page],
  }));
  activePageId.value = page.id;
}
