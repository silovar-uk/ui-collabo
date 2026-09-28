import type { AddPart, AddPlace } from '../schema';

/**
 * H1: 書き込む欄の言葉を、決定的な規則で読み取る。AIは使わない。
 * 規則は docs/kakikomu/mock.html の parseWish・pickVocab を正としてそのまま移した(PLAN-KAKIKOMU.md 4.2)。
 */

export const PART_WORDS: [string, AddPart][] = [
  ['区切り線', 'line'], ['罫線', 'line'], ['ライン', 'line'],
  ['入力欄', 'input'], ['検索窓', 'input'], ['検索欄', 'input'], ['フォーム', 'input'],
  ['小見出し', 'heading'], ['見出し', 'heading'], ['タイトル', 'heading'],
  ['説明文', 'text'], ['文章', 'text'], ['テキスト', 'text'], ['キャプション', 'text'], ['注釈', 'text'], ['文言', 'text'], ['説明', 'text'],
  ['イラスト', 'image'], ['サムネ', 'image'], ['画像', 'image'], ['写真', 'image'],
  ['アイコン', 'icon'], ['ボタン', 'button'], ['CTA', 'button'], ['リンク', 'link'],
  ['ボックス', 'box'], ['カード', 'box'], ['図形', 'box'], ['枠', 'box'], ['箱', 'box'], ['線', 'line'],
];

export const PART_LABEL: Record<AddPart, string> = {
  button: 'ボタン', heading: '見出し', text: '文', image: '画像', icon: 'アイコン', link: 'リンク', input: '入力欄', line: '区切り線', box: '箱',
};

export const PART_TAG: Record<AddPart, string> = {
  button: 'button', heading: 'h2', text: 'p', image: 'img', icon: 'svg', link: 'a', input: 'input', line: 'hr', box: 'div',
};

export const PLACE_LABEL: Record<AddPlace, string> = { below: '下', above: '上', left: '左', right: '右', inside: '中' };

export const HTML_PLACE: Record<AddPlace, string> = {
  below: '直後(下)', above: '直前(上)', left: '直前(左)', right: '直後(右)', inside: '内側の末尾',
};

