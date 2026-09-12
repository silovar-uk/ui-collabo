# HTMLページ取り込み計画 — 「特定のページを、要素単位で指す」

- 作成日: 2026-09-07
- 作成: Claude Opus 5(計画のみ。コードは変更していません)
- 実装担当: Claude Sonnet(この文書を読んで実装する)
- 対象: `silovar-uk/ui-collabo` v0.1.0
- 前提文書: [PLAN.md](PLAN.md)、[PLAN-UI.md](PLAN-UI.md)、[docs/SPEC.md](docs/SPEC.md)、[docs/DECISIONS.md](docs/DECISIONS.md)

---

## 0. Sonnetへ: この文書の読み方

- 第1章が前提です。**なぜこの形なのか**、特に「なぜURL欄を作らないのか」が書いてあります。実装前に必ず読んでください
- 第2章がデータモデルの拡張です。**既存ボードを壊さない後方互換の追加**だけをします。`SCHEMA` の値は `ui-collabo/1` のまま変えません
- 第4章がフェーズです。**A→B→C→D→E の順に実装**してください。各フェーズの受け入れ基準を満たしてから次へ進みます
- AとBが土台です。時間が足りない場合はDを削ってください。Dを削ってもCまでで機能として成立します
- **Eは実質的な「URLから取り込む」経路です。**Aの貼り付け欄だけでは外部CSSが効かず実用になりません(1.2.1)。
  DとEのどちらかしか入らない場合はEを選んでください
- 第5章に「やらないこと」があります。ここに書いてあることは実装しないでください
- 新しい依存パッケージは追加しません。preactと標準APIだけで完結します
- 判断で埋めた穴は、これまでどおり [docs/DECISIONS.md](docs/DECISIONS.md) に1行ずつ残してください

### 着手前の作業

1. [PLAN-UI.md](PLAN-UI.md) の未コミット分をコミットしてください。この計画はその上に積みます
2. `feat/html-page` ブランチを切ってください

---

## 1. 前提

### 1.1 やりたいこと

いまのUI ColLaboは、スクリーンショットに矩形を描いて「①(x 8%, y 12%)の文字サイズを少し小さく」という
指示文を作ります。渡す先は画像を見るAIです。

この計画で足すのは、**実際のHTMLページを取り込み、その中の要素をクリックして指す**という経路です。
出力はこう変わります。

```markdown
### 1 見出し  `.hero > h1`
- 要素: <h1> 「サービスの名前」
- 文字サイズ: 32px → 24px(少し小さく)
- 色: #E4572E → #C94A1D(落ち着かせる)
```

セレクタと実測値が入るため、渡す先が**コードを書くAI**になります。これがこの機能の値打ちです。

### 1.2 なぜURL入力欄を作らず、ブックマークレットを配るのか

**結論: ブラウザだけでは、他サイトのURLから中身を読むことが原理的にできないためです。
代わりに、対象ページ側で1回押すブックマークレットを配ります。**

| 手段 | 結果 |
|---|---|
| `fetch(url)` でHTMLを取得 | CORSで拒否される。相手がヘッダーを付けていない限り不可能 |
| `<iframe src={url}>` で表示 | 多くのサイトが `X-Frame-Options` / CSP `frame-ancestors` で拒否する |
| 表示できた場合に中を読む | クロスオリジンのため `contentDocument` が `null` になる。要素選択もスタイル取得もできない |

自分のローカル開発サーバー(`http://localhost:5173`)も、`silovar-uk.github.io` から見ればクロスオリジンです。
同じ理由で読めません。

これを回避するにはプロキシサーバーかブラウザ拡張が必要で、
READMEに掲げた「AI・チャット・サーバー通信なし。すべてブラウザ内で完結」という設計原則を壊します。
したがって**URL欄は作りません**。

そのかわり、**対象ページの上で実行するブックマークレット**を配ります(フェーズE)。
対象ページを開いてボタンを1回押すと、レンダリング済みのDOMと適用中のCSSがクリップボードに入ります。
あとは取り込みダイアログに貼るだけです。操作は3手で、体感はURL貼り付けとほぼ同じです。

