# データ仕様

UI ColLabo が扱うデータの構造と、「AIに渡す」で書き出す指示文・JSONの形式です。
実装上の正は [`src/schema.ts`](../src/schema.ts) です。ここでは概要と出力例を示します。

## スキーマID

```
SCHEMA = 'ui-collabo/1'
```

ライブラリの書き出し(`ui-collabo-library.json`)・読み込みは、この値が一致する場合のみ受け付けます。

## データモデル

```ts
export type Format =
  | { kind: 'web' }
  | { kind: 'slide'; aspect: '16:9' | '4:3' }
  | { kind: 'free' };

export type ImageRole = 'draft' | 'reference';   // 直したいもの / 参考にしたいもの

export interface Rect { x: number; y: number; w: number; h: number }  // 0..1、ボード比

export interface Page {
  id: string;
  label?: string;
  image: { dataUrl: string; width: number; height: number } | null;  // 白紙は null
  source?: PageSource;   // HTMLページのときのみ。imageとは排他(HTMLページは image: null)
}

export interface PageSource {
  kind: 'html';
  html: string;             // サニタイズ済みのHTML全文(script等を除去済み)
  title?: string;           // 取り込み時の <title>
  origin?: string;          // 元URL。ブックマークレット経由なら自動、貼り付けなら任意入力
  allowExternal: boolean;   // true のとき外部の画像・フォントの読み込みを許可する
  width: number;            // レンダリングの論理幅。既定 1280
  height: number;           // 読み込み後に実測した高さ
}

export type ComputedKey = 'font-size' | 'font-weight' | 'font-family'
  | 'color' | 'background-color' | 'border-color'
  | 'margin' | 'padding' | 'border-radius' | 'border-width';

export interface ElementRef {
  selector: string;         // 一意なCSSセレクタ
  tag: string;               // 'h1' など小文字のタグ名
  text?: string;              // textContent の先頭40文字
  computed: Partial<Record<ComputedKey, string>>;  // 取り込み時点の実測値
}

export type LadderAttr = 'fontSize' | 'weight' | 'spacing' | 'radius'
  | 'scale' | 'lineWidth' | 'speed' | 'intensity';

export type Note =
  | { id: string; kind: 'ladder'; attr: LadderAttr; current?: number;
      target: { step: number } | { delta: number } }                 // step=絶対段(0始まり), delta=相対段(±1/±2)
  | { id: string; kind: 'color'; role?: 'text' | 'bg' | 'accent' | 'line';
      current?: string; target: string; via?: string }              // via: 方向チップのid(例: 'calm')
  | { id: string; kind: 'font'; mood: string }                       // vocab.ts の FONT_MOODS の id
  | { id: string; kind: 'motion'; motion: string;
      trigger: 'enter' | 'hover' | 'transition'; speed?: number; intensity?: number }
  | { id: string; kind: 'rule'; ruleRef: string }                    // 例: 'type.body.size'、'palette.accent'
  | { id: string; kind: 'text'; text: string; chips: string[] };

export interface Spot {
  id: string;
  pageId: string;
  n: number;              // ①②③ の番号。ページを跨いで通し番号
  label: string;
  rect: Rect;             // 今(白紙・参考では「置きたい位置」)
  targetRect?: Rect;      // こうしたい位置・大きさ。draft のときのみ意味を持つ
  keep: boolean;
  notes: Note[];
  element?: ElementRef;   // HTMLページで要素をクリックして作った箇所のみ持つ
  carried?: boolean;      // R2追加。前回の箇所を再校に持ち越したものか
  check?: 'ok' | 'ng';    // R2追加。carried箇所の照合結果(○直った/×まだ)
}

export interface Rules {
  palette: { role: 'bg' | 'text' | 'accent' | 'sub'; hex: string }[];
  type: { role: 'heading' | 'body' | 'caption'; mood?: string; size?: number }[];
  spacing?: number;       // LADDER_TABLE.spacing の段階インデックス(px値そのものではない)
  motion: { trigger: 'enter' | 'hover' | 'transition'; motion: string;
            speed?: number; intensity?: number }[];
  tone: string[];
}

export interface Board {
  schema: 'ui-collabo/1';
  id: string;
  title: string;
  createdAt: string;      // ISO
  updatedAt: string;
  format: Format;
  imageRole: ImageRole | null;
  pages: Page[];
  spots: Spot[];
  rules: Rules;
  tone: { chips: string[]; text: string };   // 全体のひとこと
  order: string[];        // 見る順(spot id)
  round?: { prevBoardId: string; n: number };  // R2追加。n=2で再校、3で三校
}

export interface RuleSet { id: string; name: string; rules: Rules; createdAt: string }

export interface Library {
  schema: 'ui-collabo/1';
  boards: Board[];
  templates: Board[];     // pages[].image = null のボード
  ruleSets: RuleSet[];
}
```

