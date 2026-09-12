import { ALL_COMMANDS, searchCommands, type Command } from './commands';

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
 */
export function intentSuggestions(query: string, limit = 8): IntentSuggestion[] {
  const q = query.trim();
  if (q) {
    return searchCommands(ALL_COMMANDS, q)
      .slice(0, limit)
      .map((command) => ({ command, label: command.label }));
  }

  return DEFAULT_INTENTS.flatMap(({ id, label }) => {
    const command = ALL_COMMANDS.find((candidate) => candidate.id === id);
    return command ? [{ command, label }] : [];
  }).slice(0, limit);
}