| | URL欄(不採用) | ブックマークレット(採用) |
|---|---|---|
| 通信 | プロキシ経由で第三者にURLが渡る | ゼロ。すべて閲覧者のブラウザ内 |
| CSS | 相手のCSSは別途取得が必要 | 適用中のCSSをそのまま持ち出せる |
| 認証が要るページ | 取得できない | ログイン済みの画面をそのまま取り込める |
| `file://` のローカルHTML | 取得できない | 取り込める |
| 実装 | プロキシの選定・障害対応が続く | 50行のスニペットを1枚置くだけ |

### 1.2.1 生のHTMLを貼るだけでは足りない理由

ブックマークレットは「URLの代わり」であると同時に、**貼り付け経路そのものの前提でもあります**。

実務で扱うHTMLは、たいてい `<link rel="stylesheet" href="/app.css">` のように外部CSSを参照しています。
このソースをそのまま貼っても、`/app.css` は解決できず、スタイルの当たっていない素のテキストが並ぶだけです。
それではデザインレビューになりません。

したがって取り込みダイアログには、**貼り付け欄と並べてブックマークレットの導線を必ず置いてください**(4.E)。
生のHTMLを貼る経路も残しますが、それは「CSSが `<style>` で埋まっている単一ファイル」向けの副経路です。

### 1.3 なぜ「HTMLを持ち込む」なら動くのか

`srcdoc` を使ったiframeは、**親ドキュメントのオリジンを継承します**。
`sandbox="allow-same-origin"` を付ければ、親のスクリプトから `iframe.contentDocument` に完全にアクセスできます。

- クリックされた実要素が取れる → CSSセレクタを生成できる
- `getComputedStyle(el)` が取れる → `font-size: 32px`、`color: rgb(228, 87, 46)` などの実測値が読める
- 親から `<style>` を1枚挿せる → 指定内容をその場で当てて、ビフォー/アフターを見せられる

サーバーは一切不要で、READMEの原則も守れます。

### 1.4 安全性の前提

**`sandbox` に `allow-scripts` を絶対に付けないでください。**

- `allow-same-origin` だけを付けます。これでスクリプトは1行も実行されず、静的なレンダリングだけが得られます
- `allow-scripts` と `allow-same-origin` を両方付けると、iframeが自力でsandbox属性を外せてしまい、sandboxが無意味になります
- 加えて、取り込み時に `<script>` 要素と `on*` 属性、`javascript:` で始まるURLを除去します(二重防御)

親のスクリプトからiframeのDOMを操作することは、sandboxの制限を受けません。読み書きは問題なくできます。

### 1.5 外部リソースの扱い(meta CSP で1行制御する)

貼り付けられたHTMLに外部の画像・CSS・フォントが残っていると、**表示した瞬間にそのサーバーへ通信が飛びます**。
READMEの「どこにも送信されません」という約束に触れるため、既定では遮断します。

遮断は `<base>` の有無ではなく、**srcdocに注入する `<meta http-equiv="Content-Security-Policy">` 1行**で行います。
sandbox属性とは独立に効き、画像・フォント・`@import` をまとめて止められます。

```html
<!-- 既定(外部リソースを読み込まない) -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">

<!-- 「外部リソースを読み込む」がオンのとき -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none'; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:">
```

- 取り込みダイアログに「外部の画像・フォントを読み込む(元サイトへ通信します)」というチェックボックスを1つ置き、
  `source.allowExternal` に保存します。既定はオフです
- ブックマークレット経由で取り込んだHTMLは、CSSがすでにインライン化され、
  `src` / `href` も絶対URLに書き換わっています。したがってオフのままでもレイアウトはほぼ再現されます。
  読み込まれないのは画像とWebフォントだけです
- `<base>` は注入しません。ブックマークレット側で絶対URL化が済んでいるため不要です
- READMEのデータの扱いの節に、このチェックをオンにしたときだけ通信する旨を1文追記します

### 1.6 いまのコードの前提

