import type { LadderAttr } from './schema';

// 段階(ラダー)・フォント・動きの語彙テーブル。出力(export.ts)とピッカーの両方がここを参照する。

export const TONE_CHIPS = [
  '静かに',
  '主張を強く',
  '軽く',
  '重厚に',
  '親しみやすく',
  '上品に',
  '整然と',
  '遊びを',
  'シンプルに',
  'にぎやかに',
] as const;

export interface LadderDef {
  label: string;
  steps: (number | string)[];
  unit?: string;
}

export const LADDER_TABLE: Record<LadderAttr, LadderDef> = {
  // H2: Webの大見出し(64〜96px)を表せるよう末尾に72・96を追加。保存済みの段番号はずれない
  fontSize: { label: '文字サイズ', steps: [12, 14, 16, 18, 20, 24, 32, 40, 56, 72, 96], unit: 'px' },
  weight: { label: '文字の太さ', steps: [300, 400, 500, 600, 700, 800] },
  spacing: { label: '余白', steps: [0, 4, 8, 12, 16, 24, 32, 48, 64], unit: 'px' },
  radius: { label: '角丸', steps: [0, 2, 4, 8, 12, 16, 24, 'full'], unit: 'px' },
  scale: { label: '全体の大きさ', steps: [50, 65, 80, 90, 100, 110, 125, 150, 200], unit: '%' },
  lineWidth: { label: '線の太さ', steps: [0, 1, 2, 3, 4, 6], unit: 'px' },
  speed: { label: '動きの速さ', steps: [0.15, 0.25, 0.4, 0.6, 0.9, 1.4], unit: 's' },
  intensity: { label: '動きの強さ', steps: ['ほのか', '控えめ', 'ふつう', 'はっきり', '大きく'] },
};

export const LADDER_ATTRS = Object.keys(LADDER_TABLE) as LadderAttr[];

export const RELATIVE_CHIPS: { delta: -2 | -1 | 1 | 2; label: string }[] = [
  { delta: -2, label: 'ずっと小さく' },
  { delta: -1, label: '少し小さく' },
  { delta: 1, label: '少し大きく' },
  { delta: 2, label: 'ずっと大きく' },
];

/** H2: 相対チップの言葉を属性ごとの会話語にする。 */
export const RELATIVE_WORDS: Record<LadderAttr, { decrease: string; increase: string }> = {
  fontSize: { decrease: '小さく', increase: '大きく' },
  scale: { decrease: '小さく', increase: '大きく' },
  weight: { decrease: '細く', increase: '太く' },
  lineWidth: { decrease: '細く', increase: '太く' },
  spacing: { decrease: '詰める', increase: '広げる' },
  radius: { decrease: '角ばらせる', increase: '丸く' },
  speed: { decrease: '速く', increase: 'ゆっくり' },
  intensity: { decrease: '控えめに', increase: '強く' },
};

/** attr・deltaに合う会話語(例: 「少し小さく」)を返す。 */
export function relativeWordLabel(attr: LadderAttr, delta: number): string {
  const words = RELATIVE_WORDS[attr];
  const word = delta < 0 ? words.decrease : words.increase;
  const prefix = Math.abs(delta) >= 2 ? 'ずっと' : '少し';
  return `${prefix}${word}`;
}

export function stepLabel(def: LadderDef, step: number): string {
  return `${def.steps[step]}${def.unit ?? ''}`;
}

export interface ColorDirection {
  id: string;
  label: string;
  apply: (hsl: [number, number, number]) => [number, number, number];
}

function clampChannel(v: number, max = 100): number {
  return Math.min(max, Math.max(0, v));
}

function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export const COLOR_DIRECTIONS: ColorDirection[] = [
  { id: 'lighter', label: '淡く', apply: ([h, s, l]) => [h, clampChannel(s - 10), clampChannel(l + 12)] },
  { id: 'darker', label: '濃く', apply: ([h, s, l]) => [h, s, clampChannel(l - 12)] },
  { id: 'brighter', label: '明るく', apply: ([h, s, l]) => [h, s, clampChannel(l + 8)] },
  { id: 'dimmer', label: '暗く', apply: ([h, s, l]) => [h, s, clampChannel(l - 8)] },
  { id: 'vivid', label: '鮮やかに', apply: ([h, s, l]) => [h, clampChannel(s + 15), l] },
  { id: 'calm', label: '落ち着かせる', apply: ([h, s, l]) => [h, clampChannel(s - 20), l] },
  { id: 'warm', label: '暖かく', apply: ([h, s, l]) => [wrapHue(h < 210 ? h + 12 : h - 12), s, l] },
  { id: 'cool', label: '冷たく', apply: ([h, s, l]) => [wrapHue(h < 30 ? h + 12 : h - 12), s, l] },
  { id: 'gray', label: 'グレーに近づける', apply: ([h, s, l]) => [h, clampChannel(s - 40), l] },
];

export const COLOR_ROLES: { id: 'text' | 'bg' | 'accent' | 'line'; label: string }[] = [
  { id: 'text', label: '文字' },
  { id: 'bg', label: '背景' },
  { id: 'accent', label: '強調' },
  { id: 'line', label: '線' },
];

export interface FontMood {
  id: string;
  label: string;
  font: string;
  fallback: string;
}

export const FONT_MOODS: FontMood[] = [
  { id: 'quiet-mincho', label: '静かな明朝', font: 'Shippori Mincho', fallback: 'serif' },
  { id: 'clear-gothic', label: 'はっきりゴシック', font: 'Noto Sans JP', fallback: 'sans-serif' },
  { id: 'soft-round', label: 'やわらか丸ゴ', font: 'M PLUS Rounded 1c', fallback: 'sans-serif' },
  { id: 'thin-gothic', label: 'きりっと細ゴシック', font: 'Zen Kaku Gothic New', fallback: 'sans-serif' },
  { id: 'classic-serif', label: 'クラシック・セリフ', font: 'Playfair Display, Shippori Mincho', fallback: 'serif' },
  { id: 'modern-sans', label: 'モダン・サンセリフ', font: 'Inter, Noto Sans JP', fallback: 'sans-serif' },
  { id: 'mono', label: '技術的・等幅', font: 'JetBrains Mono, BIZ UDGothic', fallback: 'monospace' },
  { id: 'display', label: '見出し向き・ディスプレイ', font: 'Dela Gothic One', fallback: 'sans-serif' },
  { id: 'hand', label: '手書き風', font: 'Yomogi', fallback: 'cursive' },
  { id: 'ud', label: '読みやすさ重視', font: 'BIZ UDPGothic', fallback: 'sans-serif' },
];

export interface MotionDef {
  id: string;
  label: string;
}

export const MOTIONS: MotionDef[] = [
  { id: 'fade', label: 'じわっと' },
  { id: 'fade-up', label: '下からふわっと' },
  { id: 'fade-down', label: '上からふわっと' },
  { id: 'slide-left', label: '左からすっと' },
  { id: 'slide-right', label: '右からすっと' },
  { id: 'scale-in', label: '広がって出る' },
  { id: 'pop', label: 'ポンと出る' },
  { id: 'blur-in', label: 'ぼやけから出る' },
  { id: 'wipe', label: '拭うように出る' },
  { id: 'typewriter', label: '一文字ずつ' },
  { id: 'float', label: 'ふわふわ浮く' },
  { id: 'pulse', label: '脈打つ' },
];

export const MOTION_TRIGGERS: { id: 'enter' | 'hover' | 'transition'; label: string }[] = [
  { id: 'enter', label: '登場時' },
  { id: 'hover', label: 'ホバー' },
  { id: 'transition', label: '切り替え' },
];
