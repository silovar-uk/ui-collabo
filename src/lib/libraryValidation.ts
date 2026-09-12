import { SCHEMA, type Board, type Library, type Note, type Rect, type Rules } from '../schema';

function fail(path: string, message: string): never {
  throw new Error(`ライブラリを読み込めません: ${path} ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value) fail(path, 'は文字列である必要があります');
  return value;
}

function rectAt(value: unknown, path: string): Rect {
  if (!isRecord(value)) fail(path, 'が不正です');
  const keys = ['x', 'y', 'w', 'h'] as const;
  const out = {} as Rect;
  for (const key of keys) {
    const n = value[key];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) fail(`${path}.${key}`, 'は0〜1の数値である必要があります');
    out[key] = n;
  }
  if (out.x + out.w > 1.000001 || out.y + out.h > 1.000001) fail(path, 'がページ範囲を超えています');
  return out;
}

function noteAt(value: unknown, path: string): Note {
  if (!isRecord(value)) fail(path, 'が不正です');
  stringAt(value.id, `${path}.id`);
  const kind = value.kind;
  if (!['ladder', 'color', 'font', 'motion', 'rule', 'text'].includes(String(kind))) fail(`${path}.kind`, 'が未対応です');
  if (kind === 'text') {
    if (typeof value.text !== 'string' || !Array.isArray(value.chips) || !value.chips.every((x) => typeof x === 'string')) fail(path, 'のtext指定が不正です');
  }
  if (kind === 'color') stringAt(value.target, `${path}.target`);
  if (kind === 'font') stringAt(value.mood, `${path}.mood`);
  if (kind === 'rule') stringAt(value.ruleRef, `${path}.ruleRef`);
  if (kind === 'motion') {
    stringAt(value.motion, `${path}.motion`);
    if (!['enter', 'hover', 'transition'].includes(String(value.trigger))) fail(`${path}.trigger`, 'が不正です');
  }
  if (kind === 'ladder') {
    if (!['fontSize', 'weight', 'spacing', 'radius', 'scale', 'lineWidth', 'speed', 'intensity'].includes(String(value.attr))) fail(`${path}.attr`, 'が不正です');
    if (!isRecord(value.target) || (typeof value.target.step !== 'number' && typeof value.target.delta !== 'number')) fail(`${path}.target`, 'が不正です');
  }
  return value as unknown as Note;
}

function rulesAt(value: unknown, path: string): Rules {
  if (!isRecord(value)) fail(path, 'が不正です');
  if (!Array.isArray(value.palette) || !Array.isArray(value.type) || !Array.isArray(value.motion) || !Array.isArray(value.tone)) fail(path, 'の配列が不足しています');
  return value as unknown as Rules;
}

function boardAt(value: unknown, path: string): Board {
  if (!isRecord(value)) fail(path, 'が不正です');
  if (value.schema !== SCHEMA) fail(`${path}.schema`, `は${SCHEMA}である必要があります`);
  stringAt(value.id, `${path}.id`);
  if (typeof value.title !== 'string') fail(`${path}.title`, 'が不正です');
  if (!isRecord(value.format) || !['web', 'slide', 'free'].includes(String(value.format.kind))) fail(`${path}.format`, 'が不正です');
  if (value.imageRole !== null && !['draft', 'reference'].includes(String(value.imageRole))) fail(`${path}.imageRole`, 'が不正です');
  if (!Array.isArray(value.pages) || !Array.isArray(value.spots) || !Array.isArray(value.order)) fail(path, 'のpages/spots/orderが不正です');
  rulesAt(value.rules, `${path}.rules`);

  const pageIds = new Set<string>();
  value.pages.forEach((raw, i) => {
    const p = `${path}.pages[${i}]`;
    if (!isRecord(raw)) fail(p, 'が不正です');
    const id = stringAt(raw.id, `${p}.id`);
    if (pageIds.has(id)) fail(`${p}.id`, 'が重複しています');
    pageIds.add(id);
    if (raw.image !== null) {
      if (!isRecord(raw.image) || typeof raw.image.dataUrl !== 'string' || typeof raw.image.width !== 'number' || typeof raw.image.height !== 'number') fail(`${p}.image`, 'が不正です');
    }
    if (raw.source !== undefined) {
      if (!isRecord(raw.source) || raw.source.kind !== 'html' || typeof raw.source.html !== 'string') fail(`${p}.source`, 'が不正です');
    }
  });

  const spotIds = new Set<string>();
  const spotNumbers = new Set<number>();
  value.spots.forEach((raw, i) => {
    const p = `${path}.spots[${i}]`;
    if (!isRecord(raw)) fail(p, 'が不正です');
    const id = stringAt(raw.id, `${p}.id`);
    if (spotIds.has(id)) fail(`${p}.id`, 'が重複しています');
    spotIds.add(id);
    const pageId = stringAt(raw.pageId, `${p}.pageId`);
    if (!pageIds.has(pageId)) fail(`${p}.pageId`, 'が存在しないページを参照しています');
    if (typeof raw.n !== 'number' || raw.n < 1 || !Number.isInteger(raw.n)) fail(`${p}.n`, 'が不正です');
    if (spotNumbers.has(raw.n)) fail(`${p}.n`, 'が重複しています');
    spotNumbers.add(raw.n);
    rectAt(raw.rect, `${p}.rect`);
    if (raw.targetRect !== undefined) rectAt(raw.targetRect, `${p}.targetRect`);
    if (typeof raw.keep !== 'boolean' || !Array.isArray(raw.notes)) fail(p, 'のkeep/notesが不正です');
    raw.notes.forEach((note, n) => noteAt(note, `${p}.notes[${n}]`));
    if (raw.check !== undefined && !['ok', 'ng'].includes(String(raw.check))) fail(`${p}.check`, 'が不正です');
  });

  value.order.forEach((id, i) => {
    if (typeof id !== 'string' || !spotIds.has(id)) fail(`${path}.order[${i}]`, 'が存在しない箇所を参照しています');
  });

  return value as unknown as Board;
}

export function validateLibrary(parsed: unknown): Library {
  if (!isRecord(parsed)) fail('root', 'が不正です');
  if (parsed.schema !== SCHEMA) fail('schema', `は${SCHEMA}である必要があります`);
  if (!Array.isArray(parsed.boards) || !Array.isArray(parsed.templates) || !Array.isArray(parsed.ruleSets)) fail('root', 'のboards/templates/ruleSetsが不正です');

  const boardIds = new Set<string>();
  parsed.boards.forEach((raw, i) => {
    const board = boardAt(raw, `boards[${i}]`);
    if (boardIds.has(board.id)) fail(`boards[${i}].id`, 'が重複しています');
    boardIds.add(board.id);
  });
  parsed.templates.forEach((raw, i) => boardAt(raw, `templates[${i}]`));
  parsed.ruleSets.forEach((raw, i) => {
    const p = `ruleSets[${i}]`;
    if (!isRecord(raw)) fail(p, 'が不正です');
    stringAt(raw.id, `${p}.id`);
    stringAt(raw.name, `${p}.name`);
    rulesAt(raw.rules, `${p}.rules`);
  });
  return parsed as unknown as Library;
}

export function parseLibraryJson(text: string): Library {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('ライブラリを読み込めません: JSON形式が壊れています');
  }
  return validateLibrary(parsed);
}

/**
 * アプリ自身が過去に保存した同一schemaデータ向けの保守的な補正。
 * 外部importには使わず、起動時だけ「既知の軽微な不整合」を直してから厳格検証する。
 * 参照切れや型崩れは推測で直さず、validateLibraryで拒否する。
 */
export function repairStoredLibrary(parsed: unknown): unknown {
  if (!isRecord(parsed) || parsed.schema !== SCHEMA) return parsed;
  if (!Array.isArray(parsed.boards) || !Array.isArray(parsed.templates) || !Array.isArray(parsed.ruleSets)) return parsed;

  const repairBoard = (raw: unknown): unknown => {
    if (!isRecord(raw)) return raw;
    const board = { ...raw } as Record<string, unknown>;
    if (board.imageRole === undefined) board.imageRole = null;
    if (!isRecord(board.tone)) board.tone = { chips: [], text: '' };
    if (isRecord(board.rules)) {
      board.rules = {
        ...board.rules,
        palette: Array.isArray(board.rules.palette) ? board.rules.palette : [],
        type: Array.isArray(board.rules.type) ? board.rules.type : [],
        motion: Array.isArray(board.rules.motion) ? board.rules.motion : [],
        tone: Array.isArray(board.rules.tone) ? board.rules.tone : [],
      };
    }
    const spots = board.spots;
    if (Array.isArray(spots)) {
      // 過去に一括作成時の採番重複があり得たため、配列順で安全に振り直す。
      const repairedSpots = spots.map((spot: unknown, index: number) => isRecord(spot) ? { ...spot, n: index + 1 } : spot);
      board.spots = repairedSpots;
      const ids = new Set(
        repairedSpots.filter(isRecord).map((spot) => spot.id).filter((id): id is string => typeof id === 'string'),
      );
      if (Array.isArray(board.order)) board.order = board.order.filter((id) => typeof id === 'string' && ids.has(id));
    }
    return board;
  };

  return {
    ...parsed,
    boards: parsed.boards.map(repairBoard),
    templates: parsed.templates.map(repairBoard),
  };
}
