import type { Board, ElementRef, ImageRole, Note, Page, Rect, Rules, Spot } from './schema';
import { COLOR_DIRECTIONS, COLOR_ROLES, FONT_MOODS, LADDER_TABLE, MOTIONS, relativeWordLabel } from './vocab';
import { ruleRefOptions } from './lib/ruleRefs';
import { resolveLadder } from './lib/htmlCss';
import { resolveTargetStep } from './lib/ghost';

const MOTION_TRIGGER_LABEL: Record<'enter' | 'hover' | 'transition', string> = {
  enter: '登場時',
  hover: 'ホバー',
  transition: '切り替え',
};

const PALETTE_ROLE_LABEL: Record<'bg' | 'text' | 'accent' | 'sub', string> = {
  bg: '背景',
  text: '文字',
  accent: '強調',
  sub: '補助',
};

const TYPE_ROLE_LABEL: Record<'heading' | 'body' | 'caption', string> = {
  heading: '見出し',
  body: '本文',
  caption: '注釈',
};

const PREAMBLE = [
  '> 以下はデザインの修正指示です。①②③は添付画像上の番号付き領域を指します。',
  '> 位置と大きさは画像の左上を原点とし、画像の幅・高さに対する割合(%)で示します。',
  '> px換算は幅1280px基準です。「変えないもの」は現状維持してください。',
].join('\n');

const HTML_PREAMBLE = [
  '> 以下はWebページの修正指示です。各項目の `セレクタ` は、対象ページに対するCSSセレクタです。',
  '> 「現在」は取り込み時点の getComputedStyle の実測値です。',
  '> 「変えないもの」は現状維持してください。',
].join('\n');

function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

function rectLabel(r: Rect): string {
  return `x ${pct(r.x)}, y ${pct(r.y)}, w ${pct(r.w)}, h ${pct(r.h)}`;
}

function docKind(board: Board): string {
  // R2: 再校(照合)は、前回の指示のうち未反映のものを含む旨をヘッダーに明記する
  if (board.round) return '修正指示(再校。前回の指示のうち未反映のものを含みます)';
  if (board.imageRole === 'draft') return '修正指示(初校に対して)';
  if (board.imageRole === 'reference') return '参考画像に基づく指定';
  return '制作前の指定';
}

function formatTargetDelta(from: number, to: number, unit: '%' | 'px' = '%'): string {
  const fromS = unit === '%' ? pct(from) : `${Math.round(from)}${unit}`;
  const toS = unit === '%' ? pct(to) : `${Math.round(to)}${unit}`;
  return `${fromS} → ${toS}`;
}

/** H3: 指示文の1行。spotId/noteIdがあれば、その行はボード上の箇所・ノートに対応する(クリックで操作できる)。 */
export interface Line {
  text: string;
  spotId?: string;
  noteId?: string;
  pageId?: string;
}

function positionLines(spot: Spot): Line[] {
  if (!spot.targetRect) return [];
  const lines: Line[] = [];
  const { rect, targetRect } = spot;
  if (rect.x !== targetRect.x || rect.y !== targetRect.y) {
    const dir: string[] = [];
    if (targetRect.y < rect.y) dir.push(`上へ ${pct(rect.y - targetRect.y)}`);
    if (targetRect.y > rect.y) dir.push(`下へ ${pct(targetRect.y - rect.y)}`);
    if (targetRect.x < rect.x) dir.push(`左へ ${pct(rect.x - targetRect.x)}`);
    if (targetRect.x > rect.x) dir.push(`右へ ${pct(targetRect.x - rect.x)}`);
    lines.push({ text: `- 位置: ${dir.join(' / ')}(${formatTargetDelta(rect.y, targetRect.y)})`, spotId: spot.id });
  }
  if (rect.w !== targetRect.w || rect.h !== targetRect.h) {
    const ratio = targetRect.w / rect.w;
    lines.push({ text: `- 大きさ: 幅 ${formatTargetDelta(rect.w, targetRect.w)}(約${ratio.toFixed(1)}倍)`, spotId: spot.id });
  }
  return lines;
}

interface NoteCtx {
  imageRole: ImageRole | null;
  spotN: number;
  rules: Rules;
}