| 場所 | 現状 |
|---|---|
| [src/schema.ts](src/schema.ts) | `Page.image` が `null`(白紙)か `{dataUrl, width, height}`(画像)の二択。DOMの概念はない |
| [src/lib/intake.ts](src/lib/intake.ts) | `handleFiles(files)` が唯一の取り込み口。ここに並べる形で足せる |
| [src/board/Board.tsx](src/board/Board.tsx) | 画像/白紙の上に矩形を描く。`page.image` の有無で分岐している |
| [src/export.ts](src/export.ts) | `%` 座標ベースのMarkdownを組み立てる。`imageRole` で3パターンに分岐 |
| [src/vocab.ts](src/vocab.ts) | ラダー(段階表)・色の方向・フォントの雰囲気・動きの語彙。**この語彙はそのまま流用します** |

### 1.7 検証済みの前提

この計画の技術的な土台は、`https://silovar-uk.github.io/ui-collabo/` 上で実際に確認してあります。
実装中に疑わしくなったら、同じ手順で再確認してください。

| 確認したこと | 結果 |
|---|---|
| 同一オリジンの `styleSheets[].cssRules` を読む | 取得できる(実測 171ルール / 18KB) |
| クロスオリジンの `cssRules` を読む | `SecurityError`。`@import url(...)` へのフォールバックが要る |
| `srcdoc` + `sandbox="allow-same-origin"` の `contentDocument` | 親から読み書きできる |
| そのiframe内の `<script>` | 実行されない(`window.__pwned` が未定義のまま) |
| `getComputedStyle` の実測値 | `font-size: 32px` / `color: rgb(228, 87, 46)` を取得できる |
| 親から `<style>` を足して上書きする | `32px → 24px` に反映される(フェーズDの土台) |
| meta CSP による外部画像の遮断 | ブロックされる(`naturalWidth === 0`) |

---

## 2. データモデルの拡張

`SCHEMA` は `ui-collabo/1` のままです。すべて省略可能なフィールドの追加なので、既存のボードもライブラリJSONもそのまま読めます。

### 2.1 `PageSource` の追加

```ts
// src/schema.ts
export interface PageSource {
  kind: 'html';
  html: string;        // サニタイズ済みのHTML全文
  title?: string;      // <title> の中身
  origin?: string;         // 元URL。ブックマークレット経由なら自動、貼り付けなら任意入力。出力の見出しに使う
  allowExternal: boolean;  // true のとき外部の画像・フォントの読み込みを許可する(1.5参照)
  width: number;       // レンダリングの論理幅。既定 1280
  height: number;      // 読み込み後に実測した高さ
}

export interface Page {
  id: string;
  label?: string;
  image: { dataUrl: string; width: number; height: number } | null;
  source?: PageSource;   // ← 追加。undefined なら従来どおりの画像/白紙ページ
}
```

`image` と `source` は排他です。HTMLページでは `image: null`、`source` あり、とします。

### 2.2 `ElementRef` の追加

```ts
// src/schema.ts
/** 取り込み時点で実測した、出力と反映に使うCSSプロパティ。 */
export type ComputedKey =
  | 'font-size' | 'font-weight' | 'font-family'
  | 'color' | 'background-color' | 'border-color'
  | 'margin' | 'padding' | 'border-radius' | 'border-width';

export interface ElementRef {
  selector: string;                               // 一意なCSSセレクタ
  tag: string;                                    // 'h1' など小文字のタグ名
  text?: string;                                  // textContent の先頭40文字
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
  element?: ElementRef;   // ← 追加。HTMLページで要素をクリックして作った箇所のみ持つ
}
```

`rect` は要素のbounding boxから自動で埋めます(番号バッジの表示位置に使う)。
`element` を持つ箇所では、**ユーザーが矩形をドラッグして動かすことはできません**(3.5参照)。

### 2.3 ノートは増やしません

色・文字の雰囲気・ラダー・動き・ひとこと・ルールという既存6種類をそのまま使います。
新しいノート種別は追加しません。ラダーの各属性がどのCSSプロパティに対応するかだけ、表で定義します。

