export const SCHEMA = 'ui-collabo/1';

export type Format =
  | { kind: 'web' }
  | { kind: 'slide'; aspect: '16:9' | '4:3' }
  | { kind: 'free' };

// 直したいもの / 参考にしたいもの
export type ImageRole = 'draft' | 'reference';

// 0..1、ボード比
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 取り込んだHTMLページ。srcdocのiframeで表示する(sanitizeHtml済み)。 */
export interface PageSource {
  kind: 'html';
  html: string; // サニタイズ済みのHTML全文
  title?: string; // <title> の中身
  origin?: string; // 元URL。ユーザーの任意入力。<base> と出力の見出しに使う
  useBase: boolean; // true のとき <base href={origin}> を注入する
  width: number; // レンダリングの論理幅。既定 1280
  height: number; // 読み込み後に実測した高さ
}

export interface Page {
  id: string;
  label?: string;
  image: { dataUrl: string; width: number; height: number } | null;
  source?: PageSource; // 追加。undefined なら従来どおりの画像/白紙ページ。image とは排他
}

export type LadderAttr =
  | 'fontSize'
  | 'weight'
  | 'spacing'
  | 'radius'
  | 'scale'
  | 'lineWidth'
  | 'speed'
  | 'intensity';

export type Note =
  | {
      id: string;
      kind: 'ladder';
      attr: LadderAttr;
      current?: number;
      target: { step: number } | { delta: number };
    }
  | {
      id: string;
      kind: 'color';
      role?: 'text' | 'bg' | 'accent' | 'line';
      current?: string;
      target: string;
      via?: string;
    }
  | { id: string; kind: 'font'; mood: string }
  | {
      id: string;
      kind: 'motion';
      motion: string;
      trigger: 'enter' | 'hover' | 'transition';
      speed?: number;
      intensity?: number;
    }
  | { id: string; kind: 'rule'; ruleRef: string }
  | { id: string; kind: 'text'; text: string; chips: string[] };

/** 取り込み時点で実測した、出力と反映に使うCSSプロパティ。 */
export type ComputedKey =
  | 'font-size'
  | 'font-weight'
  | 'font-family'
  | 'color'
  | 'background-color'
  | 'border-color'
  | 'margin'
  | 'padding'
  | 'border-radius'
  | 'border-width';

export interface ElementRef {
  selector: string; // 一意なCSSセレクタ
  tag: string; // 'h1' など小文字のタグ名
  text?: string; // textContent の先頭40文字
  computed: Partial<Record<ComputedKey, string>>; // 取り込み時点の実測値
}

export interface Spot {
  id: string;
  pageId: string;
  n: number;
  label: string;
  rect: Rect;
  targetRect?: Rect;
  keep: boolean;
  notes: Note[];
  element?: ElementRef; // 追加。HTMLページで要素をクリックして作った箇所のみ持つ
}

export interface Rules {
  palette: { role: 'bg' | 'text' | 'accent' | 'sub'; hex: string }[];
  type: { role: 'heading' | 'body' | 'caption'; mood?: string; size?: number }[];
  spacing?: number;
  motion: { trigger: 'enter' | 'hover' | 'transition'; motion: string; speed?: number; intensity?: number }[];
  tone: string[];
}

export function emptyRules(): Rules {
  return { palette: [], type: [], motion: [], tone: [] };
}

export interface Board {
  schema: typeof SCHEMA;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  format: Format;
  imageRole: ImageRole | null;
  pages: Page[];
  spots: Spot[];
  rules: Rules;
  tone: { chips: string[]; text: string };
  order: string[];
}

export interface RuleSet {
  id: string;
  name: string;
  rules: Rules;
  createdAt: string;
}

export interface Library {
  schema: typeof SCHEMA;
  boards: Board[];
  templates: Board[];
  ruleSets: RuleSet[];
}

export function emptyLibrary(): Library {
  return { schema: SCHEMA, boards: [], templates: [], ruleSets: [] };
}

export function newBoard(format: Format): Board {
  const now = new Date().toISOString();
  return {
    schema: SCHEMA,
    id: crypto.randomUUID(),
    title: '無題のボード',
    createdAt: now,
    updatedAt: now,
    format,
    imageRole: null,
    pages: [],
    spots: [],
    rules: emptyRules(),
    tone: { chips: [], text: '' },
    order: [],
  };
}
