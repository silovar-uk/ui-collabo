# ラダー現在地計画 — 物差しは「今」を起点に動く

- 作成日: 2026-09-07
- 作成: Claude Sonnet 5(UI研究セッションの成果。コードは未変更)
- 実装担当: Claude Sonnet(この文書を読んで実装する)
- 対象: `silovar-uk/ui-collabo`
- 前提文書: [PLAN.md](PLAN.md)、[PLAN-UI.md](PLAN-UI.md)、[PLAN-HTML.md](PLAN-HTML.md)、[docs/UI-LANGUAGE.md](docs/UI-LANGUAGE.md)

---

## 0. Sonnetへ: この文書の読み方

- 第1章が背景です。**なぜこの変更か**が書いてあります
- 第2章が最小形の実装です。触るファイルは3つだけです
- 第3章が受け入れ基準です
- 第4章に「やらないこと」があります。ここに書いてあることは実装しないでください
- 判断で埋めた穴は、これまでどおり [docs/DECISIONS.md](docs/DECISIONS.md) に1行残してください

---

## 1. 背景

UI研究セッション([docs/UI-LANGUAGE.md](docs/UI-LANGUAGE.md))で、
[src/pickers/Ladder.tsx](src/pickers/Ladder.tsx) の「今」ボタン(`ladder-now`)が、
HTMLページの箇所(`spot.element`)では実質無意味な操作になっていることが判明しました。

[src/lib/htmlCss.ts](src/lib/htmlCss.ts) の `resolveLadder` は `spot.element.computed` の
実測値のみを参照し、`Note.current`(今ボタンでセットする値)を一切見ません(htmlCss.ts:48-66)。
つまりHTMLページで「今」ボタンを押しても、指示文にもプレビュー反映にも何の変化も起きません。
[PLAN.md](PLAN.md) 10-2「すべてのUI操作は指示文の1行に対応する」に反しています。

一方でHTMLページには実測値(`element.computed`)という「今」の情報がすでに存在します。
ボタンを押させる必要はなく、実測できる場面では自動的に現在地を示せばよいはずです。

この計画は、ラダーを「絶対段の選択リスト」から「現在地を起点にした相対移動の物差し」に寄せる
最小の変更を行います。実測できる場合は現在地を自動表示し、実測できない場合(画像ページ)は
従来どおり手動セットのままにします。

---

## 2. 最小の形

触るファイルは3つです。

### 2.1 `src/lib/htmlCss.ts`

`nearestStepIndex` と `parseNumber` を `export function` にします(2行の変更のみ)。

### 2.2 `src/pickers/Ladder.tsx`

- Props に `autoNow?: number`(実測から算出した現在地の段インデックス)を追加します
- `autoNow` が渡されたときは `ladder-now` ボタン列を出さず、代わりに該当段の `ladder-thumb` に
  現在地を示す視覚(例: 下線または小さな三角マーカー、`is-auto-now` クラス)を付けます
- `value.current` は従来どおり残します。`autoNow` は表示にのみ使い、`onChange` の `current` 引数には
  渡しません(実測値はNoteに保存しません。保存すると実測時点の値が固定化され、要素のスタイルが
  変わっても追随しなくなるためです)

### 2.3 `src/panels/SpotPanel.tsx`

`Ladder` を呼び出す2箇所(既存ノート表示、新規追加時)で、`spot.element` があれば
`LADDER_TO_CSS` 相当のCSSキーを引いて `spot.element.computed` から数値を取り出し、
`nearestStepIndex(attr, 数値)` の結果を `autoNow` として渡します。対応するCSSキーがない属性
(`scale` / `speed` / `intensity`)では `autoNow` は渡しません(`undefined` のまま)。

---

## 3. 受け入れ基準

- HTMLページで見出し要素をクリックし、「大きさ・余白・形」からfontSizeを開くと、実測値に
  最も近い段に現在地マーカーが自動的に表示される(「今」ボタンを押す前に)
- 「少し小さく」を押すと、その自動現在地から1段小さい値が目標になる(delta解決の結果は
  今までと変わらない)
- 画像ページのラダーは `autoNow` が渡らないため、従来どおり「今」ボタンでの手動セットのままである
  (回帰なし)
- `npm run build` と `npm test` が通る

---

## 4. やらないこと

| やらないこと | 理由 |
|---|---|
| `Note.current` に実測値を書き込む | 保存すると実測時点の値が固定化され、要素側のスタイル変化に追随しなくなる |
| color/fontノートの自動current補完ロジックの変更 | 既存(`SpotPanel.tsx:83`)の `seedHex` はそのまま。ラダーの回収に留める |
| いま/こうしたいトグル(`showCurrent`)の再設計 | 別の問い([docs/UI-LANGUAGE.md](docs/UI-LANGUAGE.md) 破れ#9)。本計画のスコープ外 |
| ラダーの見た目の大幅変更(スライダー化等) | 既存の `ladder-thumb` / `ladder-step` 構造を維持する |