function formatNote(note: Note, ctx: NoteCtx): string {
  switch (note.kind) {
    case 'text': {
      const chips = note.chips.length > 0 ? `${note.chips.join(' / ')}` : '';
      const text = note.text ? `「${note.text}」` : '';
      return `- ひとこと: ${[chips, text].filter(Boolean).join(' ')}`;
    }
    case 'rule': {
      const label = ruleRefOptions(ctx.rules).find((o) => o.ref === note.ruleRef)?.label ?? note.ruleRef;
      return `- ルール: ${label}とズレている。ルールに合わせる`;
    }
    case 'color': {
      if (ctx.imageRole === 'reference') {
        const roleLabel = note.role ? (COLOR_ROLES.find((r) => r.id === note.role)?.label ?? '強調') : '強調';
        return `- 色: 参考画像${ctx.spotN}の色 ${note.target} を${roleLabel}色に`;
      }
      const via = note.via ? COLOR_DIRECTIONS.find((d) => d.id === note.via)?.label : undefined;
      const cur = note.current ? `${note.current} → ` : '';
      return `- 色: ${cur}${note.target}${via ? `(${via})` : ''}`;
    }
    case 'font': {
      const mood = FONT_MOODS.find((m) => m.id === note.mood);
      return `- 文字の雰囲気: ${mood ? `${mood.label}(${mood.font})` : note.mood}`;
    }
    case 'motion': {
      const m = MOTIONS.find((x) => x.id === note.motion);
      const bits = [`${MOTION_TRIGGER_LABEL[note.trigger]}に「${m?.label ?? note.motion}」(${note.motion})`];
      if (note.speed !== undefined) bits.push(`速さ ${note.speed}s`);
      if (note.intensity !== undefined) bits.push(`強さ ${LADDER_TABLE.intensity.steps[note.intensity]}`);
      return `- 動き: ${bits.join('、')}`;
    }
    case 'ladder': {
      const def = LADDER_TABLE[note.attr];
      const target = note.target;
      const stepText = (step: number) => `${def.steps[step]}${def.unit ?? ''}`;
      // H2: 相対語は属性ごとの会話語(例: 余白なら「詰める/広げる」)にする
      const relativeLabel = 'delta' in target ? relativeWordLabel(note.attr, target.delta) : undefined;
      // S7: currentがあれば「今 → こうしたい」の形で出力に届ける。deltaはcurrentを起点に解決する
      if (note.current !== undefined) {
        const toStep = resolveTargetStep(note);
        const to = toStep === null ? '' : stepText(toStep);
        return `- ${def.label}: ${stepText(note.current)} → ${to}${relativeLabel ? `(${relativeLabel})` : ''}`;
      }
      if ('step' in target) return `- ${def.label}: ${stepText(target.step)}`;
      return `- ${def.label}: ${relativeLabel ?? ''}`;
    }
  }
}

/** S9: ノートなし・位置の差分なしの箇所(囲っただけ)は、指示文に含めない対象かどうか。 */
export function hasSpecifiedContent(spot: Spot, board: Board): boolean {
  if (spot.notes.length > 0) return true;
  if (board.imageRole === 'draft' && spot.targetRect) {
    const { rect, targetRect } = spot;
    if (rect.x !== targetRect.x || rect.y !== targetRect.y || rect.w !== targetRect.w || rect.h !== targetRect.h) return true;
  }
  return false;
}

// ponytail: 3x3の粗いゾーン判定。厳密な意味解析はしない
function zoneLabel(r: Rect): string {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const h = cx < 0.33 ? '左' : cx < 0.66 ? '中央' : '右';
  const v = cy < 0.33 ? '上' : cy < 0.66 ? '中央' : '下';
  if (h === '中央' && v === '中央') return '中央';
  if (v === '中央') return h;
  if (h === '中央') return v;
  return `${h}${v}`;
}

function layoutLines(spot: Spot, ctx: NoteCtx): Line[] {
  const lines: Line[] = [
    { text: `- ${spot.n} ${spot.label || `箇所${spot.n}`}: ${zoneLabel(spot.rect)}(${rectLabel(spot.rect)})`, spotId: spot.id },
  ];
  for (const n of spot.notes) lines.push({ text: `  ${formatNote(n, ctx)}`, spotId: spot.id, noteId: n.id });
  return lines;
}

// R2: 持ち越したのにまだ○が付いていない箇所には、前回からの持ち越しであることを添える
function carriedSuffix(spot: Spot): string {
  return spot.carried && spot.check !== 'ok' ? '(前回も指示・未反映)' : '';
}

