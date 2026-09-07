# ブランド資産

## シンボル

墨色(ink)の塗り四角と、朱色(vermilion)の点線四角のズレが「今」と「こうしたい」を表します。
このズレの表現は、アプリ内で箇所を動かすときの見た目そのものと一致しています。

- `mark.svg` — シンボル本体(64×64)
- `mark-small.svg` — 16px相当の小サイズ用。点線が潰れるため実線に変更
- `logo.svg` — シンボル + ワードマーク
- `og.svg` — SNSカード用(1200×630)。`scripts/render-assets.mjs` で `public/og.png` を生成

## 色

| 役割 | 名前 | 値 |
|---|---|---|
| 文字・今の箱 | ink | `#1C1B19` |
| 背景 | paper | `#F7F4EE` |
| こうしたい・強調 | vermilion | `#E4572E` |
| 補助文字 | muted | `#8A857C` |
| 罫線 | line | `#D9D3C7` |

## タイポグラフィ

ワードマークは `Inter 600`。本文は `Inter` + `Noto Sans JP`(Google Fonts)。
