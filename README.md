<p align="center">
  <img src="brand/logo.svg" alt="UI ColLabo" width="280" />
</p>

<p align="center"><strong>「なんか違う」を、伝わる形に。</strong></p>

<p align="center">
  <a href="https://silovar-uk.github.io/ui-collabo/">デモを見る →</a>
</p>

## これは何か

スクリーンショットに箇所を囲み、「こうしたい」を選ぶだけで、デザインのフィードバックを
AIが読める指示文に変える下ごしらえアプリです。**UI ColLaboはAIではありません。** チャット画面もサーバーもありません。
主動線の「AIに渡す」はChatGPTを開きます。任意のAIへ渡したい場合は、上部の「書き出し」から指示文・JSON・校正紙を取り出せます。

## 使い方

1. **貼る** — スクリーンショットを貼り付け(Ctrl+V)、またはドロップする
2. **囲う** — 気になる箇所をドラッグで囲む(Webページを取り込んだ場合はクリックで指す)。選ぶと、その場で「こうしたい」がスクショの上でも動く(見出しが縮む、ボタンの色が変わる、など)
3. **選ぶ** — 箇所を選ぶと右パネル上部に「選択中」の枠が出る。「言葉で選ぶ」欄から「こうしたい」(強さ・大きさ・余白など)を選ぶ。数値入力はほぼ不要。色・文字・大きさ・動き・ひとことなど細かい指定は、箇所の上に浮く朱のバー「細かく指定する」から
4. **渡す** — 右パネル下部の「AIに渡す」から、必要な校正画像/HTMLを準備してChatGPTを開く。渡す前に「渡す文面を見る」でAIへ渡す実際の文面を確認できる。任意のAIには「書き出し」を使う
5. **照合** — AIが直したら、直った画像を貼って確かめる。○を付けた箇所は次の修正で壊されない。すべて○になると「校了」の判子が出る

制作前の指定(ブリーフ)も同じ操作です。白紙のボードに「置きたい位置」を置くだけで、
「制作前の指定」として出力されます。

指示の一覧(右パネル)はAI向けの文面ではなく人が読む短文で見せますが、行はどれもクリックでき、
その行を作った操作がその場で開きます。行にホバーすると、朱の引き出し線が対応する箇所を指します。

## Webページを取り込む

「HTMLを読み込む」から、実際のWebページをコードで指せます。

1. ダイアログの「ページを取り込む」をブックマークバーにドラッグする
2. 対象ページを開いて、そのブックマークレットを押す(見た目そのままの内容がクリップボードに入ります)
3. UI ColLaboに戻り、貼り付け欄に貼る(Ctrl+V)

ブックマークレット経由では、元URLに加えて取り込み時のviewport幅・高さ・DPRも保持します。UI ColLabo内のHTMLプレビューはその幅を使うため、スマホ向けmedia queryを含むページも取り込み時の状態に近い条件で確認できます。旧形式や通常のHTML貼り付けは従来どおり1280px幅をfallbackに使います。

要素をクリックすると、CSSセレクタと実測のCSS値(文字サイズ・色など)を伴った箇所ができ、
指示文にも `セレクタ` と `現在値 → 目標値` が入ります。渡す先はコードを書けるAIになります。

## できること / あえてしないこと

| できること | あえてしないこと |
|---|---|
| 箇所を囲んで、位置・色・文字サイズ・余白・角丸・文字の雰囲気・動きを指定 | AI推論・アカウント・独自サーバー(UI ColLabo本体はlocal-first) |
| 数値を使わない相対指定(「少し小さく」「落ち着かせる」など)。文字で語彙を検索して選ぶことも可 | 実デザインの編集・書き出し(Figma・PowerPointの代替ではない) |
| ルールを蓄積して「ルールに合わせる」で全体の基準からのズレを指摘。ページ内のばらつき診断も | 座標や数値の直接入力を主な操作にすること |
| 白紙からのレイアウト指定(ブリーフ) | 矢印・手書き注釈、コメントスレッド、複数ボードの同時編集 |
| 定規・色の棚卸しで「今」を測る。直った版を貼って照合し、○/×で確かめる。版は初校→再校→三校…としてまとめて表示 | スマホをPCと同じ精密編集環境にすること(スマホは確認・軽い指定、精密操作はDesktop推奨) |
| 指示文・JSON・校正紙(複数ページは1枚の校正パケットに統合)・番号付き画像の形式で書き出し | OCR・手書き校正記号の認識(定規は人の手で当てることに価値がある) |
| ブックマークレットでWebページを取り込み、要素をクリックしてCSSセレクタ指定 | URL入力欄(他サイトのURLはブラウザだけでは読めないため。代わりにブックマークレットを配る) |

## 出力形式

指示文(Markdown)の例:

```markdown
> 以下はデザインの修正指示です。①②③は添付画像上の番号付き領域を指します。
> 位置と大きさは画像の左上を原点とし、画像の幅・高さに対する割合(%)で示します。

# デザイン指示: 提案書 p.3
- 種類: 修正指示(初校に対して)

## 箇所ごと
### 1 見出し(x 8%, y 12%, w 60%, h 10%)
- 位置: 上へ 4%(12% → 8%)
- 文字サイズ: 少し小さく
- 色: #E4572E → #C94A1D(落ち着かせる)
```

JSONのスキーマと、他の出力パターン(白紙・参考画像)は [docs/SPEC.md](docs/SPEC.md) を参照してください。
次フェーズの実装内容と互換性は [docs/NEXT-PHASE-IMPLEMENTATION.md](docs/NEXT-PHASE-IMPLEMENTATION.md) にまとめています。

## ローカルで動かす

```bash
npm install
npm run dev
```

## 自分で公開する

1. このリポジトリをForkする
2. `Settings > Pages > Source` を **GitHub Actions** にする
3. `main` に push すると自動でビルド・公開される([.github/workflows/deploy.yml](.github/workflows/deploy.yml))

## データの扱い

編集・保存はブラウザ内で完結します。画像・ボードはIndexedDBに保存され、AIへ渡す操作をするまでは外部へ送信されません。
ライブラリの書き出し/読み込みで他のブラウザへ持ち運べます。読み込み時は構造を検証し、置き換え前に現在のライブラリを自動バックアップします。

Webページの取り込みでは、通常のHTML貼り付けは外部CSS・画像・フォントを既定で読み込みません。UI ColLaboのブックマークレットで採取したHTMLは、元ページの見た目を再現するため外部リソース読み込みを既定で許可します。どちらもダイアログで切り替えでき、許可した場合のみ表示のため元サイトへ通信します。script・iframe等は取り込み時に除去します。

## 謝辞・ライセンス

- 動きのアニメーション定義は [cssanimationlists](https://github.com/silovar-uk/cssanimationlists) を参考にしました
- フォントは [Google Fonts](https://fonts.google.com/)(各書体 OFL ライセンス)を使用しています
- 本体は [MIT License](LICENSE) です

---

## English summary

UI ColLabo turns a screenshot-based design review into an AI-readable instruction. Draw a box
around a spot on a pasted screenshot, pick what you want changed (position, color, font size,
motion, ...) mostly without typing numbers, and copy the generated Markdown/JSON to paste into
any AI. It is not an AI itself — no chat, no server, no account. Everything (images, boards,
saved rules) lives in your browser's IndexedDB. Run `npm install && npm run dev` locally, or
fork this repo and enable GitHub Actions under Pages to host your own copy. MIT licensed.
