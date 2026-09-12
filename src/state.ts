import { signal, computed, effect } from '@preact/signals';
import { kvGet, kvSet } from './lib/storage';
import { emptyLibrary, newBoard, type Board, type Format, type LadderAttr, type Library, type RuleSet, type Rules, type Spot } from './schema';
import { parseLibraryJson, repairStoredLibrary, validateLibrary } from './lib/libraryValidation';
import type { ElementRecord } from './lib/audit';

const LIBRARY_KEY = 'library';
const LAST_BOARD_KEY = 'lastBoardId';
const SAVE_DEBOUNCE_MS = 500;

export const ready = signal(false);
export const library = signal<Library>(emptyLibrary());
export const currentBoardId = signal<string | null>(null);
export const selectedSpotId = signal<string | null>(null);
export const saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

// ponytail: 直接操作の道具として十分な深さ。無限に持つとメモリを圧迫するため50段で打ち切る
const UNDO_LIMIT = 50;
const MERGE_WINDOW_MS = 500;
let undoStack: Board[] = [];
let redoStack: Board[] = [];
let lastPushAt = 0;

/** ピッカー(ポップオーバー等)が開いているか。Escapeで選択解除より先にこれを閉じる。 */
export const pickerOpen = signal(false);

export interface Toast {
  message: string;
  onUndo?: () => void;
}
export const toast = signal<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function showToast(message: string, onUndo?: () => void): void {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { message, onUndo };
  toastTimer = setTimeout(() => {
    toast.value = null;
  }, 5000);
}

export const currentBoard = computed<Board | null>(() => {
  const id = currentBoardId.value;
  if (!id) return null;
  return library.value.boards.find((b) => b.id === id) ?? null;
});

/** 表示中のページ(UI状態のみ。永続化しない)。 */
export const activePageId = signal<string | null>(null);
effect(() => {
  const board = currentBoard.value;
  if (!board) {
    activePageId.value = null;
    return;
  }
  if (!board.pages.some((p) => p.id === activePageId.value)) {
    activePageId.value = board.pages[0]?.id ?? null;
  }
});