function spotSectionLines(spot: Spot, ctx: NoteCtx): Line[] {
  if (spot.element) return htmlSpotSectionLines(spot, spot.element, ctx);
  const lines: Line[] = [{ text: `### ${spot.n} ${spot.label || `箇所${spot.n}`}(${rectLabel(spot.rect)})${carriedSuffix(spot)}`, spotId: spot.id }];
  // targetRect の差分は draft(今の状態がある)ときだけ意味を持つ
  if (ctx.imageRole === 'draft') lines.push(...positionLines(spot));
  for (const n of spot.notes) lines.push({ text: formatNote(n, ctx), spotId: spot.id, noteId: n.id });
  return lines;
}

function htmlSpotSectionLines(spot: Spot, element: ElementRef, ctx: NoteCtx): Line[] {
  const lines: Line[] = [{ text: `### ${spot.n} ${spot.label || `箇所${spot.n}`}  \`${element.selector}\`${carriedSuffix(spot)}`, spotId: spot.id }];
  const textPart = element.text ? ` 「${element.text}」` : '';
  lines.push({ text: `- 要素: <${element.tag}>${textPart}`, spotId: spot.id });
  for (const n of spot.notes) lines.push({ text: formatHtmlNote(n, element, ctx), spotId: spot.id, noteId: n.id });
  return lines;
}

/** ラダー・色は実測値(element.computed)を使った「現在値 → 目標値」で出す。それ以外は既存のformatNoteと同じ形式。 */
function formatHtmlNote(note: Note, element: ElementRef, ctx: NoteCtx): string {
  if (note.kind === 'ladder') {
    const def = LADDER_TABLE[note.attr];
    const resolved = resolveLadder(note.attr, note, element.computed);
    if (!resolved) return formatNote(note, ctx);
    const from = resolved.from ? `${resolved.from} → ` : '';
    const target = note.target;
    const relativeLabel = 'delta' in target ? relativeWordLabel(note.attr, target.delta) : undefined;
    return `- ${def.label}: ${from}${resolved.to}${relativeLabel ? `(${relativeLabel})` : ''}`;
  }
  if (note.kind === 'color') {
    const cssKey = note.role === 'bg' ? 'background-color' : note.role === 'line' ? 'border-color' : 'color';
    const current = element.computed[cssKey];
    const via = note.via ? COLOR_DIRECTIONS.find((d) => d.id === note.via)?.label : undefined;
    const from = current ? `${current} → ` : '';
    return `- 色: ${from}${note.target}${via ? `(${via})` : ''}`;
  }
  return formatNote(note, ctx);
}

/** S10: ページ見出し「## p.N」に添える、そのページ固有の情報。 */
function pageHeading(page: Page, index: number): string {
  if (page.source) {
    const originPart = page.source.origin ? `(${page.source.origin})` : '';
    return `## p.${index + 1} Webページ${originPart}、レンダリング幅 ${page.source.width}px`;
  }
  if (page.image) return `## p.${index + 1}(画像 ${page.image.width}×${page.image.height})`;
  return `## p.${index + 1}`;
}

