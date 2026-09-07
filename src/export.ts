import type { Board, ElementRef, ImageRole, Note, Rect, Rules, Spot } from './schema';
import { COLOR_DIRECTIONS, COLOR_ROLES, FONT_MOODS, LADDER_TABLE, MOTIONS, RELATIVE_CHIPS, stepLabel } from './vocab';
import { ruleRefOptions } from './lib/ruleRefs';
import { COLOR_PROP, LADDER_PROP, resolveLadder } from './lib/htmlCss';

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
  if (board.imageRole === 'draft') return '修正指示(初校に対して)';
  if (board.imageRole === 'reference') return '参考画像に基づく指定';
  return '制作前の指定';
}

function formatTargetDelta(from: number, to: number, unit: '%' | 'px' = '%'): string {
  const fromS = unit === '%' ? pct(from) : `${Math.round(from)}${unit}`;
  const toS = unit === '%' ? pct(to) : `${Math.round(to)}${unit}`;
  return `${fromS} → ${toS}`;
}

function positionLines(spot: Spot): string[] {
  if (!spot.targetRect) return [];
  const lines: string[] = [];
  const { rect, targetRect } = spot;
  if (rect.x !== targetRect.x || rect.y !== targetRect.y) {
    const dir: string[] = [];
    if (targetRect.y < rect.y) dir.push(`上へ ${pct(rect.y - targetRect.y)}`);
    if (targetRect.y > rect.y) dir.push(`下へ ${pct(targetRect.y - rect.y)}`);
    if (targetRect.x < rect.x) dir.push(`左へ ${pct(rect.x - targetRect.x)}`);
    if (targetRect.x > rect.x) dir.push(`右へ ${pct(targetRect.x - rect.x)}`);
    lines.push(`- 位置: ${dir.join(' / ')}(${formatTargetDelta(rect.y, targetRect.y)})`);
  }
  if (rect.w !== targetRect.w || rect.h !== targetRect.h) {
    const ratio = targetRect.w / rect.w;
    lines.push(`- 大きさ: 幅 ${formatTargetDelta(rect.w, targetRect.w)}(約${ratio.toFixed(1)}倍)`);
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
      if ('step' in target) {
        return `- ${def.label}: ${def.steps[target.step]}${def.unit ?? ''}`;
      }
      const delta = target.delta;
      const chip = RELATIVE_CHIPS.find((c) => c.delta === delta);
      return `- ${def.label}: ${chip?.label ?? ''}`;
    }
  }
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

function layoutLine(spot: Spot, ctx: NoteCtx): string {
  const lines = [`- ${spot.n} ${spot.label || `箇所${spot.n}`}: ${zoneLabel(spot.rect)}(${rectLabel(spot.rect)})`];
  lines.push(...spot.notes.map((n) => `  ${formatNote(n, ctx)}`));
  return lines.join('\n');
}

function spotSection(spot: Spot, ctx: NoteCtx): string {
  if (spot.element) return htmlSpotSection(spot, spot.element, ctx);
  const lines = [`### ${spot.n} ${spot.label || `箇所${spot.n}`}(${rectLabel(spot.rect)})`];
  // targetRect の差分は draft(今の状態がある)ときだけ意味を持つ
  if (ctx.imageRole === 'draft') lines.push(...positionLines(spot));
  lines.push(...spot.notes.map((n) => formatNote(n, ctx)));
  return lines.join('\n');
}

/** HTMLページの箇所の節。矩形は出さず、セレクタと実測値(現在→目標)を出す。 */
function htmlSpotSection(spot: Spot, el: ElementRef, ctx: NoteCtx): string {
  const lines = [`### ${spot.n} ${spot.label || `箇所${spot.n}`}  \`${el.selector}\``];
  lines.push(`- 要素: <${el.tag}>${el.text ? ` 「${el.text}」` : ''}`);
  lines.push(...spot.notes.map((n) => formatElementNote(n, el, ctx)));
  return lines.join('\n');
}

function formatElementNote(note: Note, el: ElementRef, ctx: NoteCtx): string {
  if (note.kind === 'ladder') {
    const def = LADDER_TABLE[note.attr];
    const prop = LADDER_PROP[note.attr];
    const resolved = prop ? resolveLadder(note.attr, note, el.computed[prop]) : null;
    const target = note.target;
    const deltaLabel = 'delta' in target ? RELATIVE_CHIPS.find((c) => c.delta === target.delta)?.label : undefined;
    if (!resolved || !resolved.from) {
      const to = 'step' in target ? stepLabel(def, target.step) : (deltaLabel ?? '');
      return `- ${def.label}: ${to}`;
    }
    const suffix = deltaLabel ? `(${deltaLabel})` : '';
    return `- ${def.label}: ${resolved.from} → ${resolved.to}${suffix}`;
  }
  if (note.kind === 'color') {
    const prop = COLOR_PROP[note.role ?? 'accent'];
    const current = el.computed[prop];
    if (current) {
      const via = note.via ? COLOR_DIRECTIONS.find((d) => d.id === note.via)?.label : undefined;
      return `- 色: ${current} → ${note.target}${via ? `(${via})` : ''}`;
    }
  }
  return formatNote(note, ctx);
}

