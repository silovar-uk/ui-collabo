# UI ColLabo — Next Phase Audit

実施日: 2026-09-12

## 1. 現在地

UI ColLaboは「機能が足りないMVP」ではなく、Product Contractと基本フローが成立し、次に**認知負荷と実運用速度を削る段階**に入っている。

中核は引き続き以下。

`貼る → 囲う → 選ぶ → 渡す → 照合`

研究所UIはこの流れを理解しやすくする限りで有効。世界観そのものをプロダクトモデルへ昇格させる段階ではない。

## 2. 次のボトルネック

### P0-1: 狭い画面で作業空間そのものが成立しない

390px幅で現行bundleを実測したところ、`scrollWidth = 579px`。189pxの横オーバーフローが発生した。

原因は920px以下でもworkbench + protocolの2列を維持していたこと。

### P0-2: ユーザーの思考よりProperty UIが先に来る

対象を囲った直後、現在は `位置 / 色 / 文字 / 形 / 動き / ひとこと` を解読する必要がある。

しかし人間の起点は「もっと目立たせたい」「少し弱めたい」「中央にしたい」などのIntentである。

一方、コードにはすでに自然語検索可能なcommand engineが存在していたため、モデル追加なしでIntent-firstへ移行できる。

### P0-3: 補助情報が実際の指示より先に視界を占有する

右ペインでは全体設定・色診断・HTML監査が、個別の修正指示より先に並ぶ。高度な補助情報が主作業と注意を奪い合っている。

## 3. 守

残す。

- 貼る → 囲う → 選ぶ → 渡す → 照合
- workbenchを画面の主役にする思想
- AIを内蔵せずhandoff前を整える役割
- Board / Spot / Noteの現行Product Contract
- 位置・サイズの独立表現
- 複数ページhandoff
- keep / pending / verifiedの意味
- local-first
- 研究所の「対象・工程・状態を明示する」部分
- 日本語の主操作語

## 4. 破

疑う。

- 1ページでもSPECIMEN RAILを常設する必要
- PROTOCOL SEQUENCEを常に同じ情報量で表示する必要
- Propertyカテゴリを最初に選ばせる必要
- 色診断やHTML auditを常時前面へ出す必要
- 右ペインを「全情報の置き場」にする構造
- 研究所英語ラベルを増やすこと自体の価値
- 再校をライブラリ上で別Boardとして見せ続けること

## 5. 離

将来的には以下を検討する。

- 選択対象ごとのIntentタイムライン
- Handoffを独立したDelivery状態として扱う
- Revision lineageを同一案件として見せる
- 未解決Instructionだけを前面に残すreview mode
- before / after / unexpected changeを一画面で確認するverification view

ただし今スプリントではデータモデルを変えない。

## 6. 研究所UI監査

| 要素 | 判断 | 理由 |
|---|---|---|
| WORKBENCH | 残す | 作業面という比喩が役割と一致 |
| SPECIMEN | 残す | 複数ページ時に対象認識を助ける |
| SPECIMEN RAIL | 条件付き | 複数ページでは有効、1ページでは無駄 |
| PROTOCOL | 残す | 指示書という既存概念と一致 |
| 5工程 | 残す・圧縮 | 現在地の理解に効くが狭い画面では強すぎる |
| 計測表示 | 弱める | 状態把握には有効だが主役ではない |
| 方眼 | 残す | 作業面の境界認識を邪魔しない範囲なら有効 |
| モノスペース | 補助だけ | 本文や操作語まで侵食させない |
| 英語ラベル | 二次情報 | 日本語理解より優先しない |
| LAB装飾 | 増やさない | 直接のUX改善にならない |

## 7. UX失敗モード

1. モバイルで横スクロールが発生する
2. 1ページなのに左レールで作業幅を失う
3. 囲った直後に何を押すべきか迷う
4. `形` が何を含むのか分かりにくい
5. `✎` の意味が初見で分からない
6. Propertyを先に選ぶためIntentから翻訳が必要
7. 個別指示が全体設定の下へ押し流される
8. 色診断が必要でない場面でも視線を取る
9. HTML auditが選択要素より強く見える
10. HTMLでも画像向けの「ドラッグして囲う」コピーが残る
11. 5工程が小画面で横幅を取りすぎる
12. topbarの4ツールが主作業と競合する
13. 複数ページ指示がページ単位で視覚的にまとまらない
14. AI handoff後の次の操作が文脈依存
15. 再校が別Boardに見えるため案件の連続性が弱い
16. `再校` タイトルだけでは何校目か把握しにくい
17. keepと「直った」の違いを学習する必要がある
18. 全体トーンと箇所トーンが同じ語彙で混同しうる
19. advanced機能の存在が初心者にも常時露出する
20. command検索が強力なのに隠し操作になっている
21. 保存失敗時に作業継続の判断が難しい
22. 複数ページhandoffで添付手順を覚える必要がある
23. blank / image / HTMLで操作モデルが少しずつ違う
24. 研究所英語が日本語の意味理解より目立つ可能性がある

## 8. 仮説

1. Intentを最初に選べればTime to first instructionが短くなる
2. 既存command engineを使えば新schemaなしでIntent-firstを検証できる
3. 1ページ時にrailを消すと主作業面が広がる
4. モバイルを縦1列にすれば横overflowをゼロにできる
5. 個別Instructionをglobal settingsより先に置くと確認速度が上がる
6. advanced diagnosticsを後段へ送ると初心者の概念負荷が下がる
7. Lab語彙は二次ラベルに留めた方が世界観と理解を両立できる
8. Revision schema移行より先にUI lineageを検証した方が失敗コストが低い
9. InstructionModelはIntent-first運用で実際の重複が確認されてから導入すべき
10. 複数ページではrailを残す方がページ切替コストが低い
11. HTMLとimageでガイダンス文を変えると初動の迷いが減る
12. 驚きはアニメーションより「言葉を入れたら既存指示へ正しく変換される」方が価値が高い

