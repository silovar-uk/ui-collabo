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
作った指示文をコピーして、好きなAIに貼ってください。

## 使い方

1. **貼る** — スクリーンショットを貼り付け(Ctrl+V)、またはドロップする
2. **指す** — 気になる箇所をドラッグで囲み、「こうしたい」(位置・色・文字サイズ・動きなど)を選ぶ。数値入力はほぼ不要
3. **渡す** — 右上の「AIに渡す」から指示文をコピーして、任意のAIへ貼る

制作前の指定(ブリーフ)も同じ操作です。白紙のボードに「置きたい位置」を置くだけで、
「制作前の指定」として出力されます。

## できること / あえてしないこと

| できること | あえてしないこと |
|---|---|
| 箇所を囲んで、位置・色・文字サイズ・余白・角丸・文字の雰囲気・動きを指定 | AI・チャット・サーバー通信(すべてブラウザ内で完結) |
| 数値を使わない相対指定(「少し小さく」「落ち着かせる」など) | 実デザインの編集・書き出し(Figma・PowerPointの代替ではない) |
| ルールを蓄積して「ルールに合わせる」で全体の基準からのズレを指摘 | 座標や数値の直接入力を主な操作にすること |
| 白紙からのレイアウト指定(ブリーフ) | 矢印・手書き注釈、複数ボードの同時表示、バージョン履歴 |
| 指示文・JSON・番号付き画像の3形式で書き出し | ダークモード・モバイル最適化(v1はデスクトップ前提) |

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

すべての操作はブラウザ内で完結します。画像・ボードはIndexedDBに保存され、
どこにも送信されません。ライブラリの書き出し/読み込みで、他のブラウザへ持ち運べます。

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