| ラダー属性 | CSSプロパティ | 備考 |
|---|---|---|
| `fontSize` | `font-size` | stepsがそのままpx値 |
| `weight` | `font-weight` | stepsがそのまま数値 |
| `spacing` | `margin` | 「位置を動かす」もこれで表現します(3.5参照) |
| `radius` | `border-radius` | `'full'` は `9999px` |
| `lineWidth` | `border-width` | |
| `scale` | (なし) | 出力にのみ載せ、プレビューには反映しません |
| `speed` / `intensity` | (なし) | 動きノートの付随値。反映しません |

| 色ノートの役割 | CSSプロパティ |
|---|---|
| `text` | `color` |
| `bg` | `background-color` |
| `accent` | `color` |
| `line` | `border-color` |

| その他のノート | CSSプロパティ |
|---|---|
| 文字の雰囲気(`font`) | `font-family`(`FONT_MOODS` の `font` と `fallback` を連結) |
| 動き(`motion`) | (なし。出力にのみ載せる) |

---

## 3. 設計

### 3.1 取り込み([src/lib/intake.ts](src/lib/intake.ts) に追加)

```ts
export async function handleHtml(html: string, opts: { origin?: string; allowExternal: boolean }): Promise<void>
```

やること。

1. `sanitizeHtml(html)` を通す(3.2)
2. `<title>` を抜き、ボードのタイトルの初期値にする
3. ボードがなければ `createBoard({ kind: 'web' })` する
4. `pages` に `{ id, image: null, source: {...} }` を足す
5. `imageRole` を `'draft'` に自動設定する(HTMLページは常に「直したいもの」であるため。
   [src/app.tsx](src/app.tsx) の「この画像は?」プロンプトは出しません)
6. `activePageId` を新しいページにする

**入り口は3つだけにします。**

- ブックマークレットでコピーした内容を、ダイアログ内の `<textarea>` に貼る(主経路。フェーズE)
- `.html` / `.htm` ファイルのドロップ、およびファイル選択(既存のドロップ処理に拡張子で分岐を足す)
- 自分で用意したHTMLソースを同じ `<textarea>` に貼る(副経路。1.2.1のとおり外部CSSは効きません)

3つとも入り口は同じ `handleHtml` です。ブックマークレット用の別処理は作りません。
`<meta name="uic-origin">` があればその値を `source.origin` の初期値にし、無ければ空のままにします。

**`paste` イベントで `text/html` を自動的に拾ってはいけません。** ブラウザから普通の文章をコピーすると
クリップボードには常に `text/html` が入るため、通常のテキスト貼り付けを乗っ取ってしまいます。
貼り付けは、専用の `<textarea>` の中に限定します。

### 3.2 サニタイズ(`src/lib/html.ts` 新規)

```ts
export function sanitizeHtml(raw: string): { html: string; title?: string }
```

`DOMParser` でパースし、以下を除去してから `documentElement.outerHTML` を返します。

- `script`、`iframe`、`object`、`embed` 要素
- すべての `on*` 属性
- `href` / `src` / `action` が `javascript:` で始まる属性

`DOMParser` でパースした文書はスクリプトを実行しないため、この処理自体は安全です。

### 3.3 表示(`src/board/HtmlBoard.tsx` 新規)

[src/board/Board.tsx](src/board/Board.tsx) は触りません。`page.source` があるときだけ `HtmlBoard` を出す分岐を
[src/app.tsx](src/app.tsx) に1行足します。

```tsx
<iframe
  class="html-frame"
  srcdoc={frameHtml}
  sandbox="allow-same-origin"
  style={{ width: source.width, height: source.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
/>
```

- `frameHtml` は `source.html` に、1.5のCSP metaを(`allowExternal` の値で出し分けて)、
  常に `<style id="uic-preview"></style>`(3.6用の空タグ)と `<style id="uic-hover"></style>`(ホバー枠用)を
  `<head>` の末尾へ足したもの
- 論理幅は `source.width`(既定1280px)固定でレンダリングし、`transform: scale()` でボード欄に収めます。
  こうすると指示文に載る `font-size` の実測値が、閲覧環境の幅に左右されません
- `onLoad` で `contentDocument.documentElement.scrollHeight` を測り、`source.height` に書き戻します

