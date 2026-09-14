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

export async function handleFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  const pages = await filesToPages(files);
  if (!currentBoard.value) createBoard({ kind: 'web' });
  updateBoard((b) => ({ ...b, imageRole: b.imageRole ?? 'draft', pages: [...b.pages, ...pages] }));
  activePageId.value = pages[0].id;
}

export async function handleHtml(rawHtml: string, opts: { origin?: string; allowExternal: boolean }): Promise<void> {
  const { html, title, origin, viewportWidth, viewportHeight, devicePixelRatio } = sanitizeHtml(rawHtml, opts.origin);
  const isNewBoard = !currentBoard.value;
  if (isNewBoard) createBoard({ kind: 'web' });

  const width = viewportWidth ?? 1280;
  const height = viewportHeight ?? 800;
  const page: Page = {
    id: crypto.randomUUID(),
    image: null,
    source: {
      kind: 'html',
      html,
      title,
      origin,
      allowExternal: opts.allowExternal,
      width,
      height,
      capture: viewportWidth && viewportHeight ? { viewportWidth, viewportHeight, devicePixelRatio } : undefined,
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