export function boardToMarkdown(board: Board): string {
  const page = board.pages[0];
  const activeSpots = board.spots.filter((s) => !s.keep);
  const keptSpots = board.spots.filter((s) => s.keep);
  const source = page?.source;
  const sizeLine = page?.image ? `、画像サイズ ${page.image.width}×${page.image.height}` : '';
  const formatLabel =
    board.format.kind === 'web' ? 'Web' : board.format.kind === 'slide' ? `スライド(${board.format.aspect})` : '白紙';

  const parts: string[] = [source ? HTML_PREAMBLE : PREAMBLE, '', `# デザイン指示: ${board.title}`, ''];
  if (source) {
    const originPart = source.origin ? `(${source.origin})` : '';
    parts.push(`- 対象: Webページ${originPart}、レンダリング幅 ${source.width}px`);
    parts.push('- 種類: コード修正指示(HTMLページに対して)');
  } else {
    parts.push(`- 対象: ${formatLabel}${sizeLine}`);
    parts.push(`- 種類: ${docKind(board)}`);
  }
  parts.push('');

  if (board.rules.palette.length || board.rules.type.length || board.rules.spacing !== undefined || board.rules.motion.length || board.rules.tone.length) {
    parts.push('## 基準ルール');
    if (board.rules.palette.length) {
      parts.push(`- 色: ${board.rules.palette.map((p) => `${PALETTE_ROLE_LABEL[p.role]} ${p.hex}`).join(' / ')}`);
    }
    if (board.rules.type.length) {
      parts.push(
        `- 文字: ${board.rules.type
          .map((t) => {
            const mood = t.mood ? FONT_MOODS.find((m) => m.id === t.mood)?.label ?? t.mood : '';
            return `${TYPE_ROLE_LABEL[t.role]}=${mood}${t.size ? ` ${t.size}px` : ''}`;
          })
          .join(' / ')}`,
      );
    }
    if (board.rules.spacing !== undefined) {
      parts.push(`- 余白: 基準 ${LADDER_TABLE.spacing.steps[board.rules.spacing]}px`);
    }
    if (board.rules.motion.length) {
      parts.push(`- 動き: ${board.rules.motion.map((m) => `${MOTION_TRIGGER_LABEL[m.trigger]}=${MOTIONS.find((x) => x.id === m.motion)?.label ?? m.motion}`).join(' / ')}`);
    }
    if (board.rules.tone.length) {
      parts.push(`- トーン: ${board.rules.tone.join('、')}`);
    }
    parts.push('');
  }

  if (board.tone.chips.length || board.tone.text) {
    parts.push('## 全体');
    const chips = board.tone.chips.length ? `「${board.tone.chips.join('、')}」` : '';
    const text = board.tone.text ? `「${board.tone.text}」` : '';
    if (chips || text) parts.push(`- ひとこと: ${[chips, text].filter(Boolean).join(' ')}`);
    if (board.order.length > 1) {
      const ordered = board.order
        .map((id) => board.spots.find((s) => s.id === id))
        .filter((s): s is Spot => !!s)
        .map((s) => `${s.n} ${s.label || ''}`.trim());
      parts.push(`- 見る順: ${ordered.join(' → ')}`);
    }
    parts.push('');
  }

  const isBrief = board.imageRole === null;
  if (activeSpots.length > 0) {
    parts.push(isBrief ? '## レイアウト' : '## 箇所ごと');
    for (const spot of activeSpots) {
      const ctx: NoteCtx = { imageRole: board.imageRole, spotN: spot.n, rules: board.rules };
      parts.push(isBrief ? layoutLine(spot, ctx) : spotSection(spot, ctx));
      parts.push('');
    }
  }

  if (keptSpots.length > 0) {
    parts.push('## 変えないもの');
    for (const spot of keptSpots) {
      parts.push(`- ${spot.n} ${spot.label || `箇所${spot.n}`}`);
    }
    parts.push('');
  }

  return parts.join('\n').trimEnd() + '\n';
}

/** JSON書き出し用。画像データURLは含まない。 */
export function boardToExportJson(board: Board): unknown {
  return {
    ...board,
    pages: board.pages.map((p) => ({
      id: p.id,
      label: p.label,
      image: p.image ? { width: p.image.width, height: p.image.height } : null,
      source: p.source ? { kind: p.source.kind, title: p.source.title, origin: p.source.origin, width: p.source.width, height: p.source.height } : undefined,
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