番号バッジと選択枠は、iframeの**上に重ねた絶対配置のオーバーレイ**として描きます(iframeの中には描きません)。
座標は各 `spot.rect` を `scale` 倍したものです。既存の [src/board/SpotRect.tsx](src/board/SpotRect.tsx) の
見た目をそのまま流用してください。

### 3.4 要素の選択(`src/lib/domPick.ts` 新規)

iframeの中ではスクリプトが動かないので、**親からリスナーを付けます**。

```ts
export function attachPicker(doc: Document, onPick: (el: Element) => void): () => void
```

- `mouseover` で `#uic-hover` の中身を `${selector} { outline: 2px solid #E4572E !important; }` に書き換える
- `click` で `onPick(e.target)` を呼び、`preventDefault()` する
- 戻り値でリスナーを外す

`html` / `body` はクリック対象から除外します。

```ts
export function uniqueSelector(el: Element): string
```

以下の順で試し、`doc.querySelectorAll(candidate).length === 1` になった時点で確定します。

1. `#id`(idがあり、CSS識別子として妥当な場合)
2. タグ名 + 単独のclass(`h1.title`)。classが複数ある場合は1つずつ試す
3. 祖先をたどって `親セレクタ > 子セレクタ` を組み立て、最後の手段として `:nth-child(n)` を足す

上限は5階層とし、それでも一意にならない場合は `:nth-child` を全階層に付けた完全パスを返します。

```ts
export function readComputed(el: Element): Partial<Record<ComputedKey, string>>
```

`getComputedStyle` から2.2の `ComputedKey` を読み、色は `rgb(...)` を `#rrggbb` に正規化します
(既存の [src/lib/color.ts](src/lib/color.ts) に使える変換があれば流用し、無ければそこに足します)。

### 3.5 箇所の作成

要素をクリックしたときの動きです。

1. `uniqueSelector` と `readComputed` を実行する
2. `el.getBoundingClientRect()` をiframeの論理サイズで割り、0〜1の `rect` にする
3. `label` の初期値を、テキストがあれば先頭20文字、なければタグ名にする
4. `Spot` を作り、`element` を埋めて `selectedSpotId` にする

同じセレクタの箇所が既にある場合は、新規作成せずその箇所を選択します。

**HTMLページでは矩形のドラッグ操作をすべて無効にします。**
`element` は要素に紐づいているため、箱を動かしても意味がありません。
[src/lib/spotTarget.ts](src/lib/spotTarget.ts) の `getSpotEditTarget` に、`spot.element` があれば
`apply` が何もしない分岐を足してください。右パネルの位置チップ(上/下/左/右・中央そろえ)も、
`spot.element` があるときは非表示にします。

位置を動かしたい場合は、既存のラダー `spacing`(= `margin`)を使ってもらいます。
「余白を少し大きく」が「その分ずれる」という指示になります。

### 3.6 その場反映(`src/lib/htmlCss.ts` 新規)

```ts
export function spotsToCss(spots: Spot[]): string
```

`element` を持つ箇所のノートを、2.3の対応表に従ってCSS宣言に変換し、
`selector { prop: value; ... }` の形で連結して返します。

ラダーの解決手順(これがこの機能の中心です)。

```
1. note.target が { step } なら LADDER_TABLE[attr].steps[step] をそのまま採用する
2. note.target が { delta } なら:
   a. element.computed から現在値を取り、数値(px)を抜く
   b. LADDER_TABLE[attr].steps の中で最も近い段のインデックスを探す
   c. そこへ delta を足し、配列の範囲にクランプする
   d. その段の値を採用する
3. 単位は LADDER_TABLE[attr].unit を付ける('full' は '9999px' に置き換える)
```

この「現在値から最も近い段を探してdeltaを足す」ロジックは出力(3.7)でも同じものを使うので、
`resolveLadder(attr, note, computed): { from: string; to: string } | null` として1か所に切り出してください。

反映は、`contentDocument.getElementById('uic-preview').textContent = css` の1行です。

ビフォー/アフターの切り替えは、その `<style>` 要素の `disabled` プロパティを切り替えるだけにします。
ボード欄の右上にトグルを1つ置いてください(ラベル: 「いま」/「こうしたい」)。既定は「こうしたい」です。

