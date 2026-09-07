# Sashi(サシ)計画書 — 「なんか違う」を、伝わる形に

- 作成日: 2026-09-07
- 作成: Claude Fable 5.1(計画のみ)
- 実装担当: Claude Sonnet(この文書を読んで実装する)
- リポジトリ予定: `C:\Users\vediv\repos\sashi` → GitHub `silovar-uk/sashi` → GitHub Pages `https://silovar-uk.github.io/sashi/`

---

## 0. Sonnetへ: この文書の読み方

- 第1〜4章は「なぜこう作るか」です。実装前に一度読み、迷ったときに戻ってください
- 第5〜8章が仕様です。ここに書いてある範囲を、書いてある粒度で作ってください
- 第9章がフェーズ分けと完成判定です。フェーズ1から順に、各フェーズの受け入れ条件を満たしてから次へ進んでください
- 第10章の原則に反する機能追加はしないでください。迷ったら「機能を減らす」側に倒してください
- 仕様に穴があれば、この文書の思想に沿って自分で埋めて構いません。埋めた判断は `docs/DECISIONS.md` に1行ずつ残してください

---

## 1. このアプリをどう解釈したか

AIにWebページやスライドを作らせるのは簡単になりました。難しいのは、人間が見て感じた
「なんか違う」を、AIが動ける粒度の指示に変えることです。

原因は3つあると解釈しました。

1. **場所が伝わらない** — 「タイトル」と言っても、AIはどの領域か正確には分からない
2. **量が伝わらない** — 「もう少し上」「少し小さく」の「少し」に共通の物差しがない
3. **言葉が出てこない** — 「静かにしたい」「主張が強い」の正体を、人間自身が分解できていない

このアプリは、その3つを埋める「翻訳の前段」です。AIではありません。
人間が **貼る → 指す → 選ぶ → 渡す** を行い、結果を「人間が読める指示文」と
「機械が読める構造データ」の両方で吐き出します。

制作前の指定(ブリーフ)と、初校以降のダメ出し(レビュー)は、別機能にしません。
どちらも「**箇所を指して、こうしたいを選ぶ**」という同じ行為です。
違いは「今の状態」が存在するかどうかだけです。

- レビュー: 今の状態(スクリーンショット)がある。今 → こうしたい
- ブリーフ: 今の状態がない。白紙、または参考画像に対して「こうしたい」だけを置く

データモデル上も「current(任意)」と「target(必須)」の差だけで表現します。

---

## 2. 最も重要だと考える体験

**「指したら、その場で言葉になる」** ことです。

スクリーンショットを貼り、領域を囲み、「もう少し上」のチップを押した瞬間に、
画面の端で指示文が

> ① タイトル: 上へ約4%(現在 y=12% → 8%)

と書き換わる。この往復が速いほど、人は自分の「なんか違う」を分解できます。
出力は最後に押す「書き出しボタン」ではなく、**常に見えているもの** として設計します。

これを支える2つの操作を、アプリ全体で統一します。

- **囲う** — 画像上で矩形をドラッグすると「箇所(①②③)」になる。位置とサイズの指定は、その箇所の「点線コピー」を動かすだけ
- **段階から選ぶ** — 文字サイズ、余白、太さ、速さなど量を持つものは、必ず「実物を並べた段階(ラダー)」から選ぶ。数値入力は最後の手段。「今より少し」「今よりずっと」の相対指定もラダー上の移動として扱う

---

## 3. あえて実装しないもの

| 実装しない | 理由 | 代わりに |
|---|---|---|
| AI・LLM API・チャット画面 | 本アプリは翻訳の前段。AI依存を作ると目的がぶれる | 出力をコピーして任意のAIへ貼る |
| アカウント・サーバー・同期 | 静的ホスティングで完結させる | IndexedDB保存 + JSONの書き出し/読み込み |
| URL読み込み・DOM検査 | クロスオリジンで不安定。スライドはURLではない | スクリーンショット(画像)を唯一の入力にする |
| 実デザインの編集・書き出し | FigmaやPowerPointの代替ではない | 「選択肢」だけを描画する |
| 座標・数値の直接入力を主UIにする | 専門ツール化を避ける | ドラッグと段階選択。数値は出力側で自動計算 |
| 矢印・手書き・テキスト注釈 | 注釈ツール化を避ける | 矩形 + ラベル + 番号のみ |
| 複数ボードの同時表示、バージョン履歴、共同編集 | 巨大化する | 1ボードずつ開く。保存は上書き |
| 任意フォントの読み込み | 選択肢が無限になる | 「雰囲気」で分類した固定10種 |
| ダークモード、モバイル最適化 | v1の対象外 | デスクトップ前提、`color-scheme: light` |
| 多言語UI | v1は日本語UI | READMEに英語概要のみ |