## 9. LAB Lite / Functional / Deep

| 案 | UX | 学習コスト | 実装コスト | 拡張性 | 驚き | 便利さ |
|---|---:|---:|---:|---:|---:|---:|
| LAB Lite | 5 | 5 | 5 | 3 | 2 | 5 |
| LAB Functional | 5 | 4 | 4 | 5 | 4 | 5 |
| LAB Deep | 3 | 2 | 2 | 5 | 5 | 3 |

採用: **LAB Functional**。

研究所概念を情報構造として使うが、Experiment / Specimen / Protocolを保存schemaの必須概念にはしない。

## 10. 削除・統合・隠す候補

1. 1ページ時のSPECIMEN RAIL → 非表示
2. 小画面の英語phase名 → 非表示
3. 小画面のboard identity → 非表示
4. 小画面の画像SIZE readout → 非表示
5. topbar英語補助ラベル → 小画面では非表示
6. 常時前面の画像色診断 → 後段へ
7. 常時前面のHTML audit → 後段へ
8. Property-firstだけの入口 → Intent入口と統合
9. `/`を知っている人だけ使えるcommand search → 可視化
10. 単一ページのページ番号rail → 削除
11. LAB装飾の追加 → やらない
12. 今スプリントでのExperiment schema → 後回し
13. 今スプリントでのInstructionModel formalization → 後回し

## 11. P0 / P1 / P2

### P0

1. Responsive / focus workspace
2. Intent-first entry point
3. Progressive disclosure of secondary information

### P1

- 複数ページ指示のページgrouping
- Revision lineageの表示改善
- repo-level browser E2E導入
- Handoff後の状態遷移整理

### P2

- InstructionModel正式化
- unexpected change検出
- before/after画像差分
- Experiment / Revision schema migration

## 12. 次の1スプリント

### Theme A — Focus Workspace

Problem: 狭い画面で作業領域が成立しない。

Change:
- 920px以下を縦1列化
- phaseを圧縮
- 1ページ時rail非表示

Expected UX effect: 横overflowをなくし、workbenchを優先する。

### Theme B — Intent First

Problem: 「こうしたい」をPropertyへ翻訳させている。

Change:
- 選択中Spotに対して「こうしたい」入力を表示
- 空入力では代表Intentを提示
- 入力時は既存command検索を使う

Expected UX effect: Intent → Propertyの順で操作できる。

### Theme C — Secondary Information Recedes

Problem: 全体設定・診断が個別指示より先に見える。

Change:
- 個別指示を視覚上優先
- global / diagnosticsを後段へ送る

Expected UX effect: protocol paneが「今直すこと」に集中する。

## 13. テスト計画

### unit

- Intent default suggestions
- natural language query → existing command
- Intent apply → existing export contract
- keep Intent

### contract

既存85 testsを維持。Intent層は新しい出力形式を作らず、既存Board/Noteへ変換する。

### integration

- Spot select → Intent apply → Sheet更新
- page change → selection reset
- image / HTML別guidance

### browser / E2E

今スプリントではPlaywrightをrepo依存へ追加しない。デプロイartifactをChromiumで手動検証する。

次スプリント候補として、最低以下を自動化する。

- 390px horizontal overflow = 0
- single-page rail absent
- multipage rail present
- Intent apply → HANDOFF phase
- HTML element selection

### usability

実案件1件で以下を計測する。

- first instructionまでの迷い回数
- handoffまでの往復
- advanced settingsを開いた回数

## 14. 成功指標

### Time to first instruction

画像投入から最初の有効Instruction生成まで。

### Time to handoff

画像投入からhandoff package作成まで。

### Decision hesitation

「次に何を押すか」で2秒以上停止した箇所を記録。

### Instruction completeness

handoff時に対象 / 変更 / 制約が欠けるInstruction数。

### Revision resolution rate

1回の再校でOKになったcarried spot / 全carried spot。

### Unexpected change detection

将来の差分機能導入時に計測。現時点では基準値を持たない。

### UI concept load

主導線で理解必須な概念数。目標は「対象・こうしたい・渡す・照合」中心に絞る。

## 15. 実装計画

- `src/lib/intents.ts`
  - existing command engineをIntent入口へ変換
- `src/panels/IntentDock.tsx`
  - 選択Spotの「こうしたい」UI
- `src/app.tsx`
  - single-page rail削除
  - source-aware bench hint
  - IntentDock配置
- `src/focus.css`
  - mobile single-column
  - compact phase
  - single-page layout
  - secondary informationを後段化
- `src/main.tsx`
  - focus layer読込
- `test/intents.test.ts`
  - Intent contract tests

## 16. 今回やらないこと

- AI機能の内蔵
- Experiment / Revision schema migration
- InstructionModelの正式導入
- 自動画像diff
- unexpected change自動検出
- 研究所アニメーション追加
- drawer / modal追加
- Playwright dependency追加

理由: いずれも今の最大ボトルネックではなく、概念・依存・migration costを増やす。

## 17. 最終判断

次は研究所らしさを増やすのではなく、**研究所UIを作業に従属させる**。
まずresponsive、Intent-first、secondary informationの後退を実装し、その実利用データを見てからInstructionModelとRevision modelを判断する。
