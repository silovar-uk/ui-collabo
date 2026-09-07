import { SCHEMA, type Board } from './schema';

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const WEB_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1600" viewBox="0 0 1280 1600">
  <rect width="1280" height="1600" fill="#ffffff" />
  <rect x="0" y="0" width="1280" height="90" fill="#1c1b19" />
  <text x="48" y="55" font-family="sans-serif" font-size="28" fill="#ffffff">MyService</text>
  <text x="90" y="330" font-family="sans-serif" font-size="72" font-weight="700" fill="#111111">もっと、はやく、届く。</text>
  <text x="90" y="420" font-family="sans-serif" font-size="28" fill="#555555">申し込みから最短1日で利用開始できるクラウド在庫管理サービスです。</text>
  <rect x="90" y="470" width="220" height="72" rx="8" fill="#3266cc" />
  <text x="130" y="516" font-family="sans-serif" font-size="26" fill="#ffffff">今すぐ試す</text>
  <rect x="700" y="220" width="480" height="360" rx="16" fill="#e8edf7" />
  <rect x="90" y="700" width="1100" height="700" fill="#f4f4f4" />
</svg>`.trim();

const SLIDE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#ffffff" />
  <text x="100" y="150" font-family="sans-serif" font-size="56" font-weight="700" fill="#111111">2026年度 第2四半期報告</text>
  <text x="100" y="300" font-family="sans-serif" font-size="30" fill="#333333">・売上は前年同期比 118%</text>
  <text x="100" y="350" font-family="sans-serif" font-size="30" fill="#333333">・新規契約数は 42 件</text>
  <text x="100" y="400" font-family="sans-serif" font-size="30" fill="#333333">・解約率は 2.1% に低下</text>
  <rect x="780" y="260" width="400" height="300" fill="#e8edf7" />
  <text x="1550" y="600" font-family="sans-serif" font-size="24" fill="#999999">1 / 12</text>
</svg>`.trim();

function sampleBoard(partial: Omit<Board, 'schema' | 'createdAt' | 'updatedAt'>): Board {
  const now = new Date().toISOString();
  return { schema: SCHEMA, createdAt: now, updatedAt: now, ...partial };
}

export const SAMPLES: { id: string; label: string; board: Board }[] = [
  {
    id: 'sample-web',
    label: 'サンプル: Webページ',
    board: sampleBoard({
      id: 'sample-web-template',
      title: 'サンプル: サービス紹介ページ',
      format: { kind: 'web' },
      imageRole: 'draft',
      pages: [{ id: 'page-1', image: { dataUrl: svgDataUrl(WEB_SVG), width: 1280, height: 1600 } }],
      spots: [
        {
          id: 'spot-1',
          pageId: 'page-1',
          n: 1,
          label: '見出し',
          rect: { x: 0.07, y: 0.18, w: 0.6, h: 0.08 },
          targetRect: { x: 0.07, y: 0.14, w: 0.6, h: 0.08 },
          keep: false,
          notes: [{ id: 'note-1', kind: 'ladder', attr: 'fontSize', target: { delta: -1 } }],
        },
        {
          id: 'spot-2',
          pageId: 'page-1',
          n: 2,
          label: 'CTAボタン',
          rect: { x: 0.07, y: 0.29, w: 0.17, h: 0.045 },
          keep: false,
          notes: [
            { id: 'note-2', kind: 'color', role: 'accent', current: '#3266cc', target: '#c94a1d', via: 'warm' },
            { id: 'note-3', kind: 'motion', motion: 'pop', trigger: 'enter', speed: 0.4, intensity: 2 },
          ],
        },
        {
          id: 'spot-3',
          pageId: 'page-1',
          n: 3,
          label: 'ヒーロー画像',
          rect: { x: 0.55, y: 0.14, w: 0.375, h: 0.225 },
          keep: true,
          notes: [],
        },
      ],
      rules: {
        palette: [
          { role: 'bg', hex: '#ffffff' },
          { role: 'text', hex: '#111111' },
          { role: 'accent', hex: '#c94a1d' },
        ],
        type: [{ role: 'heading', mood: 'clear-gothic', size: 40 }],
        spacing: 4,
        motion: [{ trigger: 'enter', motion: 'fade-up', speed: 0.4, intensity: 2 }],
        tone: ['整然と', 'シンプルに'],
      },
      tone: { chips: ['整然と'], text: '' },
      order: ['spot-1', 'spot-3', 'spot-2'],
    }),
  },
  {
    id: 'sample-slide',
    label: 'サンプル: スライド',
    board: sampleBoard({
      id: 'sample-slide-template',
      title: 'サンプル: 四半期報告スライド',
      format: { kind: 'slide', aspect: '16:9' },
      imageRole: 'draft',
      pages: [{ id: 'page-1', image: { dataUrl: svgDataUrl(SLIDE_SVG), width: 1280, height: 720 } }],
      spots: [
        {
          id: 'spot-1',
          pageId: 'page-1',
          n: 1,
          label: '見出し',
          rect: { x: 0.08, y: 0.13, w: 0.7, h: 0.12 },
          keep: true,
          notes: [],
        },
        {
          id: 'spot-2',
          pageId: 'page-1',
          n: 2,
          label: '箇条書き',
          rect: { x: 0.08, y: 0.36, w: 0.5, h: 0.25 },
          targetRect: { x: 0.08, y: 0.36, w: 0.5, h: 0.3 },
          keep: false,
          notes: [{ id: 'note-1', kind: 'ladder', attr: 'spacing', target: { delta: 1 } }],
        },
        {
          id: 'spot-3',
          pageId: 'page-1',
          n: 3,
          label: 'グラフ',
          rect: { x: 0.61, y: 0.36, w: 0.31, h: 0.42 },
          keep: false,
          notes: [{ id: 'note-2', kind: 'motion', motion: 'fade-up', trigger: 'enter', speed: 0.4, intensity: 2 }],
        },
      ],
      rules: {
        palette: [{ role: 'accent', hex: '#3266cc' }],
        type: [{ role: 'heading', mood: 'clear-gothic', size: 40 }],
        spacing: undefined,
        motion: [],
        tone: ['整然と'],
      },
      tone: { chips: [], text: '' },
      order: [],
    }),
  },
];