/** H3: boardToMarkdownと同じ内容を、箇所・ノートに対応付けた行の配列で返す。 */
export function boardToLines(board: Board): Line[] {
  const pages = board.pages;
  const page = pages[0];
  const activeSpots = board.spots.filter((s) => !s.keep);
  const keptSpots = board.spots.filter((s) => s.keep);
  // S10: 1枚目だけを見ず、ボード内に画像ページ・HTMLページがあるかどうかで組み立てる
  const hasHtmlPage = pages.some((p) => p.source);
  const isMultiPage = pages.length > 1;

  const lines: Line[] = [{ text: hasHtmlPage ? HTML_PREAMBLE : PREAMBLE }, { text: '' }, { text: `# デザイン指示: ${board.title}` }, { text: '' }];
  if (isMultiPage) {
    const formatLabel =
      board.format.kind === 'web' ? 'Web' : board.format.kind === 'slide' ? `スライド(${board.format.aspect})` : '白紙';
    lines.push({ text: `- 対象: ${formatLabel}、${pages.length}ページ` });
    lines.push({ text: `- 種類: ${hasHtmlPage ? 'コード修正指示(HTMLページに対して)' : docKind(board)}` });
  } else if (page?.source) {
    const originPart = page.source.origin ? `(${page.source.origin})` : '';
    lines.push({ text: `- 対象: Webページ${originPart}、レンダリング幅 ${page.source.width}px` });
    lines.push({ text: '- 種類: コード修正指示(HTMLページに対して)' });
  } else {
    const sizeLine = page?.image ? `、画像サイズ ${page.image.width}×${page.image.height}` : '';
    const formatLabel =
      board.format.kind === 'web' ? 'Web' : board.format.kind === 'slide' ? `スライド(${board.format.aspect})` : '白紙';
    lines.push({ text: `- 対象: ${formatLabel}${sizeLine}` });
    lines.push({ text: `- 種類: ${docKind(board)}` });
  }
  lines.push({ text: '' });

  if (board.rules.palette.length || board.rules.type.length || board.rules.spacing !== undefined || board.rules.motion.length || board.rules.tone.length) {
    lines.push({ text: '## 基準ルール' });
    if (board.rules.palette.length) {
      lines.push({ text: `- 色: ${board.rules.palette.map((p) => `${PALETTE_ROLE_LABEL[p.role]} ${p.hex}`).join(' / ')}` });
    }
    if (board.rules.type.length) {
      lines.push({
        text: `- 文字: ${board.rules.type
          .map((t) => {
            const mood = t.mood ? FONT_MOODS.find((m) => m.id === t.mood)?.label ?? t.mood : '';
            return `${TYPE_ROLE_LABEL[t.role]}=${mood}${t.size ? ` ${t.size}px` : ''}`;
          })
          .join(' / ')}`,
      });
    }
    if (board.rules.spacing !== undefined) {
      lines.push({ text: `- 余白: 基準 ${LADDER_TABLE.spacing.steps[board.rules.spacing]}px` });
    }
    if (board.rules.motion.length) {
      lines.push({ text: `- 動き: ${board.rules.motion.map((m) => `${MOTION_TRIGGER_LABEL[m.trigger]}=${MOTIONS.find((x) => x.id === m.motion)?.label ?? m.motion}`).join(' / ')}` });
    }
    if (board.rules.tone.length) {
      lines.push({ text: `- トーン: ${board.rules.tone.join('、')}` });
    }
    lines.push({ text: '' });
  }

  if (board.tone.chips.length || board.tone.text) {
    lines.push({ text: '## 全体' });
    const chips = board.tone.chips.length ? `「${board.tone.chips.join('、')}」` : '';
    const text = board.tone.text ? `「${board.tone.text}」` : '';
    if (chips || text) lines.push({ text: `- ひとこと: ${[chips, text].filter(Boolean).join(' ')}` });
    if (board.order.length > 1) {
      const ordered = board.order
        .map((id) => board.spots.find((s) => s.id === id))
        .filter((s): s is Spot => !!s)
        .map((s) => `${s.n} ${s.label || ''}`.trim());
      lines.push({ text: `- 見る順: ${ordered.join(' → ')}` });
    }
    lines.push({ text: '' });
  }

  const isBrief = board.imageRole === null;
  // S9: 白紙(レイアウト)は位置そのものが内容なので対象外。draft/referenceは中身のない箇所を渡さない
  const specifiedSpots = isBrief ? activeSpots : activeSpots.filter((s) => hasSpecifiedContent(s, board));
  if (specifiedSpots.length > 0) {
    if (!isMultiPage) lines.push({ text: isBrief ? '## レイアウト' : '## 箇所ごと' });
    for (const [pageIndex, p] of pages.entries()) {
      const pageSpots = specifiedSpots.filter((s) => s.pageId === p.id);
      if (pageSpots.length === 0) continue;
      if (isMultiPage) lines.push({ text: pageHeading(p, pageIndex), pageId: p.id });
      for (const spot of pageSpots) {
        const ctx: NoteCtx = { imageRole: board.imageRole, spotN: spot.n, rules: board.rules };
        lines.push(...(isBrief ? layoutLines(spot, ctx) : spotSectionLines(spot, ctx)));
        lines.push({ text: '' });
      }
    }
  }

  if (keptSpots.length > 0) {
    lines.push({ text: '## 変えないもの' });
    for (const spot of keptSpots) {
      // R2: 照合で○を付けた(前回修正済みの)箇所と分かるようにする
      const suffix = spot.carried && spot.check === 'ok' ? '(前回修正済み)' : '';
      lines.push({ text: `- ${spot.n} ${spot.label || `箇所${spot.n}`}${suffix}`, spotId: spot.id });
    }
    lines.push({ text: '' });
  }

  return lines;
}

