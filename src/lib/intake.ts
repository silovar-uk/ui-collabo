import { activePageId, createBoard, currentBoard, updateBoard } from '../state';
import { fileToImage } from './image';
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
  updateBoard((b) => ({ ...b, pages: [...b.pages, ...pages] }));
  activePageId.value = pages[0].id;
}
