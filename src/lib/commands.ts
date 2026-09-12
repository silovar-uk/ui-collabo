import {
  FONT_MOODS,
  LADDER_ATTRS,
  LADDER_TABLE,
  MOTIONS,
  RELATIVE_CHIPS,
  relativeWordKana,
  relativeWordLabel,
  TONE_CHIPS,
  TONE_CHIP_KANA,
} from '../vocab';
import * as notes from './notes';
import { clampRect } from './geometry';
import type { Board, LadderAttr, Note, Spot } from '../schema';

export type CommandPreview =
  | { kind: 'ladder'; attr: LadderAttr; step: number }
  | { kind: 'font'; moodId: string }
  | { kind: 'motion'; motionId: string };

export interface Command {
  id: string;
  label: string;
  kana: string;
  category: string;
  preview?: CommandPreview;
  apply: (board: Board, spot: Spot) => Board;
}

const NUDGE = 0.02;

function ladderCommands(): Command[] {
  const commands: Command[] = [];
  for (const attr of LADDER_ATTRS) {
    const def = LADDER_TABLE[attr];
    for (const chip of RELATIVE_CHIPS) {
      // 段が2つしかない属性ではdelta±2は範囲外に丸まって±1と同じになるため重複を出さない
      if (Math.abs(chip.delta) >= 2 && def.steps.length <= 3) continue;
      const previewStep = Math.min(def.steps.length - 1, Math.max(0, Math.round(def.steps.length / 2) + chip.delta));
      commands.push({
        id: `ladder:${attr}:${chip.delta}`,
        label: `${def.label}: ${relativeWordLabel(attr, chip.delta)}`,
        kana: relativeWordKana(attr, chip.delta),
        category: '大きさ・余白・形',
        preview: { kind: 'ladder', attr, step: previewStep },
        apply: (board, spot) => {
          const existing = spot.notes.find((n): n is Extract<Note, { kind: 'ladder' }> => n.kind === 'ladder' && n.attr === attr);
          return notes.setLadder(spot.id, attr, { current: existing?.current, target: { delta: chip.delta } })(board);
        },
      });
    }
  }
  return commands;
}

function fontCommands(): Command[] {
  return FONT_MOODS.map((mood) => ({
    id: `font:${mood.id}`,
    label: `文字の雰囲気: ${mood.label}`,
    kana: mood.kana,
    category: '文字の雰囲気',
    preview: { kind: 'font', moodId: mood.id },
    apply: (board, spot) => notes.setFontMood(spot.id, mood.id)(board),
  }));
}

function motionCommands(): Command[] {
  return MOTIONS.map((m) => ({
    id: `motion:${m.id}`,
    label: `動き: ${m.label}`,
    kana: m.kana,
    category: '動き',
    preview: { kind: 'motion', motionId: m.id },
    apply: (board, spot) => {
      const existing = spot.notes.find((n): n is Extract<Note, { kind: 'motion' }> => n.kind === 'motion');
      return notes.setMotion(spot.id, { motion: m.id, trigger: existing?.trigger ?? 'enter', speed: existing?.speed, intensity: existing?.intensity })(board);
    },
  }));
}

function toneCommands(): Command[] {
  return TONE_CHIPS.map((chip) => ({
    id: `tone:${chip}`,
    label: `ひとこと: ${chip}`,
    kana: TONE_CHIP_KANA[chip],
    category: 'ひとこと',
    apply: (board, spot) =>
      notes.updateTextNote(spot.id, (n) => (n.chips.includes(chip) ? n : { ...n, chips: [...n.chips, chip] }))(board),
  }));
}

const POSITIONS: { id: string; label: string; kana: string; dx: number; dy: number; center?: 'x' | 'y' }[] = [
  { id: 'up', label: '位置: 上へ', kana: 'うえへ', dx: 0, dy: -NUDGE },
  { id: 'down', label: '位置: 下へ', kana: 'したへ', dx: 0, dy: NUDGE },
  { id: 'left', label: '位置: 左へ', kana: 'ひだりへ', dx: -NUDGE, dy: 0 },
  { id: 'right', label: '位置: 右へ', kana: 'みぎへ', dx: NUDGE, dy: 0 },
  { id: 'center-x', label: '位置: 左右中央', kana: 'さゆうちゅうおう', dx: 0, dy: 0, center: 'x' },
  { id: 'center-y', label: '位置: 上下中央', kana: 'じょうげちゅうおう', dx: 0, dy: 0, center: 'y' },
];

function positionCommands(): Command[] {
  return POSITIONS.map((p) => ({
    id: `position:${p.id}`,
    label: p.label,
    kana: p.kana,
    category: '位置',
    apply: (board, spot) => {
      // 純関数として振る舞うため、getSpotEditTargetのapply(updateBoardを直接呼ぶ)は使わず、
      // 同じ計算をここで行ってboardを返す
      if (spot.element) return board;
      const dashed = board.imageRole === 'draft' && !!board.pages.find((pg) => pg.id === spot.pageId)?.image;
      const rect = dashed ? spot.targetRect ?? spot.rect : spot.rect;
      const next = p.center === 'x' ? { ...rect, x: 0.5 - rect.w / 2 } : p.center === 'y' ? { ...rect, y: 0.5 - rect.h / 2 } : { ...rect, x: rect.x + p.dx, y: rect.y + p.dy };
      const clamped = clampRect(next);
      return {
        ...board,
        spots: board.spots.map((s) => (s.id === spot.id ? (dashed ? { ...s, targetRect: clamped } : { ...s, rect: clamped }) : s)),
      };
    },
  }));
}

function keepCommand(): Command {
  return {
    id: 'keep',
    label: '残す(変えない)',
    kana: 'のこす',
    category: '残す',
    apply: (board, spot) => notes.setKeep(spot.id, !spot.keep)(board),
  };
}

/** R4: 言葉で探すための全候補。ラダー×相対語、雰囲気、動き、ひとこと、位置、残す。 */
export function buildCommands(): Command[] {
  return [...ladderCommands(), ...fontCommands(), ...motionCommands(), ...toneCommands(), ...positionCommands(), keepCommand()];
}

/** 全候補は毎回同じなので、モジュール読み込み時に1回だけ組み立てる。 */
export const ALL_COMMANDS = buildCommands();

/** 表記・kana両方で部分一致させる(IME変換前のひらがなでも当たるように)。 */
export function searchCommands(commands: Command[], query: string): Command[] {
  const q = query.trim();
  if (!q) return [];
  return commands.filter((c) => c.label.includes(q) || c.kana.includes(q));
}