補足:

- 色ノートの役割(`text`/`bg`/`accent`/`line`)とルールのパレット役割(`bg`/`text`/`accent`/`sub`)は語彙が異なります。「ルールにする」で昇格するときは `line → sub` に対応させます([DECISIONS.md](DECISIONS.md)参照)。
- ラダーの `target.step` は `vocab.ts` の `LADDER_TABLE[attr].steps` への0始まりのインデックスです。`target.delta` は相対チップ(`-2`/`-1`/`1`/`2`)の選択を表します。

## JSON書き出し(「AIに渡す」→ JSON タブ)

`Board` から `pages[].image.dataUrl` と `pages[].source.html`(数百KBになり得る)を除いたものです
(`src/export.ts` の `boardToExportJson`)。HTMLページの `title` / `origin` / `allowExternal` / `width` / `height` は残ります。

```json
{
  "schema": "ui-collabo/1",
  "id": "...",
  "title": "無題のボード",
  "format": { "kind": "slide", "aspect": "16:9" },
  "imageRole": "draft",
  "pages": [{ "id": "...", "image": { "width": 1600, "height": 900 } }],
  "spots": [ /* Spot[] */ ],
  "rules": { /* Rules */ },
  "tone": { "chips": [], "text": "" },
  "order": []
}
```

## 指示文(Markdown)のテンプレート

先頭に前提を1段落固定で入れます。

```markdown
> 以下はデザインの修正指示です。①②③は添付画像上の番号付き領域を指します。
> 位置と大きさは画像の左上を原点とし、画像の幅・高さに対する割合(%)で示します。
> px換算は幅1280px基準です。「変えないもの」は現状維持してください。
```

`imageRole` によって以下の3パターンに分かれます。`board.round` があるボード(照合の再校)は
種類が「修正指示(再校。前回の指示のうち未反映のものを含みます)」に上書きされます。

| imageRole | 種類 | 箇所の節 |
|---|---|---|
| `draft` | 修正指示(初校に対して) | `## 箇所ごと` に位置・大きさの差分を含めて出力 |
| `reference` | 参考画像に基づく指定 | `## 箇所ごと` に「参考画像①の色 #xxxxxx を強調色に」の形で出力(位置の差分はなし) |
| `null`(白紙) | 制作前の指定 | `## レイアウト` に「① タイトル: 左上(x 8%, y 10%, w 60%, h 12%)」の形で出力 |

補足(S9・S10・R2):

- ノートがなく、位置の差分もない箇所(囲っただけ)は `## 箇所ごと` に出しません(白紙の
  `## レイアウト` は対象外。位置そのものが内容のため)
- ページが2枚以上のボードは、箇所を `## p.1` / `## p.2` の見出しでページごとに分けます。
  ヘッダーの対象・種類は1枚目だけでなく全ページを見て組み立てます
- 照合(`board.round` あり)で `check: 'ok'` の箇所は `## 変えないもの` に
  「(前回修正済み)」を添えて出力します。`carried: true` で `check !== 'ok'` の箇所は
  見出し行に「(前回も指示・未反映)」を添えます

