// brand/ のSVGから public/ の配信用PNGを生成する。ブランド資産を変更したら再実行する。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function render(svgPath, pngPath, width, background) {
  const svg = readFileSync(join(root, svgPath), 'utf8');
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width }, background });
  writeFileSync(join(root, pngPath), resvg.render().asPng());
  console.log(`${pngPath} を生成しました`);
}

// mark.svg は透明背景なので、アイコンは paper 背景に乗せる
render('brand/mark.svg', 'public/icon-512.png', 512, '#F7F4EE');
// og.svg は背景を自前で持つので透明のまま(svgの矩形がそのまま出る)
render('brand/og.svg', 'public/og.png', 1200, 'rgba(0,0,0,0)');
