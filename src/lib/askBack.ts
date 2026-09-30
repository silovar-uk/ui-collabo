import { hasSpecifiedContent } from './instructions';
import { spotDisplayName } from './describeElement';
import type { AddPart, Board, Note, Spot } from '../schema';

export type AskItem =
  | { key: string; spotId: string; type: 'empty'; spotLabel: string; question: string }
  | { key: string; spotId: string; type: 'tone-only'; spotLabel: string; question: string; chip: string }
  | { key: string; spotId: string; noteId: string; type: 'label'; spotLabel: string; question: string; part: AddPart }
  | { key: string; spotId: string; noteId: string; type: 'color-role'; spotLabel: string; question: string }
  | { key: string; spotId: string; type: 'selector'; spotLabel: string; question: string };

const ASK_ADD_PARTS: AddPart[] = ['button', 'link', 'heading'];

/** A2: 雰囲気だけのときに提案する具体チップ(4.8)。 */
export const TONE_TO_CONCRETE: Record<string, { commandId: string; label: string }[]> = {
  主張を強く: [
    { commandId: 'ladder:fontSize:1', label: '少し大きく' },
    { commandId: 'ladder:weight:1', label: '少し太く' },
  ],
  静かに: [
    { commandId: 'ladder:fontSize:-1', label: '少し小さく' },
    { commandId: 'ladder:weight:-1', label: '少し細く' },
  ],
  シンプルに: [{ commandId: 'ladder:spacing:1', label: '余白を広げる' }],
  にぎやかに: [{ commandId: 'motion:pop', label: '動き「ポンと出る」' }],
};

const PART_LABEL_JA: Record<AddPart, string> = {
  button: 'ボタン', heading: '見出し', text: '文', image: '画像', icon: 'アイコン', link: 'リンク', input: '入力欄', line: '区切り線', box: '箱',
};

function toneOnlyChip(spot: Spot): string | null {
  const note = spot.notes.find((n): n is Extract<Note, { kind: 'text' }> => n.kind === 'text');
  if (spot.notes.length !== 1 || !note || note.text || note.chips.length === 0) return null;
  const known = note.chips.find((c) => TONE_TO_CONCRETE[c]);
  return known ?? null;
}

/** 4.8: 決定的な規則だけで、AIが聞き返しそうな点を先回りする。渡す操作は止めない。 */
export function askBack(board: Board): AskItem[] {
  const items: AskItem[] = [];
  const isBrief = board.imageRole === null;

  for (const spot of board.spots) {
    const label = spotDisplayName(spot);

    // A1: 指示のない箇所(白紙レイアウトは対象外)
    if (!isBrief && !spot.keep && !hasSpecifiedContent(spot, board)) {
      items.push({ key: `empty:${spot.id}`, spotId: spot.id, type: 'empty', spotLabel: label, question: 'まだ指示がありません(このままでは渡されません)' });
    }

    // A2: 雰囲気チップだけ
    const chip = toneOnlyChip(spot);
    if (chip) {
      items.push({
        key: `tone:${spot.id}`,
        spotId: spot.id,
        type: 'tone-only',
        spotLabel: label,
        question: `「${chip}」だけだと、AIは何を変えるか迷います`,
        chip,
      });
    }

    for (const note of spot.notes) {
      // A3: 足すボタン・リンク・見出しの文言が未定
      if (note.kind === 'add' && ASK_ADD_PARTS.includes(note.part) && note.label === undefined) {
        items.push({
          key: `label:${note.id}`,
          spotId: spot.id,
          noteId: note.id,
          type: 'label',
          spotLabel: label,
          question: `足す${PART_LABEL_JA[note.part]}の文字は?`,
          part: note.part,
        });
      }
      // A4: 色の役割が未定
      if (note.kind === 'color' && note.role === undefined) {
        items.push({ key: `color:${note.id}`, spotId: spot.id, noteId: note.id, type: 'color-role', spotLabel: label, question: '色は文字・背景・線のどれ?' });
      }
    }

    // A5: HTMLの箇所で、セレクタが頼りなく(nth-child)、文字列も名前もない
    if (spot.element && /nth-child/.test(spot.element.selector) && !spot.element.text && !spot.label.trim()) {
      items.push({ key: `selector:${spot.id}`, spotId: spot.id, type: 'selector', spotLabel: label, question: 'この要素はAIが探しにくいかもしれません。名前を付けてください' });
    }
  }

  return items;
}
