import { boardToLines, boardToMarkdown, renderProofSheet } from '../export';
import { snapshotHtmlPage } from './htmlSnapshot';
import type { Board } from '../schema';

export interface HandoffManifest {
  prompt: string;
  imagePageIds: string[];
  htmlPageIds: string[];
  blankPageIds: string[];
}

export interface PreparedHandoffAsset {
  kind: 'proof-packet' | 'html-bundle';
  filename: string;
  blob: Blob;
}

export interface PreparedHandoff {
  prompt: string;
  assets: PreparedHandoffAsset[];
  warnings: string[];
  imagePageCount: number;
  htmlPageCount: number;
}

/** AIへ渡す前に、指示文と必要資産の対応を純粋データとして確定する。 */
export function buildHandoffManifest(board: Board): HandoffManifest {
  return {
    prompt: boardToMarkdown(board),
    imagePageIds: board.pages.filter((p) => !!p.image).map((p) => p.id),
    htmlPageIds: board.pages.filter((p) => !!p.source).map((p) => p.id),
    blankPageIds: board.pages.filter((p) => !p.image && !p.source).map((p) => p.id),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('画像の生成に失敗しました'))), 'image/png');
  });
}

/**
 * 複数ページの校正紙を、AIへ1回で添付できる1枚の縦長パケットへまとめる。
 * HTMLページはsnapshotHtmlPageで画像化してから同じ並びに含める。画像化できなかったページは
 * (失敗ページ数を呼び出し側へ返し、送り状に「画像にできませんでした」と出せるようにして)スキップする。
 */
async function renderProofPacket(board: Board): Promise<{ blob: Blob | null; failedHtmlPages: number }> {
  const lines = boardToLines(board);
  const sheets: { index: number; canvas: HTMLCanvasElement }[] = [];
  let failedHtmlPages = 0;

  for (const [index, page] of board.pages.entries()) {
    const pageSpots = board.spots.filter((s) => s.pageId === page.id);
    if (page.image) {
      sheets.push({ index, canvas: await renderProofSheet({ image: page.image }, pageSpots, lines) });
    } else if (page.source) {
      const snapshot = await snapshotHtmlPage(page.source);
      if (!snapshot) {
        failedHtmlPages++;
        continue;
      }
      sheets.push({ index, canvas: await renderProofSheet({ image: snapshot }, pageSpots, lines) });
    }
  }

  if (sheets.length === 0) return { blob: null, failedHtmlPages };
  if (sheets.length === 1) return { blob: await canvasToBlob(sheets[0].canvas), failedHtmlPages };

  const HEADER = 44;
  const GAP = 20;
  const rawWidth = Math.max(...sheets.map((s) => s.canvas.width));
  const rawHeight = sheets.reduce((sum, s) => sum + HEADER + s.canvas.height + GAP, 0) - GAP;
  const MAX_CANVAS_EDGE = 16000;
  const scale = Math.min(1, MAX_CANVAS_EDGE / rawWidth, MAX_CANVAS_EDGE / rawHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rawWidth * scale));
  canvas.height = Math.max(1, Math.round(rawHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context を取得できませんでした');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rawWidth, rawHeight);

  let y = 0;
  for (const { index, canvas: sheet } of sheets) {
    ctx.fillStyle = '#1C1B19';
    ctx.fillRect(0, y, rawWidth, HEADER);
    ctx.fillStyle = '#F7F4EE';
    ctx.font = 'bold 20px "Noto Sans JP", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`p.${index + 1}`, 20, y + HEADER / 2);
    y += HEADER;
    ctx.drawImage(sheet, 0, y);
    y += sheet.height + GAP;
  }
  return { blob: await canvasToBlob(canvas), failedHtmlPages };
}

function buildHtmlBundle(board: Board): Blob | null {
  const chunks: string[] = [];
  board.pages.forEach((page, index) => {
    if (!page.source) return;
    chunks.push([
      `<!-- UI ColLabo p.${index + 1}${page.source.title ? `: ${page.source.title}` : ''} -->`,
      page.source.origin ? `<!-- origin: ${page.source.origin} -->` : '',
      page.source.html,
    ].filter(Boolean).join('\n'));
  });
  if (chunks.length === 0) return null;
  return new Blob([chunks.join('\n\n<!-- ===== next page ===== -->\n\n')], { type: 'text/html;charset=utf-8' });
}

export async function prepareHandoff(board: Board): Promise<PreparedHandoff> {
  const manifest = buildHandoffManifest(board);
  const assets: PreparedHandoffAsset[] = [];
  const warnings: string[] = [];

  const { blob: proofPacket, failedHtmlPages } = await renderProofPacket(board);
  if (proofPacket) {
    const pageCount = manifest.imagePageIds.length + manifest.htmlPageIds.length - failedHtmlPages;
    assets.push({
      kind: 'proof-packet',
      filename: `${board.title || 'board'}-proof${pageCount > 1 ? '-pages' : ''}.png`,
      blob: proofPacket,
    });
  }

  const htmlBundle = buildHtmlBundle(board);
  if (htmlBundle) {
    assets.push({ kind: 'html-bundle', filename: `${board.title || 'board'}-source.html`, blob: htmlBundle });
  }

  if (manifest.blankPageIds.length > 0) {
    warnings.push(`白紙ページ ${manifest.blankPageIds.length}件は指示文のみで渡します`);
  }
  if (manifest.imagePageIds.length > 1) {
    warnings.push(`画像${manifest.imagePageIds.length}ページを1枚の校正パケットにまとめました`);
  }
  if (manifest.htmlPageIds.length > 0) {
    warnings.push(`HTML ${manifest.htmlPageIds.length}ページ分のソースを1ファイルにまとめました`);
  }
  if (failedHtmlPages > 0) {
    warnings.push(`このページは画像にできませんでした(${failedHtmlPages}件)。指示文はそのまま渡ります`);
  }

  return {
    prompt: manifest.prompt,
    assets,
    warnings,
    imagePageCount: manifest.imagePageIds.length,
    htmlPageCount: manifest.htmlPageIds.length,
  };
}