---

## 4. プロダクトコンセプト

### 4.1 名前

**Sashi(サシ)**

- 指し(さし): 指す。ここ、と示す
- 差し(さし): 差。今と理想のあいだの隙間
- 「サシで話す」: 一対一で向き合う。人とAIが、デザインについて一対一で話す

英語圏向けの説明: *Sashi — point at the gap.*

タグライン: **「なんか違う」を、伝わる形に。**

(代替案として検討したもの: Koko(ここ)、Chotto(ちょっと)。Kokoは場所しか表せず、
Chottoは調整しか表せないため、両方向を表せるSashiを採用)

### 4.2 シンボル

**今の箱と、こうしたい箱。** 2つの角丸四角のズレそのものをマークにします。

- 墨色(ink)の塗り四角 = 今の状態
- 朱色(vermilion)の点線四角 = こうしたい状態。右上に少しズレている
- このズレが「差し」であり、アプリ内で箇所を動かすときの表示そのものと一致します。ロゴ = UI言語

朱色は日本の校正の「赤入れ」に由来します。デザインレビューは赤入れです。

### 4.3 ブランドカラーとタイポ

| 役割 | 名前 | 値 |
|---|---|---|
| 文字・今の箱 | ink | `#1C1B19` |
| 背景 | paper | `#F7F4EE` |
| こうしたい・強調 | vermilion | `#E4572E` |
| 補助文字 | muted | `#8A857C` |
| 罫線 | line | `#D9D3C7` |
| パネル面 | panel | `#FFFFFF` |

UIフォント: `Inter` + `Noto Sans JP`(Google Fonts)。フォールバックは `system-ui, sans-serif`。
ワードマークは小文字 `sashi` を `Inter 600`、その右下に小さく `指し・差し`。

### 4.4 必要なビジュアル資産(`brand/` にSVG原本、`public/` に配信物)

| ファイル | 内容 |
|---|---|
| `brand/mark.svg` | シンボル。viewBox 64×64。ink塗り角丸四角 32×32 を (12,20) に、vermilion 点線(stroke 3、dash 6 4)角丸四角 32×32 を (20,12) に。角丸6 |
| `brand/mark-small.svg` | 16px用。点線が潰れるので実線 stroke 4 に変更 |
| `brand/logo.svg` | mark + ワードマーク横並び |
| `brand/og.svg` | 1200×630。paper背景、左にmark、右に `sashi` と タグライン、下段に「貼る・指す・渡す」 |
| `public/favicon.svg` | mark-small |
| `public/icon-512.png` | mark を paper 背景に。`scripts/render-assets.mjs`(`@resvg/resvg-js` devDependency)で生成 |
| `public/og.png` | og.svg から同スクリプトで生成 |
| `public/manifest.webmanifest` | name/short_name/icons/theme_color(`#F7F4EE`) |

---

## 5. UI・操作

### 5.1 用語(UI上の表示名)

専門用語を避け、会話で使う言葉に寄せます。内部名は英語で固定します。

| 内部名 | 表示名 | 意味 |
|---|---|---|
| Board | ボード | 今話している1枚のページまたはスライド(複数ページ可) |
| Page | ページ | ボード内の1画像。スライドは1枚=1ページ |
| Spot | 箇所 | 画像上で囲った領域。①②③で呼ぶ |
| Note | こうしたい | 箇所またはボードに付ける1つの意図 |
| Keep | 残す | この箇所は変えない、という宣言 |
| Rules | ルール | ボード全体の基準(色、文字、余白、動き、トーン) |
| RuleSet | 保存したルール | ライブラリに入れたルール一式 |
| Template | 型 | 画像なしのボード(箇所配置 + ルール) |
| Order | 見る順 | 視線誘導。箇所を見せたい順に並べたもの |
| Export | AIに渡す | 指示文・JSON・番号付き画像の出力 |