export function boardToMarkdown(board: Board): string {
  return boardToLines(board)
    .map((l) => l.text)
    .join('\n')
    .trimEnd() + '\n';
}

/** JSON書き出し用。画像データURL・HTML本文(数百KBになり得る)は含まない。 */
export function boardToExportJson(board: Board): unknown {
  return {
    ...board,
    pages: board.pages.map((p) => ({
      id: p.id,
      label: p.label,
      image: p.image ? { width: p.image.width, height: p.image.height } : null,
      ...(p.source
        ? { source: { kind: p.source.kind, title: p.source.title, origin: p.source.origin, allowExternal: p.source.allowExternal, width: p.source.width, height: p.source.height } }
        : {}),
    })),
  };
}

const BADGE_MIN = 24;
const BADGE_RATIO = 0.025;

/** 番号付きPNGを1ページ分描画する。①②③バッジ、朱色点線の目標箱、中心から中心への矢印。 */
export function renderNumberedImage(page: { image: { dataUrl: string; width: number; height: number } }, spots: Spot[]): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = page.image.width;
      canvas.height = page.image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas 2d context を取得できませんでした'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const badgeR = Math.max(BADGE_MIN, canvas.width * BADGE_RATIO);
      for (const spot of spots) {
        const x = spot.rect.x * canvas.width;
        const y = spot.rect.y * canvas.height;
        const w = spot.rect.w * canvas.width;
        const h = spot.rect.h * canvas.height;

        ctx.strokeStyle = '#1C1B19';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        if (spot.targetRect) {
          const tx = spot.targetRect.x * canvas.width;
          const ty = spot.targetRect.y * canvas.height;
          const tw = spot.targetRect.w * canvas.width;
          const th = spot.targetRect.h * canvas.height;
          ctx.save();
          ctx.strokeStyle = '#E4572E';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(tx, ty, tw, th);
          ctx.restore();

          ctx.beginPath();
          ctx.moveTo(x + w / 2, y + h / 2);
          ctx.lineTo(tx + tw / 2, ty + th / 2);
          ctx.strokeStyle = '#E4572E';
          ctx.setLineDash([]);
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(x, y, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = '#1C1B19';
        ctx.fill();
        ctx.fillStyle = '#F7F4EE';
        ctx.font = `${Math.round(badgeR)}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(spot.n), x, y + 1);
      }

      resolve(canvas);
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = page.image.dataUrl;
  });
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

const PROOF_MARGIN_RATIO = 0.45;
const PROOF_MARGIN_MIN = 480;
const PROOF_PADDING = 24;
const PROOF_LINE_HEIGHT = 24;
const PROOF_BLOCK_GAP = 20;
const PROOF_HEADING_FONT = 'bold 20px "Noto Sans JP", sans-serif';
const PROOF_BODY_FONT = '16px "Noto Sans JP", sans-serif';
const PROOF_WASHI = '#F7F4EE';
const PROOF_INK = '#1C1B19';
const PROOF_VERMILION = '#E4572E';

/** 1〜20は丸数字、それ以外は「(n)」にする。 */
function circledNumber(n: number): string {
  return n >= 1 && n <= 20 ? String.fromCodePoint(0x2460 + n - 1) : `(${n})`;
}

/** 和文でも読める幅で1文字ずつ折り返す。 */
function wrapByChar(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: string): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    const next = cur + ch;
    if (cur && ctx.measureText(next).width > maxWidth) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * R3: 校正紙。元画像の右に和紙色の余白を足し、箇所ごとに赤字の指示を並べて引き出し線で結ぶ。
 * 画像1枚だけをAIに渡しても、箇所と指示が読めるようにする。
 */
export async function renderProofSheet(page: { image: { dataUrl: string; width: number; height: number } }, spots: Spot[], lines: Line[]): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) await document.fonts.ready;
  const img = await loadImageEl(page.image.dataUrl);
  const { width: iw, height: ih } = page.image;
  const marginW = Math.max(PROOF_MARGIN_MIN, Math.round(iw * PROOF_MARGIN_RATIO));
  const textMaxWidth = marginW - PROOF_PADDING * 2;

  // 箇所ごとのノート行(先頭の「- 」は取り、見出しは含めない。見出しは箇所のラベルから作る)
  const noteLinesBySpot = new Map<string, string[]>();
  for (const line of lines) {
    if (!line.spotId || !line.noteId) continue;
    if (!noteLinesBySpot.has(line.spotId)) noteLinesBySpot.set(line.spotId, []);
    noteLinesBySpot.get(line.spotId)!.push(line.text.replace(/^\s*-\s*/, ''));
  }

  const activeSpots = spots.filter((s) => !s.keep && (noteLinesBySpot.get(s.id)?.length ?? 0) > 0).sort((a, b) => a.rect.y - b.rect.y);
  const keptSpots = spots.filter((s) => s.keep);

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;

  interface Block {
    spot: Spot;
    rows: { text: string; heading: boolean }[];
    height: number;
  }
  const blocks: Block[] = activeSpots.map((spot) => {
    const heading = `${circledNumber(spot.n)} ${spot.label || `箇所${spot.n}`}`;
    const rows: { text: string; heading: boolean }[] = [];
    for (const t of wrapByChar(mctx, heading, textMaxWidth, PROOF_HEADING_FONT)) rows.push({ text: t, heading: true });
    for (const raw of noteLinesBySpot.get(spot.id) ?? []) {
      for (const t of wrapByChar(mctx, raw, textMaxWidth, PROOF_BODY_FONT)) rows.push({ text: t, heading: false });
    }
    return { spot, rows, height: rows.length * PROOF_LINE_HEIGHT };
  });

  const keptHeight = keptSpots.length > 0 ? PROOF_LINE_HEIGHT * (1 + keptSpots.length) + PROOF_BLOCK_GAP : 0;
  const contentHeight = blocks.reduce((sum, b) => sum + b.height + PROOF_BLOCK_GAP, PROOF_PADDING) + keptHeight;
  const canvasHeight = Math.max(ih, contentHeight);

  const canvas = document.createElement('canvas');
  canvas.width = iw + marginW;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context を取得できませんでした');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, iw, ih);
  ctx.fillStyle = PROOF_WASHI;
  ctx.fillRect(iw, 0, marginW, canvasHeight);

  const badgeR = Math.max(BADGE_MIN, iw * BADGE_RATIO);
  for (const spot of activeSpots) {
    const x = spot.rect.x * iw;
    const y = spot.rect.y * ih;
    ctx.beginPath();
    ctx.arc(x, y, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = PROOF_INK;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(badgeR)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(spot.n), x, y + 1);
  }

  const marginX = iw + PROOF_PADDING;
  let cursorY = PROOF_PADDING;
  for (const block of blocks) {
    const blockY = Math.max(cursorY, spotCenterY(block.spot, ih) - block.height / 2);

    // 引き出し線: 箇所の右辺の中央から、赤字の塊へ
    ctx.strokeStyle = PROOF_VERMILION;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo((block.spot.rect.x + block.spot.rect.w) * iw, spotCenterY(block.spot, ih));
    ctx.lineTo(marginX, blockY + PROOF_LINE_HEIGHT / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    let rowY = blockY;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const row of block.rows) {
      ctx.font = row.heading ? PROOF_HEADING_FONT : PROOF_BODY_FONT;
      ctx.fillStyle = row.heading ? PROOF_INK : PROOF_VERMILION;
      ctx.fillText(row.text, marginX, rowY);
      rowY += PROOF_LINE_HEIGHT;
    }
    cursorY = blockY + block.height + PROOF_BLOCK_GAP;
  }

  if (keptSpots.length > 0) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = PROOF_HEADING_FONT;
    ctx.fillStyle = PROOF_INK;
    ctx.fillText('変えないもの', marginX, cursorY);
    cursorY += PROOF_LINE_HEIGHT;
    ctx.font = PROOF_BODY_FONT;
    for (const spot of keptSpots) {
      ctx.fillText(`${spot.n} ${spot.label || `箇所${spot.n}`}`, marginX, cursorY);
      cursorY += PROOF_LINE_HEIGHT;
    }
  }

  return canvas;
}

function spotCenterY(spot: Spot, imageHeight: number): number {
  return (spot.rect.y + spot.rect.h / 2) * imageHeight;
}
