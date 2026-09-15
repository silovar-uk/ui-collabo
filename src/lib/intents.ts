import { ALL_COMMANDS, searchCommands, type Command } from './commands';
import * as notes from './notes';
import type { Board, LadderAttr, Spot } from '../schema';

export interface IntentSuggestion {
  command: Command;
  label: string;
}

const DEFAULT_INTENTS: { id: string; label: string }[] = [
  { id: 'tone:主張を強く', label: 'もっと目立たせたい' },
  { id: 'tone:静かに', label: '少し弱めたい' },
  { id: 'ladder:scale:1', label: '少し大きくしたい' },
  { id: 'ladder:scale:-1', label: '少し小さくしたい' },
  { id: 'ladder:spacing:1', label: '余白を広げたい' },
  { id: 'ladder:spacing:-1', label: '間を詰めたい' },
  { id: 'position:center-x', label: '左右中央に置きたい' },
  { id: 'keep', label: 'ここは変えたくない' },
];

/**
 * Intent-first entry point.
 * 空入力では頻出の「したいこと」を返し、入力があれば既存のcommand検索へ委譲する。
 * データモデルを増やさず、property-firstの詳細指定を一段奥へ置けるようにする。
 * HTMLの箇所(spot.elementあり)には位置(position:*)を出さない(効かないため)。
 */
export function intentSuggestions(query: string, spot?: Spot, limit = 8): IntentSuggestion[] {
  const excludePosition = (command: Command) => !(spot?.element && command.id.startsWith('position:'));
  const q = query.trim();
  if (q) {
    return searchCommands(ALL_COMMANDS, q)
      .filter(excludePosition)
      .slice(0, limit)
      .map((command) => ({ command, label: command.label }));
  }

  return DEFAULT_INTENTS.flatMap(({ id, label }) => {
    const command = ALL_COMMANDS.find((candidate) => candidate.id === id);
    return command && excludePosition(command) ? [{ command, label }] : [];
  }).slice(0, limit);
}

/** その意図(候補)が、いまこの箇所にすでに適用されているか。候補チップの✓表示に使う。 */
export function isIntentApplied(commandId: string, spot: Spot): boolean {
  if (commandId === 'keep') return spot.keep;
  if (commandId.startsWith('tone:')) {
    const chip = commandId.slice('tone:'.length);
    return spot.notes.some((n) => n.kind === 'text' && n.chips.includes(chip));
  }
  if (commandId.startsWith('ladder:')) {
    const [, attr, deltaStr] = commandId.split(':');
    const delta = Number(deltaStr);
    return spot.notes.some((n) => n.kind === 'ladder' && n.attr === attr && 'delta' in n.target && n.target.delta === delta);
  }
  return false;
}

/** 適用済みなら外し、未適用ならcommand.applyする。候補チップのトグルに使う。 */
export function toggleIntent(board: Board, spot: Spot, commandId: string): Board {
  const command = ALL_COMMANDS.find((candidate) => candidate.id === commandId);
  if (!command) return board;
  if (!isIntentApplied(commandId, spot)) return command.apply(board, spot);

  if (commandId === 'keep') return notes.setKeep(spot.id, false)(board);
  if (commandId.startsWith('tone:')) {
    const chip = commandId.slice('tone:'.length);
    return notes.updateTextNote(spot.id, (n) => ({ ...n, chips: n.chips.filter((c) => c !== chip) }))(board);
  }
  if (commandId.startsWith('ladder:')) {
    const [, attr] = commandId.split(':');
    return notes.removeLadder(spot.id, attr as LadderAttr)(board);
  }
  return board;
}
