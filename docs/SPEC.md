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

/** 取り込んだHTMLページ。srcdocのiframeで表示する(sanitizeHtml済み)。image とは排他。 */
export interface PageSource {
  kind: 'html';
  html: string;        // サニタイズ済みのHTML全文(script/on*属性/javascript:URLを除去済み)
  title?: string;       // <title> の中身
  origin?: string;      // 元URL。ユーザーの任意入力。<base> と出力の見出しに使う
  useBase: boolean;     // true のとき <base href={origin}> を注入する(元サイトへ通信する唯一の経路)
  width: number;        // レンダリングの論理幅。既定 1280
  height: number;       // 読み込み後に実測した高さ
}

export interface Page {
  id: string;
  label?: string;
  image: { dataUrl: string; width: number; height: number } | null;  // 白紙は null
  source?: PageSource;   // HTMLページのときのみ持つ
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

/** 取り込み時点で実測した、出力と反映に使うCSSプロパティ。 */
export type ComputedKey = 'font-size' | 'font-weight' | 'font-family'
  | 'color' | 'background-color' | 'border-color'
  | 'margin' | 'padding' | 'border-radius' | 'border-width';

export interface ElementRef {
  selector: string;        // 一意なCSSセレクタ(id → tag.class → 祖先パス → nth-childの順で解決)
  tag: string;              // 'h1' など小文字のタグ名
  text?: string;             // textContent の先頭40文字
  computed: Partial<Record<ComputedKey, string>>;  // 取り込み時点の実測値
}

export interface Spot {
  id: string;
  pageId: string;
  n: number;              // ①②③ の番号。ページを跨いで通し番号
  label: string;
  rect: Rect;             // 今(白紙・参考では「置きたい位置」。HTMLページでは要素のbounding box)
  targetRect?: Rect;      // こうしたい位置・大きさ。draft のときのみ意味を持つ
  keep: boolean;
  notes: Note[];
  element?: ElementRef;   // HTMLページで要素をクリックして作った箇所のみ持つ。矩形のドラッグ移動は無効になる
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

`Board` から `pages[].image.dataUrl` と `pages[].source.html` を除いたものです(`src/export.ts` の `boardToExportJson`)。
`spots[].element`(セレクタ・実測値)はそのまま含まれます。

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

`imageRole` によって以下の3パターンに分かれます。

| imageRole | 種類 | 箇所の節 |
|---|---|---|
| `draft` | 修正指示(初校に対して) | `## 箇所ごと` に位置・大きさの差分を含めて出力 |
| `reference` | 参考画像に基づく指定 | `## 箇所ごと` に「参考画像①の色 #xxxxxx を強調色に」の形で出力(位置の差分はなし) |
| `null`(白紙) | 制作前の指定 | `## レイアウト` に「① タイトル: 左上(x 8%, y 10%, w 60%, h 12%)」の形で出力 |

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

### HTMLページの出力例

`page.source` があるページでは前置き・ヘッダー・箇所の節が専用の形式に変わります。矩形の`%`座標は
出さず、代わりにCSSセレクタと`getComputedStyle`の実測値(現在→目標)を出します。

```markdown
> 以下はWebページの修正指示です。各項目の `セレクタ` は、対象ページに対するCSSセレクタです。
> 「現在」は取り込み時点の getComputedStyle の実測値です。「変えないもの」は現状維持してください。

# デザイン指示: LP改善案

- 対象: Webページ(https://example.com/)、レンダリング幅 1280px
- 種類: コード修正指示(HTMLページに対して)

## 箇所ごと
### 1 見出し  `.hero > h1`
- 要素: <h1> 「サービスの名前」
- 文字サイズ: 32px → 24px(少し小さく)
- 色: #E4572E → #C94A1D(落ち着かせる)
```

## 番号付き画像

ページごとにPNGを1枚生成します(`renderNumberedImage`)。①②③の墨色バッジ、朱色点線の目標箱、
中心から中心への矢印を元画像解像度で焼き込みます。バッジ径は画像幅の2.5%(最小24px)です。
HTMLページはcanvasに焼けないため、全ページがHTMLのボードではこのタブ自体が表示されません。