### 5.2 画面構成(1画面、モーダル最小)

```
┌──────────────────────────────────────────────────────────────────┐
│ [sashi] ボード名 ▾   Web / スライド16:9 ▾   [ルール] [ライブラリ]   [AIに渡す] │
├──────────────────────────────────────┬───────────────────────────┤
│                                      │ 右パネル(文脈で切替)        │
│   ボード(画像 or 白紙)               │  ・何も選択なし → ボード全体   │
│   ドラッグで箇所を囲う                │  ・箇所を選択  → その箇所      │
│   ①②③ 番号バッジ                    │                           │
│   選択中: 点線コピー(こうしたい位置)    │  ─────────────────────    │
│                                      │ 指示文プレビュー(常時表示、   │
│  ┌─┐┌─┐┌─┐ ページ帯(2枚以上のとき)    │  折りたたみ可)             │
└──────────────────────────────────────┴───────────────────────────┘
```

- 左右比はおよそ 2:1。右パネル幅は最小 360px
- 「AIに渡す」は右からスライドインするドロワー。タブ: 指示文 / JSON / 番号付き画像
- 「ルール」「ライブラリ」も同じドロワー枠を使う(ドロワーは1種類、内容だけ差し替え)

### 5.3 空の状態(初回)

中央に3つの入口だけを置きます。

1. **貼る** — 「スクリーンショットを貼り付け(Ctrl+V)、またはここにドロップ」
2. **白紙から** — Web(縦長) / スライド 16:9 / スライド 4:3 を選ぶ
3. **開く** — 保存したボードと型、サンプル2件(Webページ、スライド)

画像を貼った直後に1つだけ聞きます: **「この画像は?」→ [直したいもの] [参考にしたいもの]**
これがボードの `imageRole` になり、出力の言い回しが変わります。あとから変更できます。

### 5.4 基本ループ

1. **貼る** — 画像を貼る。複数枚を貼るとページになる。取り込み時に長辺 1600px、JPEG品質 0.85 に縮小して保存
2. **囲う** — 画像上をドラッグして箇所を作る。作成直後にラベル入力へフォーカス(例: タイトル)。ラベル未入力なら「箇所①」
3. **こうしたい** — 右パネルの「＋ こうしたい」から種類を選ぶ: 位置・大きさ / 色 / 文字 / 余白 / 形 / 動き / ルールに合わせる / ひとこと
4. **残す** — 箇所の「残す」トグル。出力の「変えないもの」に載る
5. **見る順** — ボード全体パネルの「見る順を決める」で箇所を順にクリック
6. **渡す** — 「AIに渡す」から指示文をコピー、必要なら番号付き画像を保存してAIへ添付

### 5.5 箇所の操作(ボード上)

- 矩形ドラッグで作成。8pxより小さいドラッグは無視(クリック扱い)
- クリックで選択、Escで解除、Delete/Backspaceで削除(確認なし、Ctrl+Zで戻せる1段のみ)
- 選択中は同じ位置に **朱色点線のコピー(こうしたい箱)** が重なって表示される
  - 点線箱をドラッグ → 位置の「こうしたい」
  - 点線箱の8ハンドルをドラッグ → 大きさの「こうしたい」
  - 矢印キーで1%、Shift+矢印で5%移動
  - ドラッグ中、ボード中央線・他の箇所の辺に4px以内で吸着し、ガイド線を表示
- 点線箱が元と一致している間は、位置・大きさの「こうしたい」は出力されない
- 右パネルにも同じ操作のチップを置く: 上へ / 下へ / 左へ / 右へ(各2%) / 左右中央 / 上下中央 / [他の箇所]と左端・上端・中央をそろえる
- `imageRole = reference` または白紙のときは点線箱を出さない(今の状態がないため)。白紙では矩形そのものが「置きたい位置」

座標は常に **ボード幅・高さに対する 0〜1 の比率** で保持し、出力時に%とpx換算を併記します。

### 5.6 ピッカー(「こうしたい」の入力UI)

全ピッカー共通: 選択肢は**実物を描画**して並べる。名前だけの選択肢を作らない。
「今」が分かるときは「今」マーカーを付ける。決定は1クリック。閉じるボタン不要(選んだら閉じる)。