ノートが変わるたびに `spotsToCss` を呼び直します(signalsで `currentBoard` を購読すれば自然にそうなります)。

### 3.7 出力([src/export.ts](src/export.ts) の変更)

`boardToMarkdown` に、HTMLページ用の分岐を足します。既存の3パターンの出力は一切変えません。

**前置き**(`page.source` があるページを含む場合、`PREAMBLE` を差し替える):

```
> 以下はWebページの修正指示です。各項目の `セレクタ` は、対象ページに対するCSSセレクタです。
> 「現在」は取り込み時点の getComputedStyle の実測値です。
> 「変えないもの」は現状維持してください。
```

**ヘッダー**:

```markdown
# デザイン指示: {board.title}

- 対象: Webページ{originがあれば ({origin})}、レンダリング幅 1280px
- 種類: コード修正指示(HTMLページに対して)
```

**箇所の節**(`spotSection` に `spot.element` がある場合の分岐を足す):

```markdown
### 1 見出し  `.hero > h1`
- 要素: <h1> 「サービスの名前」
- 文字サイズ: 32px → 24px(少し小さく)
- 色: #E4572E → #C94A1D(落ち着かせる)
- 文字の雰囲気: 静かな明朝(Shippori Mincho)
- 動き: 登場時に「下からふわっと」(fade-up)、速さ 0.4s
- ひとこと: 「ここだけ主張が強い」
```

- 矩形の `(x 8%, y 12%, w 60%, h 10%)` は**出しません**。セレクタがあるため不要です
- ラダーと色は `現在値 → 目標値(語彙のラベル)` の形にします。現在値が取れない場合は目標値だけを出します
- `## レイアウト` と `positionLines` はHTMLページでは呼びません

**JSON書き出し**(`boardToExportJson`):

`pages[].source.html` を除外してください(数百KBになり得ます)。
`title` / `origin` / `width` / `height` は残します。`spots[].element` はそのまま含めます。

**番号付き画像タブ**:

HTMLページはcanvasに焼けないため、[src/panels/ExportDrawer.tsx](src/panels/ExportDrawer.tsx) の
「番号付き画像」タブを、`board.pages.every((p) => !p.image)` のときは表示しないようにします。

---

## 4. フェーズ

### フェーズA — 取り込んで表示する

**やること**

- `PageSource` を [src/schema.ts](src/schema.ts) に追加
- `src/lib/html.ts` に `sanitizeHtml`
- [src/lib/intake.ts](src/lib/intake.ts) に `handleHtml`
- `.html` / `.htm` のドロップ対応(既存のドロップ処理に拡張子で分岐)
- 「HTMLを読み込む」ダイアログ(textarea + 元URLの任意入力 + 「元のCSSも読み込む」チェック)。
  [src/panels/Empty.tsx](src/panels/Empty.tsx) とトップバーの両方から開けるようにする
- `src/board/HtmlBoard.tsx`(iframe表示とスケーリング、高さの実測)
- [src/app.tsx](src/app.tsx) で `page.source` があれば `HtmlBoard` を出す分岐

**受け入れ基準**

- 適当なWebページのHTMLソースを貼り付けると、ボード欄にそのページが表示される
- `<script>` が除去され、コンソールにスクリプト由来のエラーが出ない
- ページを再読み込みしても、IndexedDBから復元されて同じ表示になる
- 既存の画像ボード・白紙ボードの挙動が一切変わっていない

### フェーズB — 要素をクリックして箇所を作る

**やること**

- `src/lib/domPick.ts`(`attachPicker` / `uniqueSelector` / `readComputed`)
- `ElementRef` を [src/schema.ts](src/schema.ts) に追加
- `HtmlBoard` でホバー枠とクリックによる箇所作成
- 番号バッジと選択枠のオーバーレイ
- [src/lib/spotTarget.ts](src/lib/spotTarget.ts) に `element` があれば `apply` を無効化する分岐
- [src/panels/SpotPanel.tsx](src/panels/SpotPanel.tsx) で `element` があるとき、位置チップを隠し、
  代わりにセレクタと現在値を上部に表示する

**受け入れ基準**

