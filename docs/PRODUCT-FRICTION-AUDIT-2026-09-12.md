# UI ColLabo — Product Friction Audit

実施日: 2026-09-12

## 1. 現在地

UI ColLaboは、基本フローとProduct Contractが成立した後の「実案件で迷いを削る」段階にある。

中核は変えない。

`貼る → 囲う → 選ぶ → 渡す → 照合`

前スプリントで、Intent-first、単一ページ時のrail削除、mobile overflow解消まで完了した。今回の監査では、その次の問題を既存案から選ぶのではなく、コードと実利用シナリオから再評価した。

## 2. 実利用で見えた摩擦

### A. 単一ページ

Intent-firstにより、最初のInstructionまではかなり短くなった。Propertyを先に解読させる問題は前スプリントで改善している。

### B. 複数ページ

次のボトルネックはここ。

Workbenchは「今見ている1ページ」を主役にしている一方、Protocol paneは全ページのSpotを1本の一覧として扱っていた。

そのため、ページ数・指示数が増えるほど、以下が発生する。

- 今見ているページと指示書の対応が弱い
- 指示がどのページ所属か判別しづらい
- 別ページの指示を選んでもWorkbenchがそのページへ移動しない
- 複数ページになるとProtocol paneが長くなる

Export側はすでに `## p.N` 単位でページを分けているため、UIと出力で情報構造が一致していなかった。

### C. DOM / Accessibility

前スプリントでは「個別Instructionを全体設定・診断より先に見せる」ためCSS `order` を使用していた。

見た目は改善したが、DOM順は以前のままだった。その結果、視覚順とキーボード・読み上げ順が一致しない。

### D. 中断・再開

Handoff後の状態はまだ永続化されていない。

`ExportButton` の `exported` はcomponent-local stateなので、reloadすると「AIへ渡した後で修正版待ち」という状態が消える。

これは重要だが、正しく直すにはBoardにhandoff lifecycleを持たせるか、別の永続状態モデルを設計する必要がある。Product Contractに関わるため、今回のNOWでは実装しない。

### E. Revision

再校は別Boardとして保存されるため、案件の連続性はまだ弱い。ただし、現行のround contractは正しく未解決Instructionを持ち越せている。

UI lineage改善とschema migrationは分けて考えるべき。

## 3. Root Cause

今回の中心問題は「ページナビが足りない」ではない。

**Workbenchの情報単位がPageなのに、Protocol paneの情報単位がBoard全体のままだったこと。**

同じタスク内で2つの異なる情報単位をユーザーに往復させていた。

## 4. NOW

### Page-focused Protocol

Schemaを変えずに、Protocol paneをWorkbenchと同じPage単位へ揃える。

実装:

- active pageのInstructionを先頭表示
- 他ページはページごとの折りたたみセクション
- 他ページを開いたらWorkbenchもそのページへ移動
- Spot cardを選んだ場合も対応ページへ移動
- DOM順を `page instructions → global settings → diagnostics → handoff` に変更
- CSS orderは見た目の補助だけにし、情報構造のsource of truthにしない

Acceptance Criteria:

1. 3ページのBoardで、Protocol pane上部だけを見て現在ページと指示数を判断できる。
2. p.2のセクションを開くとWorkbenchもp.2へ移動する。
3. active pageのInstructionがglobal settingsよりDOM上でも先に来る。
4. single-page flowの操作数を増やさない。
5. Board / Spot / Note schemaとexport outputを変えない。

## 5. NEXT

### Persistent Handoff State

「AIへ渡した」「修正版待ち」「再校中」をreload後も復元できる状態モデルを設計する。

検討する最小モデル:

`editing → handedOff → verifying → resolved`

ただしBoard schemaへ足す前に、状態遷移と既存データ互換を設計する。

### Revision Lineage

Library上で `(再校)` Boardを独立案件のように見せず、同一案件のrevision chainとして表現する。

まずUI groupingで価値を検証し、必要になるまでschema migrationはしない。

## 6. NOT YET

- AI画像diff
- unexpected change自動検出
- InstructionModel正式化
- Experiment schema導入
- LAB装飾追加

## 7. セキュリティ / Technical Debt

`npm ci` は現在も5 vulnerabilities（3 moderate / 1 high / 1 critical）を報告している。

`npm audit fix --force` は行わない。次のtechnical maintenanceでdependency pathを確認し、runtimeかdev-onlyかを分けた上で最小upgradeを行う。

## 8. 成功判定

今回の変更後、3ページ以上の実案件で以下を確認する。

- ページを跨いで指示を探す時間が減る
- active pageとProtocolの所属を取り違えない
- global settingsを見るためのスクロールがInstruction確認を邪魔しない
- single-pageでは従来より操作が増えていない

次の構造変更は、この結果を確認してから決める。