#### 5.6.1 ラダー(段階)— 量を持つ属性の共通部品

- 横一列に段階を並べ、各段を実物で描画(文字サイズなら「あ Aa」をそのサイズで)
- 上部に相対チップ: **ずっと小さく / 少し小さく / 少し大きく / ずっと大きく**(= −2 / −1 / +1 / +2 段)
- 段をクリックすると絶対指定、チップを押すと相対指定。相対は「今」が不明でも使える
- 「今」マーカーは、ユーザーが「今はこのくらい」で任意にセットできる(スクリーンショットからは推定しない)

| 属性 | 表示名 | 段階(左→右) | 描画 |
|---|---|---|---|
| fontSize | 文字サイズ | 12, 14, 16, 18, 20, 24, 32, 40, 56 px | 「あ Aa」 |
| weight | 文字の太さ | 300, 400, 500, 600, 700, 800 | 「あ Aa」 |
| spacing | 余白 | 0, 4, 8, 12, 16, 24, 32, 48, 64 px | 内側に余白を持つ箱 |
| radius | 角丸 | 0, 2, 4, 8, 12, 16, 24, full | 箱 |
| scale | 全体の大きさ | 50, 65, 80, 90, 100, 110, 125, 150, 200 % | 箱の相対サイズ |
| lineWidth | 線の太さ | 0, 1, 2, 3, 4, 6 px | 罫線 |
| speed | 動きの速さ | 0.15, 0.25, 0.4, 0.6, 0.9, 1.4 s | 再生される箱 |
| intensity | 動きの強さ | ほのか, 控えめ, ふつう, はっきり, 大きく | 移動距離・拡大率が変わる箱 |

px値は「幅1280px基準の換算値」として出力に明記します。スライドもWebも同じ表を使います。

#### 5.6.2 色

- **今の色**: ピッカーを開いた状態で画像をクリックするとスポイト(5×5px平均)。取得後は swatch + hex 表示
- **こうしたい色**の選び方(上から優先)
  1. **方向チップ** — 今の色に対して HSL 操作した結果を swatch で並べる: 淡く(L+12, S−10) / 濃く(L−12) / 明るく(L+8) / 暗く(L−8) / 鮮やかに(S+15) / 落ち着かせる(S−20) / 暖かく(Hを30°方向へ12°) / 冷たく(Hを210°方向へ12°) / グレーに近づける(S−40)
  2. **ルールの色** — ボードのルールにあるパレットを swatch で並べる
  3. **hex 入力** — 最後の手段。小さく置く
- 役割チップ(任意): 文字 / 背景 / 強調 / 線
- `imageRole = reference` のときは「今の色」欄が「この色を使いたい」に変わり、スポイト結果がそのまま target になる

#### 5.6.3 文字の雰囲気

サンプル文(箇所のラベルを使う。空なら「見出しのサンプル Sample」)を10種で描画したカード。

| id | 表示名 | Google Fonts | fallback |
|---|---|---|---|
| quiet-mincho | 静かな明朝 | Shippori Mincho | serif |
| clear-gothic | はっきりゴシック | Noto Sans JP 700 | sans-serif |
| soft-round | やわらか丸ゴ | M PLUS Rounded 1c | sans-serif |
| thin-gothic | きりっと細ゴシック | Zen Kaku Gothic New 300 | sans-serif |
| classic-serif | クラシック・セリフ | Playfair Display + Shippori Mincho | serif |
| modern-sans | モダン・サンセリフ | Inter + Noto Sans JP | sans-serif |
| mono | 技術的・等幅 | JetBrains Mono + BIZ UDGothic | monospace |
| display | 見出し向き・ディスプレイ | Dela Gothic One | sans-serif |
| hand | 手書き風 | Yomogi | cursive |
| ud | 読みやすさ重視 | BIZ UDPGothic | sans-serif |

出力には表示名・フォント名・fallback を併記します。

#### 5.6.4 動き

参考: `https://silovar-uk.github.io/cssanimationlists/`(ユーザー自身のリポジトリ)。
ライセンスと構成を確認し、流用できるCSSがあれば流用して構いません(出典をREADMEに記載)。