## 指示文の行(`boardToLines`)

`boardToMarkdown` は内部で `boardToLines(board): Line[]` を呼び、その `text` を連結しているだけです
(`src/export.ts`)。`Line` は指示書(Sheet)の画面表示にも使われます。

```ts
export interface Line {
  text: string;
  spotId?: string;   // この行が対応する箇所
  noteId?: string;   // この行を作ったノート(ある場合)
  pageId?: string;   // ページ見出し行(`## p.N`)のみ
}
```

修正指示(`draft`)の出力例:

```markdown
# デザイン指示: 提案書 p.3

- 対象: スライド(16:9)、画像サイズ 1600×900
- 種類: 修正指示(初校に対して)

## 基準ルール
- 色: 強調 #E4572E
- 文字: 見出し=はっきりゴシック 32px
- 余白: 基準 24px
- トーン: 静かに、整然と

## 全体
- ひとこと: 「全体的に要素が大きく、窮屈」
- 見る順: 1 見出し → 3 グラフ → 2 本文

## 箇所ごと
### 1 見出し(x 8%, y 12%, w 60%, h 10%)
- 位置: 上へ 4%(12% → 8%)
- 文字サイズ: 少し小さく
- 色: #E4572E → #C94A1D(落ち着かせる)
- ひとこと: 「ここだけ主張が強い」

### 2 本文(x 8%, y 30%, w 50%, h 40%)
- ルール: 本文の文字サイズ(16px)とズレている。ルールに合わせる

### 3 グラフ(x 62%, y 28%, w 32%, h 50%)
- 大きさ: 幅 32% → 36%(約1.1倍)
- 動き: 登場時に「下からふわっと」(fade-up)、速さ 0.4s

## 変えないもの
- 4 ロゴ
```

## 校正紙・番号付き画像

「AIに渡す」1回目のクリップボード画像と、書き出しドロワーの既定は**校正紙**(`renderProofSheet`、
R3)です。元画像の右に和紙色の余白(幅の45%、最小480px)を足し、箇所ごとに①②③の見出しと
赤字の指示文を並べ、箇所の右辺から引き出し線を引きます。画像1枚だけをAIに渡しても、箇所と
指示の両方が読めます。末尾に「変えないもの」も書きます。

従来の**番号付き画像**(`renderNumberedImage`)は書き出しドロワーで選べます。①②③の墨色バッジ、
朱色点線の目標箱、中心から中心への矢印を元画像解像度で焼き込みます。バッジ径は画像幅の2.5%
(最小24px)です。

どちらもHTMLページはcanvasに焼けないため対象外です(`board.pages.every((p) => !p.image)` のとき、
書き出しの画像タブ自体を出しません)。

## HTMLページの指示文

`page.source` があるページでは、前置き・ヘッダー・箇所の節がすべて専用の形式に変わります。
`spot.element` を持つ箇所は、`rect` の%表記の代わりにCSSセレクタと実測値を使います。

```markdown
> 以下はWebページの修正指示です。各項目の `セレクタ` は、対象ページに対するCSSセレクタです。
> 「現在」は取り込み時点の getComputedStyle の実測値です。
> 「変えないもの」は現状維持してください。

# デザイン指示: サービス紹介ページ

- 対象: Webページ(https://example.com/)、レンダリング幅 1280px
- 種類: コード修正指示(HTMLページに対して)

## 箇所ごと
### 1 見出し  `.hero > h1`
- 要素: <h1> 「サービスの名前」
- 文字サイズ: 32px → 24px(少し小さく)
- 色: #e4572e → #c94a1d(落ち着かせる)
```

ラダーの `現在値 → 目標値` は `resolveLadder`(`src/lib/htmlCss.ts`)が、`element.computed` の実測値から
最も近い段を探し、`delta` を足して解決します。`scale` / `speed` / `intensity` のように実測CSSへの
対応がないラダー属性は、通常の画像ページと同じ相対ラベル表記(「少し小さく」など)にフォールバックします。