- 見出しをクリックすると箇所が1つでき、右パネルにセレクタと `font-size` などの現在値が出る
- 同じ要素を2回クリックしても箇所が重複せず、既存の箇所の選択に切り替わる
- 生成されたセレクタが、そのページ内で一意である(ブラウザの開発者ツールで確認する)
- 箱をドラッグしても何も動かない

### フェーズC — 出力する

**やること**

- `src/lib/htmlCss.ts` に `resolveLadder`
- [src/export.ts](src/export.ts) のHTMLページ分岐(前置き・ヘッダー・箇所の節)
- `boardToExportJson` から `source.html` を除外
- [src/panels/ExportDrawer.tsx](src/panels/ExportDrawer.tsx) の画像タブの出し分け
- `test/htmlCss.test.ts` に `resolveLadder` のテスト
  (現在 `32px` に `delta: -1` で `24px`、範囲外へのクランプ、現在値なしで `null`)
- `test/domPick.test.ts` に `uniqueSelector` のテスト(id優先、class、`:nth-child` へのフォールバック)

**受け入れ基準**

- 「AIに渡す」の指示文が、セレクタと `現在値 → 目標値` の形で出る
- JSONに `html` 本文が含まれず、`element` が含まれる
- 既存の画像ボードの出力が1文字も変わっていない(既存の [test/export.test.ts](test/export.test.ts) が通る)
- `npm run build` と `npm test` が通る

### フェーズD — その場に反映する

**やること**

- `src/lib/htmlCss.ts` に `spotsToCss`
- `HtmlBoard` で `#uic-preview` への書き込み
- ボード欄右上の「いま / こうしたい」トグル

**受け入れ基準**

- 「文字サイズを少し小さく」を選ぶと、プレビューの見出しが実際に小さくなる
- 「いま」に切り替えると元の見た目に戻り、もう一度切り替えると反映後に戻る
- ノートを削除すると、反映も消える
- 反映のCSSがボードのデータに保存されていない(表示だけの派生物である)

---

### フェーズE — ブックマークレットで持ち込む

これが実質的な「URLから取り込む」経路です。AとBが動いてから着手してください。

**やること**

- `public/bookmarklet.js` に元コードを置く(可読な形。下記)
- `scripts/render-assets.mjs` と同じ要領で、ビルド時に最小化して1行の `javascript:` URLへ変換する。
  難しければ手作業で1回作り、`src/bookmarklet.ts` に文字列定数として持っても構いません
- 取り込みダイアログの上部に、その `javascript:` URLを `href` に持つ `<a>` を置く。
  ラベルは「ページを取り込む」、直下に「↑ このボタンをブックマークバーにドラッグしてください」と添える
- 手順を3行で書く: ①対象ページを開く ②ブックマークバーの「ページを取り込む」を押す ③ここに貼る(Ctrl+V)

**元コード**(動作確認済み。これをそのまま使ってください)

```js
javascript: (async () => {
  const abs = (u) => { try { return new URL(u, location.href).href; } catch { return u; } };

  // 適用中のCSSをすべて文字列にする。読めないシート(クロスオリジン)は @import で残す
  const css = [...document.styleSheets].map((s) => {
    try { return [...s.cssRules].map((r) => r.cssText).join('\n'); }
    catch { return s.href ? `@import url("${s.href}");` : ''; }
  }).join('\n');

  const root = document.documentElement.cloneNode(true);
  root.querySelectorAll('script, link[rel~="stylesheet"], style').forEach((e) => e.remove());
  root.querySelectorAll('[src], [href]').forEach((e) => {
    for (const a of ['src', 'href']) if (e.hasAttribute(a)) e.setAttribute(a, abs(e.getAttribute(a)));
  });

  const head = root.querySelector('head') || root;
  const style = document.createElement('style');
  style.textContent = css;
  head.appendChild(style);

  const meta = document.createElement('meta');
  meta.setAttribute('name', 'uic-origin');
  meta.setAttribute('content', location.href);
  head.prepend(meta);

  const out = '<!doctype html>\n' + root.outerHTML;
  try {
    await navigator.clipboard.writeText(out);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = out;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  alert(`UI ColLabo: ${Math.round(out.length / 1024)} KB をコピーしました`);
})();
```