const PLACE_RE = /(直後|直前|真下|真上|右上|左上|右下|左下|下|上|左|右|横|隣|中|内側)(?:の方|のほう|側)?(?:に|へ|の|あたり)|(直後|直前)/;
const PLACE_MAP: Record<string, AddPlace> = {
  直後: 'below', 真下: 'below', 下: 'below', 直前: 'above', 真上: 'above', 上: 'above', 左: 'left', 右: 'right', 横: 'right', 隣: 'right',
  右上: 'right', 右下: 'right', 左上: 'left', 左下: 'left', 中: 'inside', 内側: 'inside',
};
const ADD_RE = /(足|追加|付け|つけ|付与|置|入れ|加え|欲し|ほし|増や|設け|並べ)/;
const ADD_NEG_RE = /(さない|けない|かない|れない|えない|くない|さず|けず|かず|れず|えず)/;
const REMOVE_RE = /(消し|消す|消して|削除|なくし|なくす|無くし|いらない|要らない|不要|取り除|外し|外す|非表示|隠し|隠す)/;
const REMOVE_NEG_RE = /(消さない|消さず|削除しない|外さない|隠さない)/;
export const KEEP_RE = /(変えない|変えたくない|変えないで|そのままに|そのままで|残し|残す|消さない)/;
const LABEL_RE = /[「『"“]([^」』"”]+)[」』"”]/;

const TONE_SYNONYMS: Record<string, string[]> = {
  主張を強く: ['目立', '強調', '主張', 'インパクト'], 静かに: ['控えめ', '弱め', '落ち着', '静か', '地味'],
  シンプルに: ['シンプル', 'すっきり'], 上品に: ['上品', '高級'], 親しみやすく: ['親しみ', 'やさし'],
  にぎやかに: ['にぎやか', '派手'], 整然と: ['整然', '揃え', 'そろえ'],
};

// 相対語の語幹。[表示名, 減らす語幹[], 増やす語幹[], 減らす表示, 増やす表示]
const LADDER_WORDS: Record<string, [string, string[], string[], string, string]> = {
  fontSize: ['文字サイズ', ['小さ'], ['大き'], '小さく', '大きく'],
  scale: ['全体の大きさ', ['小さ'], ['大き'], '小さく', '大きく'],
  weight: ['文字の太さ', ['細く', '細め'], ['太く', '太め'], '細く', '太く'],
  spacing: ['余白', ['詰め', '狭く', '狭め'], ['広げ', '広く', '広め'], '詰める', '広げる'],
};
const STRONG_RE = /(ずっと|かなり|大幅|思い切り|思いきり)/;

export type ParsedWish = { kind: 'add'; part: AddPart; place: AddPlace; label?: string; said: string } | { kind: 'remove'; said: string };

export interface VocabPick {
  id: string;
  label: string;
}

/** 位置の語より後ろの部品名を優先する(「見出しの上に小見出し」の「見出し」は選んだ要素を指すため)。 */
function findPart(text: string, from = 0): { i: number; word: string; part: AddPart } | null {
  let best: { i: number; word: string; part: AddPart } | null = null;
  for (const [word, part] of PART_WORDS) {
    const i = text.indexOf(word, from);
    if (i < 0) continue;
    if (!best || i < best.i || (i === best.i && word.length > best.word.length)) best = { i, word, part };
  }
  return best ?? (from > 0 ? findPart(text, 0) : null);
}

/** 構造として読める(足す/消す)なら返す。どちらとも読める・どちらでもないならnull。 */
export function parseWish(raw: string): ParsedWish | null {
  const text = raw.trim();
  if (!text) return null;
  const placeMatch = text.match(PLACE_RE);
  const found = findPart(text, placeMatch ? placeMatch.index! + placeMatch[0].length : 0);
  // 動詞なしの「下にボタン」「下にボタン「詳しく見る」」も足すと読む(位置の語があり、部品名で終わるときだけ)
  const tail = text.replace(/[「『"“][^」』"”]*[」』"”]/g, '').replace(/[をがもはの、。!！?？\s]+$/, '');
  const verbless = !!found && !!placeMatch && tail.endsWith(found.word);
  const wantsAdd = !!found && (ADD_RE.test(text) || verbless) && !ADD_NEG_RE.test(text);
  const wantsRemove = REMOVE_RE.test(text) && !REMOVE_NEG_RE.test(text);
  if (wantsAdd && wantsRemove) return null;
  if (wantsAdd && found) {
    const place: AddPlace = placeMatch ? PLACE_MAP[placeMatch[1] ?? placeMatch[2]] : 'below';
    const label = text.match(LABEL_RE)?.[1];
    return { kind: 'add', part: found.part, place, label, said: text };
  }
  if (wantsRemove) return { kind: 'remove', said: text };
  return null;
}

/** 文の中から、既存の語彙(ひとこと・物差し・変えない)を拾う。自動では適用しない。最大3件。 */
export function pickVocab(raw: string): VocabPick[] {
  const text = raw.trim();
  const picks: VocabPick[] = [];
  for (const [chip, words] of Object.entries(TONE_SYNONYMS)) {
    if (words.some((w) => text.includes(w))) picks.push({ id: `tone:${chip}`, label: `ひとこと: ${chip}` });
  }
  const strong = STRONG_RE.test(text);
  for (const [attr, [name, dec, inc, decWord, incWord]] of Object.entries(LADDER_WORDS)) {
    for (const [stems, sign, word] of [[dec, -1, decWord], [inc, 1, incWord]] as [string[], number, string][]) {
      if (!stems.some((st) => text.includes(st))) continue;
      const delta = sign * (strong ? 2 : 1);
      picks.push({ id: `ladder:${attr}:${delta}`, label: `${name}: ${strong ? 'ずっと' : '少し'}${word}` });
    }
  }
  if (KEEP_RE.test(text)) picks.push({ id: 'keep', label: '変えない(この箇所を固定)' });
  return picks.slice(0, 3);
}