- グリッドに12種の箱を並べ、ホバーまたはクリックで再生
- 種類: fade / fade-up / fade-down / slide-left / slide-right / scale-in / pop(バウンス) / blur-in / wipe(clip-path) / typewriter(文字) / float(ループ) / pulse(ループ)
- 表示名は日本語(例: 下からふわっと、ポンと出る、じわっと)。出力に英語idも併記
- きっかけ: 登場時 / ホバー / 切り替え
- 速さ・強さは 5.6.1 のラダーを流用

#### 5.6.5 ひとこと(自由記述 + 形容チップ)

「なんとなく」をそのまま受け取る逃げ道。箇所にもボード全体にも付けられます。

- チップ: 静かに / 主張を強く / 軽く / 重厚に / 親しみやすく / 上品に / 整然と / 遊びを / シンプルに / にぎやかに
- 自由文1行(複数行可)
- 出力はチップと自由文をそのまま載せる。解釈しない

#### 5.6.6 ルールに合わせる

ボードにルールがあるとき、箇所のこうしたいに「ルールに合わせる」を追加できます。
ルール項目(例: 本文サイズ 16px、強調色 #E4572E)を選ぶだけ。
出力: 「本文の文字サイズがルール(16px)とズレている。ルールに合わせる」。
これが「全体のルールとここだけズレている」の表現です。

### 5.7 ルールとライブラリ(自分の判断を蓄積する)

**ルール** = ボード全体の基準。ドロワー「ルール」で編集。UIは 5.6 のピッカーをそのまま使う。

- 色: 役割(背景 / 文字 / 強調 / 補助)ごとの swatch。スポイトで画像から拾える
- 文字: 見出し / 本文 / 注釈 ごとに 雰囲気 + サイズ段階
- 余白: 基準段階1つ
- 動き: 登場時 / ホバー / 切り替え ごとに1つ
- トーン: 5.6.5 のチップ

**蓄積の仕組み**は1つだけ。箇所に付けた各「こうしたい」の横に **「ルールにする」** ボタンを置きます。
押すとその値がボードのルールに昇格します。別画面で基準を設計させません。日々のレビューの副産物としてルールが育ちます。

**ライブラリ**(ドロワー「ライブラリ」)

- 保存したルール: 名前付きで保存 / 現在のボードに適用(上書き) / 削除
- 保存したボード: 一覧、開く、削除。ボードは編集のたびに自動保存(debounce 500ms)
- 型: ボードメニュー「型として保存」→ 画像を捨て、箇所とルールだけを複製して保存。「型から新規」で新しいidのボードを作る
- 書き出し / 読み込み: ライブラリ全体を `sashi-library.json` として保存・復元(画像を含む)

### 5.8 出力(「AIに渡す」ドロワー)

3タブ。どれも「コピー」ボタンを右上に固定。

1. **指示文**(Markdown、既定タブ、右パネル下の常時プレビューと同一内容)
2. **JSON**(画像を含まない構造データ)
3. **番号付き画像**(ページごとにPNG保存。①②③バッジ、朱色点線の目標箱、中心から中心への矢印を焼き込む)

指示文の先頭には、AIへ渡す前提を1段落固定で入れます。

```markdown
> 以下はデザインの修正指示です。①②③は添付画像上の番号付き領域を指します。
> 位置と大きさは画像の左上を原点とし、画像の幅・高さに対する割合(%)で示します。
> px換算は幅1280px基準です。「変えないもの」は現状維持してください。
```

指示文テンプレート(レビューの例):

```markdown
# デザイン指示: 提案書 p.3

- 対象: スライド(16:9)、画像サイズ 1600×900
- 種類: 修正指示(初校に対して)

## 基準ルール
- 色: 背景 #FFFFFF / 文字 #1C1B19 / 強調 #E4572E
- 文字: 見出し=はっきりゴシック(Noto Sans JP 700) 32px / 本文=モダン・サンセリフ 16px
- 余白: 基準 24px
- トーン: 静かに、整然と

## 全体
- ひとこと: 「全体的に要素が大きく、窮屈」
- 見る順: ① 見出し → ③ グラフ → ② 本文

## 箇所ごと
### ① 見出し(x 8%, y 12%, w 60%, h 10%)
- 位置: 上へ 4%(y 12% → 8%)
- 文字サイズ: 今より1段小さく
- 色: #E4572E → #C94A1D(落ち着かせる)
- ひとこと: 「ここだけ主張が強い」

### ② 本文(x 8%, y 30%, w 50%, h 40%)
- 文字サイズ: ルール(16px)とズレている。ルールに合わせる
- 余白: 内側を 24px → 16px

### ③ グラフ(x 62%, y 28%, w 32%, h 50%)
- 大きさ: 幅 32% → 36%(約1.1倍)
- 動き: 登場時に「下からふわっと」(fade-up)、速さ 0.4s、強さ ふつう

## 変えないもの
- ④ ロゴ(右下)
```

ブリーフ(白紙)のときは「種類: 制作前の指定」とし、箇所は「レイアウト」節に
「① タイトル: 左上(x 8%, y 10%, w 60%, h 12%)」の形で並べます。
参考画像のときは「種類: 参考画像に基づく指定」とし、色は「参考画像①の色 #xxxxxx を強調色に」の形にします。

---

## 6. データモデル(`src/schema.ts`)

```ts
export const SCHEMA = 'sashi/1';

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
}

export type Note =
  | { id: string; kind: 'ladder'; attr: LadderAttr; current?: number;
      target: { step: number } | { delta: number } }                 // step=絶対段, delta=相対段
  | { id: string; kind: 'color'; role?: 'text' | 'bg' | 'accent' | 'line';
      current?: string; target: string; via?: string }              // via: 「落ち着かせる」など
  | { id: string; kind: 'font'; mood: FontMoodId }
  | { id: string; kind: 'motion'; motion: MotionId;
      trigger: 'enter' | 'hover' | 'transition'; speed?: number; intensity?: number }
  | { id: string; kind: 'rule'; ruleRef: string }                    // 例: 'type.body.size'
  | { id: string; kind: 'text'; text: string; chips: string[] };

export type LadderAttr = 'fontSize' | 'weight' | 'spacing' | 'radius'
  | 'scale' | 'lineWidth' | 'speed' | 'intensity';

export interface Spot {
  id: string;
  pageId: string;
  n: number;              // ①②③ の番号。ページを跨いで通し番号
  label: string;
  rect: Rect;             // 今(白紙・参考では「置きたい位置」)
  targetRect?: Rect;      // こうしたい位置・大きさ。draft のときのみ
  keep: boolean;
  notes: Note[];
}

export interface Rules {
  palette: { role: 'bg' | 'text' | 'accent' | 'sub'; hex: string }[];
  type: { role: 'heading' | 'body' | 'caption'; mood?: FontMoodId; size?: number }[];
  spacing?: number;       // 段
  motion: { trigger: 'enter' | 'hover' | 'transition'; motion: MotionId;
            speed?: number; intensity?: number }[];
  tone: string[];
}

export interface Board {
  schema: typeof SCHEMA;
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
  schema: typeof SCHEMA;
  boards: Board[];
  templates: Board[];     // pages[].image = null のボード
  ruleSets: RuleSet[];
}
```

- JSON出力(AIに渡す用)は `Board` から `pages[].image.dataUrl` を落としたもの
- ライブラリ書き出しは `Library` をそのまま(画像込み)
- 読み込み時は `schema` を確認し、`sashi/1` 以外は拒否してメッセージを出す
- 段階テーブル・フォント・動きの定義は `src/vocab.ts` に定数として一元化し、出力とピッカーの両方が参照する

---

## 7. 技術構成

| 項目 | 選定 | 理由 |
|---|---|---|
| ビルド | Vite | 既存プロジェクト(prompt-lab)と同じ。GitHub Pages に静的出力 |
| UI | Preact + TypeScript | React互換で小さい。UIライブラリは使わない |
| 状態 | `@preact/signals` | ボード1つを signal で持ち、出力プレビューを派生値にする。Redux等は不要 |
| スタイル | 素のCSS 1ファイル(`src/styles.css`)+ CSS変数 | フレームワーク不要 |
| 画像 | Canvas API | 縮小、スポイト、番号付きPNG生成 |
| 保存 | IndexedDB(自前ラッパー 30行程度、`src/lib/storage.ts`) | 画像を含むため localStorage の5MB上限を避ける |
| フォント | Google Fonts `<link>`(10書体 + Inter + Noto Sans JP) | `display=swap`、fallback必須 |
| テスト | Vitest | `export.ts` と `color.ts` のみ。UIテストは書かない |
| Lint/Format | なし(v1) | 追加しない |
| 資産生成 | `@resvg/resvg-js`(devDependency) | SVG → PNG(icon-512、og) |
| デプロイ | GitHub Actions `actions/deploy-pages` | main への push で自動 |
| `vite.config.ts` | `base: './'` | project pages でも user pages でも動く |

依存は本番 `preact`、`@preact/signals` の2つ、開発 `vite`、`@preact/preset-vite`、`typescript`、`vitest`、`@resvg/resvg-js` に限定します。これ以外を足すときは `docs/DECISIONS.md` に理由を書いてください。

実装上の注意(Sonnet向け):

- 画像は `object-fit: contain` で表示するため、表示矩形を計算して比率座標と相互変換する関数を1つ作り、全操作で使う
- ドラッグは Pointer Events + `setPointerCapture`。mouse/touch を別実装しない
- 貼り付けは `document` の `paste` イベント。`clipboardData.files` と `items` の両方を見る
- IndexedDB の初期読み込みが終わるまで空状態を描画しない(ちらつき防止に「読み込み中」1行)
- 番号付きPNGは元画像解像度で描く。バッジ径は画像幅の 2.5%、最小 24px
- Ctrl+Z は「直前の1操作」を戻すだけ。履歴スタックは作らない(`ponytail:` コメントで上限を明記)

---

## 8. リポジトリ構成と公開

```
sashi/
├─ README.md                 # 日本語主、末尾に英語概要
├─ LICENSE                   # MIT
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ index.html                # title、meta(og:image、description)、favicon、manifest、Google Fonts link
├─ .github/workflows/deploy.yml
├─ public/
│   ├─ favicon.svg  icon-512.png  og.png  manifest.webmanifest
│   └─ samples/              # サンプル2件(web.json、slide.json。画像はSVGで作った模擬スクリーンショットを埋め込む)
├─ brand/                    # mark.svg  mark-small.svg  logo.svg  og.svg  README.md(使い方・色)
├─ scripts/render-assets.mjs
├─ docs/
│   ├─ SPEC.md               # 6章のデータモデルと指示文テンプレートを転記
│   └─ DECISIONS.md          # 実装中の判断ログ(1行1件)
├─ src/
│   ├─ main.tsx  app.tsx  styles.css
│   ├─ schema.ts  vocab.ts  state.ts
│   ├─ export.ts             # Board → Markdown / JSON / 番号付きPNG
│   ├─ lib/  color.ts  image.ts  storage.ts  geometry.ts
│   ├─ board/ Board.tsx  SpotRect.tsx
│   ├─ pickers/ Ladder.tsx  ColorPicker.tsx  FontPicker.tsx  MotionPicker.tsx  TonePicker.tsx
│   └─ panels/ BoardPanel.tsx  SpotPanel.tsx  RulesDrawer.tsx  LibraryDrawer.tsx  ExportDrawer.tsx  Empty.tsx
└─ test/ export.test.ts  color.test.ts
```

### 8.1 `deploy.yml` の要点

- トリガー: `push` to `main`、`workflow_dispatch`
- `actions/checkout` → `actions/setup-node@v4`(node 20、cache npm)→ `npm ci` → `npm run build` → `actions/upload-pages-artifact`(`dist`)→ `actions/deploy-pages`
- `permissions: pages: write, id-token: write`

### 8.2 README の構成

1. ロゴ + タグライン + デモURL + スクリーンショット1枚
2. なにをするものか(3行)。「AIではありません」を明記
3. 使い方: 貼る → 指す → 渡す(GIFまたは3枚の画像)
4. できること / あえてしないこと(第3章の表を短縮)
5. 出力形式(指示文の例、JSONは `docs/SPEC.md` へリンク)
6. ローカルで動かす(`npm install`、`npm run dev`)
7. 自分で公開する(Fork → Settings > Pages > Source を GitHub Actions → main に push)
8. データの扱い(すべてブラウザ内。サーバー送信なし)
9. 謝辞(cssanimationlists、Google Fonts)、ライセンス(MIT)
10. English summary(10行程度)

### 8.3 ライセンス整理

- 本体: MIT
- Google Fonts: 各書体は OFL。`<link>` 読み込みのため同梱しない
- cssanimationlists からCSSを流用する場合: 当該リポジトリのライセンスを確認し、READMEの謝辞に記載
- サンプル画像: 自作SVG(権利問題なし)

---

## 9. 実装フェーズと完成判定

### フェーズ1: 芯のループ

- 雛形(Vite + Preact + TS)、`schema.ts`、`vocab.ts`、`state.ts`、`storage.ts`
- 空状態(貼る / 白紙から / 開く)、画像の貼り付け・ドロップ・縮小、複数ページ
- 箇所の作成・選択・削除・ラベル、点線箱の移動・リサイズ・吸着、位置チップ
- 「残す」、「ひとこと」(チップ + 自由文)
- 右パネル下の指示文ライブプレビュー、「AIに渡す」ドロワー(指示文 / JSON / 番号付きPNG)、コピー
- IndexedDB 自動保存、再読込で復元

**受け入れ**: スクリーンショットを貼り、3箇所を囲い、1つを上へ動かし、1つを「残す」にし、
指示文をコピーして任意のAIに貼ったとき、AIが追加質問なしに修正箇所を特定できる。

### フェーズ2: 見て選ぶ

- ラダー部品と8属性、色ピッカー(スポイト、方向チップ、hex)、文字の雰囲気、動き、「ルールに合わせる」
- 「見る順」モード
- `imageRole` による言い回しの切り替え(draft / reference / 白紙)

**受け入れ**: 数値を一度も入力せずに「文字を少し小さく、色を落ち着かせ、下からふわっと出す」を指示文にできる。

### フェーズ3: 蓄積

- ルールドロワー、「ルールにする」ボタン、保存したルールの保存・適用
- ライブラリ(ボード一覧、型として保存、型から新規、書き出し / 読み込み)
- サンプル2件、Ctrl+Z(1段)

**受け入れ**: 白紙16:9に3ブロックを置き、ルールを設定し、型として保存し、
型から新規で開いた指示文をAIに渡したとき、AIがスライドの制作を開始できる。

### フェーズ4: 公開の顔

- `brand/` 一式、`public/` 資産、`render-assets.mjs`、`manifest`、`index.html` のmeta
- README、`docs/SPEC.md`、`docs/DECISIONS.md`、LICENSE、`deploy.yml`
- `test/export.test.ts`(サンプルBoard → Markdown に期待行が含まれる、JSON往復で同値)、`test/color.test.ts`(HSL操作)
- `git init` → 初回コミット → `silovar-uk/sashi` 作成 → push → Pages 有効化 → デモURL確認

**受け入れ**: リポジトリを初見の人が README だけで用途・使い方・公開手順を理解できる。デモURLで動く。

### 全体の完成判定(ユーザーの成功条件)

- [ ] 「なんかここが違う」と思った人が、何が・どこが・どう・何は変えないかを整理できる
- [ ] その内容がコピー1回で別のAIに渡り、AIが追加質問なく作業に入れる
- [ ] 逆方向: 白紙または参考画像から、AIが制作を始められる粒度のブリーフを出せる
- [ ] 両方向が同じ操作(囲う・選ぶ)で行える
- [ ] 数値入力を1回もせずに上記が完了する

---

## 10. 判断に迷ったときの原則(Sonnet向け)

1. **足すより減らす。** 機能候補が出たら、まず「5.6.5 ひとこと(自由文)で足りるか」を考える。足りるなら作らない
2. **すべてのUI操作は、指示文の1行に対応する。** 出力に現れない操作は作らない
3. **選択肢は実物で見せる。** 名前だけのドロップダウンを作らない
4. **数値は結果であって入力ではない。** 数値入力欄は色のhex以外に作らない
5. **AIを呼ばない。** fetch は Google Fonts の読み込み以外に存在しない
6. **言葉は会話語。** 「Inspector」「プロパティ」「エンティティ」を画面に出さない
7. **保存は勝手にする。** 「保存」ボタンを作らない(ライブラリの書き出しは別)
8. **仕様の穴は思想で埋め、`docs/DECISIONS.md` に1行残す**