**設計の要点**

| なぜそうするのか | |
|---|---|
| `cloneNode(true)` を使う | 対象ページのDOMを一切書き換えないため。閲覧中のページを壊さない |
| `styleSheets` から集める | `<link>` を残すと取り込み側で外部通信が発生する。`cssText` なら文字列として持ち出せる |
| 読めないシートを `@import` にする | クロスオリジンのシートは `cssRules` が `SecurityError` になる(1.7)。指定が消えたことを伝えるため空にせず `@import` で残す。既定のCSPが止めるので、そのままでは通信しない |
| `src` / `href` を絶対URL化する | 相対パスのままだと取り込み側で解決できない。`<base>` を注入するより副作用が小さい |
| `<meta name="uic-origin">` を足す | 取り込み側で元URLを自動で埋めるため。ユーザーが手で貼り直す必要をなくす |
| `script` を落とす | 取り込み側でも `sanitizeHtml` が落としますが、クリップボードに実行可能なコードを載せない方が安全です |
| DOMではなく `outerHTML` を渡す | クリップボードはテキストしか運べないため。レンダリング後のDOMなので、SPAの描画結果もそのまま入る |

**制約(ダイアログに1行書いてください)**

- クロスオリジンのCSS(Webフォントなど)は仕様上読み出せません。フォントの見た目は再現されないことがあります
- `<canvas>` の描画内容、擬似要素で入れた画像、`::before` の背景画像などは持ち出せません
- ページが巨大だと数MBになります。1MBを超えたらダイアログに「重いページです」と注意を出してください

**受け入れ基準**

- ブックマークレットを任意のページで実行し、UI ColLaboに貼ると、**そのページの見た目のまま**表示される
- `source.origin` が、貼っただけで元URLに埋まっている
- 「外部の画像・フォントを読み込む」がオフのとき、開発者ツールのネットワークタブに外部への通信が1本も出ない
- オンにすると画像が表示される
- ログインが必要な自分のページ、および `file://` で開いたローカルのHTMLでも取り込める

---

## 5. やらないこと

ここに書いてあるものは実装しないでください。

| やらないこと | 理由 |
|---|---|
| URL入力欄・プロキシサーバー | 1.2のとおり。サーバーなしの原則を壊す。ブックマークレットで代替する |
| フォルダごとの読み込み(File System Access API) | Chrome/Edge限定になる。まずは貼り付けで足りる |
| ブラウザ拡張の配布 | ブックマークレット(フェーズE)で足りる。審査と更新の手間に見合わない |
| ブックマークレットでの画像のdataURL化 | ページによっては数十MBになる。画像はCSPで止めるか、オンにして元サイトから読む |
| `sandbox` に `allow-scripts` を付ける | 1.4のとおり。sandboxが無意味になる |
| CSS差分の書き出しタブ | READMEの非目標「実デザインの編集・書き出し」に踏み込む |
| HTMLページの番号付き画像 | canvasに焼けない。html2canvas等の依存追加はしない |
| HTMLページでの矩形ドラッグによる位置指定 | 3.5のとおり。`spacing` ラダーで代替する |
| 新しいノート種別・新しいピッカー | 既存の語彙([src/vocab.ts](src/vocab.ts))で足りる |
| 新しい依存パッケージ | preactと標準APIだけで完結する |
| 複数HTMLページの同時表示 | 既存のページ切り替え(`page-strip`)に乗せるだけにする |

---

## 6. 補足: 更新するドキュメント

実装後、以下を更新してください。

- [README.md](README.md) — 「使い方」に「Webページを取り込む」経路(ブックマークレット)を追記。
  「データの扱い」に、外部リソースの読み込みをオンにした場合だけ元サイトへ通信する旨を1文追記。
  「あえてしないこと」の表に、URL入力欄を作らない理由を1行追記
- [docs/SPEC.md](docs/SPEC.md) — `PageSource` と `ElementRef` をデータモデルに追記。
  HTMLページの指示文テンプレートを出力例に追加
- [docs/DECISIONS.md](docs/DECISIONS.md) — 実装中の判断を1行ずつ追記
