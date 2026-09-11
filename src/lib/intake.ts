import { activePageId, createBoard, currentBoard, updateBoard } from '../state';
import { fileToImage } from './image';
import { sanitizeHtml } from './html';
import type { Page } from '../schema';

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
  // H4: 画像を初めて受け取ったボードはimageRole='draft'で始める(あとから切替可能)
  updateBoard((b) => ({ ...b, imageRole: b.imageRole ?? 'draft', pages: [...b.pages, ...pages] }));
  activePageId.value = pages[0].id;
}

/** HTMLをページとしてボードに取り込む。ボードがなければ新規作成する。 */
export async function handleHtml(rawHtml: string, opts: { origin?: string; allowExternal: boolean }): Promise<void> {
  const { html, title, origin } = sanitizeHtml(rawHtml);
  const isNewBoard = !currentBoard.value;
  if (isNewBoard) createBoard({ kind: 'web' });
  const page: Page = {
    id: crypto.randomUUID(),
    image: null,
    source: {
      kind: 'html',
      html,
      title,
      origin: opts.origin || origin,
      allowExternal: opts.allowExternal,
      width: 1280,
      height: 800,
    },
  };
  updateBoard((b) => ({
    ...b,
    title: isNewBoard && title ? title : b.title,
    imageRole: 'draft',
    pages: [...b.pages, page],
  }));
  activePageId.value = page.id;
}