export async function init(): Promise<void> {
  try {
    const loaded = await kvGet<unknown>(LIBRARY_KEY);
    if (loaded) {
      try {
        library.value = validateLibrary(loaded);
      } catch {
        // 過去版で起こり得た採番重複など、既知の軽微な不整合だけを補正して再検証する。
        library.value = validateLibrary(repairStoredLibrary(loaded));
        showToast('過去の保存データを安全な形式へ補正しました');
      }
    }
    const lastId = await kvGet<string>(LAST_BOARD_KEY);
    if (lastId && library.value.boards.some((b) => b.id === lastId)) {
      currentBoardId.value = lastId;
    }
    saveStatus.value = 'saved';
  } catch {
    saveStatus.value = 'error';
    showToast('保存領域を読み込めませんでした。変更が保存されない可能性があります');
  } finally {
    ready.value = true;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveStatus.value = 'saving';
  saveTimer = setTimeout(() => {
    void kvSet(LIBRARY_KEY, library.value)
      .then(() => { saveStatus.value = 'saved'; })
      .catch(() => {
        saveStatus.value = 'error';
        showToast('保存に失敗しました。ライブラリを書き出して退避してください');
      });
  }, SAVE_DEBOUNCE_MS);
}

function resetUndoHistory(): void {
  undoStack = [];
  redoStack = [];
  lastPushAt = 0;
}

export function createBoard(format: Format): Board {
  const board = newBoard(format);
  library.value = { ...library.value, boards: [...library.value.boards, board] };
  currentBoardId.value = board.id;
  resetUndoHistory();
  void kvSet(LAST_BOARD_KEY, board.id);
  scheduleSave();
  return board;
}

export function openBoard(id: string): void {
  currentBoardId.value = id;
  selectedSpotId.value = null;
  resetUndoHistory();
  void kvSet(LAST_BOARD_KEY, id);
}

/** R2: すでに組み立て済みのボード(照合の再校など)をライブラリに足して開く。 */
export function addAndOpenBoard(board: Board): void {
  library.value = { ...library.value, boards: [...library.value.boards, board] };
  currentBoardId.value = board.id;
  selectedSpotId.value = null;
  void kvSet(LAST_BOARD_KEY, board.id);
  scheduleSave();
}

export function deleteBoard(id: string): void {
  library.value = { ...library.value, boards: library.value.boards.filter((b) => b.id !== id) };
  if (currentBoardId.value === id) currentBoardId.value = null;
  scheduleSave();
}

/**
 * 現在のボードを recipe で更新し、自動保存をスケジュールする。
 * 直前の積み込みから500ms以内の更新は同じ1段にまとめる(ラベルの打鍵が1文字ずつ積まれないため)。
 */
export function updateBoard(recipe: (board: Board) => Board): void {
  const board = currentBoard.value;
  if (!board) return;
  const now = Date.now();
  if (now - lastPushAt > MERGE_WINDOW_MS) {
    undoStack.push(board);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    redoStack = [];
  }
  lastPushAt = now;
  const next = { ...recipe(board), updatedAt: new Date().toISOString() };
  library.value = {
    ...library.value,
    boards: library.value.boards.map((b) => (b.id === next.id ? next : b)),
  };
  scheduleSave();
}

export function undo(): void {
  const board = currentBoard.value;
  const prev = undoStack.pop();
  if (!board || !prev) return;
  redoStack.push(board);
  if (redoStack.length > UNDO_LIMIT) redoStack.shift();
  library.value = { ...library.value, boards: library.value.boards.map((b) => (b.id === prev.id ? prev : b)) };
  lastPushAt = 0; // 次の更新は必ず新しい段として積む
  scheduleSave();
}

export function redo(): void {
  const board = currentBoard.value;
  const next = redoStack.pop();
  if (!board || !next) return;
  undoStack.push(board);
  if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  library.value = { ...library.value, boards: library.value.boards.map((b) => (b.id === next.id ? next : b)) };
  lastPushAt = 0;
  scheduleSave();
}

/** 箇所を削除し、元に戻せるトーストを5秒出す。 */
export function deleteSpot(id: string): void {
  const board = currentBoard.value;
  const spot = board?.spots.find((s) => s.id === id);
  if (!board || !spot) return;
  updateBoard((b) => ({ ...b, spots: b.spots.filter((s) => s.id !== id) }));
  if (selectedSpotId.value === id) selectedSpotId.value = null;
  showToast(`箇所${spot.n}を削除しました`, () => undo());
}

export function nextSpotNumber(board: Board): number {
  return board.spots.length === 0 ? 1 : Math.max(...board.spots.map((s) => s.n)) + 1;
}

export function findSpot(board: Board, id: string): Spot | undefined {
  return board.spots.find((s) => s.id === id);
}

/**
 * スポイトで色を拾う予約。null 以外の間、ボードのクリックは箇所作成ではなく色の採取になり、
 * 拾った hex は onPick に渡される。書き込み先(箇所のノート/ルール)は呼び出し側が onPick に閉じ込める。
 */
export const colorPickRequest = signal<{ onPick: (hex: string) => void } | null>(null);

/**
 * R1-a: 定規で測る予約。null以外の間、ボードのドラッグは箇所作成ではなく長さの測定になり、
 * 最寄りの段(ステップ番号)がonMeasureに渡される。書き込み先は呼び出し側がonMeasureに閉じ込める。
 */
export const measureRequest = signal<{ attr: LadderAttr; onMeasure: (stepIndex: number) => void } | null>(null);

/** 「見る順」モード。true の間、箇所クリックは選択ではなく見る順への追加/削除になる。 */
export const orderMode = signal(false);

/** レンズ(H1)。両ページ種別共通の「いま/こうしたい」切替。 */
export const lens = signal<'after' | 'before'>('after');
/** スペースキーを押している間だけtrue。両ボードでlensより優先し、一時的に「いま」を覗ける。 */
export const spaceHeld = signal(false);

// --- H3: 指示書(Sheet)とパレット(Palette)の橋渡し ---

/** Sheetの行にホバーすると、対応する箇所のボード上での強調に使う。 */
export const hoverSpotId = signal<string | null>(null);
/** 引き出し線(H3)を描くための、いまホバー中の行のキー。 */
export const hoverLine = signal<{ spotId: string; lineKey: string } | null>(null);

/** R1-b: 色の棚卸しでスウォッチにホバーしたときの、ボード上でのハイライト色。 */
export const paletteHoverColor = signal<string | null>(null);

// --- R1-c: HTMLページのばらつき診断 ---
/** 表示中のHTMLページから集めた要素記録(HtmlBoardが更新する)。 */
export const htmlAuditRecords = signal<ElementRecord[] | null>(null);
/** 診断の値にホバーしたときに、iframe内で朱の点線囲みを出すセレクタ一覧。 */
export const auditHoverSelectors = signal<string[] | null>(null);
/** 「ルールで校正する」の要求。trueにするとHtmlBoardがルールから外れた要素を箇所にし、falseへ戻す。 */
export const auditRuleCheckRequest = signal(false);

export type PaletteCategory = 'position' | 'color' | 'font' | 'ladder' | 'motion' | 'text' | 'rule';
/** Sheetの行をクリックすると、その行を作ったピッカーをPaletteで開く要求。Paletteが読んだら自分でnullに戻す。 */
export const requestOpenCategory = signal<{ spotId: string; category: PaletteCategory } | null>(null);

export function toggleOrderSpot(id: string): void {
  updateBoard((b) => ({
    ...b,
    order: b.order.includes(id) ? b.order.filter((x) => x !== id) : [...b.order, id],
  }));
}

// --- ライブラリ(ルールセット・型・書き出し/読み込み) ---

export function saveRuleSet(name: string, rules: Rules): void {
  const ruleSet: RuleSet = { id: crypto.randomUUID(), name, rules, createdAt: new Date().toISOString() };
  library.value = { ...library.value, ruleSets: [...library.value.ruleSets, ruleSet] };
  scheduleSave();
}

export function applyRuleSet(id: string): void {
  const ruleSet = library.value.ruleSets.find((r) => r.id === id);
  if (!ruleSet) return;
  updateBoard((b) => ({ ...b, rules: ruleSet.rules }));
}

export function deleteRuleSet(id: string): void {
  library.value = { ...library.value, ruleSets: library.value.ruleSets.filter((r) => r.id !== id) };
  scheduleSave();
}

/** 現在のボードを画像抜き(箇所配置+ルールのみ)で型として複製保存する。 */
export function saveAsTemplate(): void {
  const board = currentBoard.value;
  if (!board) return;
  const now = new Date().toISOString();
  const template: Board = {
    ...board,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    imageRole: null,
    pages: board.pages.map((p) => ({ id: p.id, label: p.label, image: null })),
  };
  library.value = { ...library.value, templates: [...library.value.templates, template] };
  scheduleSave();
}

export function deleteTemplate(id: string): void {
  library.value = { ...library.value, templates: library.value.templates.filter((t) => t.id !== id) };
  scheduleSave();
}

/** 型から、id を振り直した新しい白紙ボードを作って開く(ページ構成と箇所配置・ルールはそのまま複製)。 */
export function createFromTemplate(id: string): void {
  const template = library.value.templates.find((t) => t.id === id);
  if (!template) return;
  cloneAndOpenBoard(template);
}

/** サンプル/型のボードを、id を振り直した新しいボードとして複製して開く。 */
export function cloneAndOpenBoard(source: Board): void {
  const pageIdMap = new Map<string, string>(source.pages.map((p) => [p.id, crypto.randomUUID()]));
  const spotIdMap = new Map<string, string>(source.spots.map((s) => [s.id, crypto.randomUUID()]));
  const now = new Date().toISOString();
  const board: Board = {
    ...source,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    pages: source.pages.map((p) => ({ ...p, id: pageIdMap.get(p.id)! })),
    spots: source.spots.map((s) => ({ ...s, id: spotIdMap.get(s.id)!, pageId: pageIdMap.get(s.pageId)! })),
    order: source.order.map((id) => spotIdMap.get(id)).filter((id): id is string => !!id),
  };
  library.value = { ...library.value, boards: [...library.value.boards, board] };
  currentBoardId.value = board.id;
  void kvSet(LAST_BOARD_KEY, board.id);
  scheduleSave();
}

export function exportLibraryJson(): string {
  return JSON.stringify(library.value, null, 2);
}

/** 検証済みライブラリだけを現在データへ反映する。 */
export function replaceLibrary(next: Library): void {
  library.value = next;
  currentBoardId.value = null;
  selectedSpotId.value = null;
  resetUndoHistory();
  scheduleSave();
}

/** 書き出したJSONをruntime validationしてから置き換える。失敗時は現在データを変更しない。 */
export function importLibraryJson(text: string): void {
  const parsed = parseLibraryJson(text);
  replaceLibrary(parsed);
}
