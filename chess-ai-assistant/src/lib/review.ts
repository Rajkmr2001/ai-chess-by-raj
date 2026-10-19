import { Chess } from 'chess.js';
import type { Color, MoveRecord } from '../types';
import { opposite } from './chess';

export type MoveTag = 'brilliant' | 'good' | 'inaccuracy' | 'mistake' | 'blunder' | 'neutral';

export interface MoveGrade {
  tag: MoveTag;
  label: string;
  lossCp: number;
}

/** Loss (in centipawns, mover's point of view) thresholds. */
export const THRESHOLDS = { inaccuracy: 50, mistake: 150, blunder: 300 } as const;

export function classifyLoss(lossCp: number): MoveGrade {
  if (lossCp >= THRESHOLDS.blunder) return { tag: 'blunder', label: 'Blunder', lossCp };
  if (lossCp >= THRESHOLDS.mistake) return { tag: 'mistake', label: 'Mistake', lossCp };
  if (lossCp >= THRESHOLDS.inaccuracy)
    return { tag: 'inaccuracy', label: 'Inaccuracy', lossCp };
  return { tag: 'good', label: lossCp <= 10 ? 'Best' : 'Good', lossCp };
}

/**
 * Evaluate one played move given White-POV evaluations before and after it.
 * `before` is the evaluation of the position the mover was facing.
 */
export function gradeMove(
  beforeWhiteCp: number,
  afterWhiteCp: number,
  mover: Color,
  bestMove?: string,
  playedSan?: string,
): MoveGrade {
  const sign = mover === 'w' ? 1 : -1;
  const beforeForMover = beforeWhiteCp * sign;
  const afterForMover = afterWhiteCp * sign;
  if (beforeForMover >= 9_500 && afterForMover >= 9_500) {
    return { tag: 'good', label: 'Best', lossCp: 0 };
  }
  if (afterForMover <= -9_500) {
    // Mover went from not-losing to losing: a blunder unless already lost.
    const loss = beforeForMover <= -9_500 ? 0 : 1_000;
    return classifyLoss(loss);
  }
  const loss = Math.max(0, beforeForMover - afterForMover);
  const grade = classifyLoss(loss);
  if (bestMove && playedSan && bestMove === playedSan && grade.tag === 'good') {
    return { tag: 'good', label: 'Best', lossCp: loss };
  }
  return grade;
}

export const TAG_STYLES: Record<MoveTag, { symbol: string; className: string; title: string }> = {
  brilliant: { symbol: '!!', className: 'text-cyan-400', title: 'Brilliant' },
  good: { symbol: '✓', className: 'text-emerald-500', title: 'Good move' },
  neutral: { symbol: '·', className: 'text-slate-400', title: 'Neutral' },
  inaccuracy: { symbol: '?!', className: 'text-amber-500', title: 'Inaccuracy' },
  mistake: { symbol: '?', className: 'text-orange-500', title: 'Mistake' },
  blunder: { symbol: '??', className: 'text-rose-500', title: 'Blunder' },
};

export interface ReviewSummary {
  counts: Record<MoveTag, number>;
  accuracy: { me: number | null; opponent: number | null };
}

/** Win probability (0..100) for the mover given their centipawn evaluation. */
export function winPercent(cpForMover: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cpForMover));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/**
 * Accuracy estimate for a single move, using the Lichess-style exponential
 * curve over the drop in expected score. Heuristic, not an absolute judgement.
 */
export function moveAccuracy(beforeForMover: number, afterForMover: number): number {
  const drop = Math.max(0, winPercent(beforeForMover) - winPercent(afterForMover));
  const accuracy = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, accuracy));
}

export interface ReviewInput {
  records: MoveRecord[];
  /** White-POV centipawn evaluation for every position index (0 = start). */
  evals: (number | null)[];
}

export function summariseReview(input: ReviewInput): ReviewSummary {
  const counts: Record<MoveTag, number> = {
    brilliant: 0,
    good: 0,
    neutral: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
  };
  const mine: number[] = [];
  const theirs: number[] = [];
  input.records.forEach((record, index) => {
    const before = input.evals[index];
    const after = input.evals[index + 1];
    if (before === null || before === undefined || after === null || after === undefined) return;
    const sign = record.color === 'w' ? 1 : -1;
    const grade = gradeMove(before, after, record.color);
    counts[grade.tag] += 1;
    const accuracy = moveAccuracy(before * sign, after * sign);
    (record.actor === 'me' ? mine : theirs).push(accuracy);
  });
  const average = (values: number[]) =>
    values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return { counts, accuracy: { me: average(mine), opponent: average(theirs) } };
}

/** Full-move list as [white?, black?] pairs, for previews and summaries. */
export function pairMoves(records: MoveRecord[], baseFen: string): [MoveRecord | null, MoveRecord | null][] {
  const startTurn = new Chess(baseFen).turn();
  const pairs: [MoveRecord | null, MoveRecord | null][] = [];
  let index = 0;
  if (startTurn === 'b') {
    pairs.push([null, records[0] ?? null]);
    index = 1;
  }
  for (; index < records.length; index += 2) {
    pairs.push([records[index] ?? null, records[index + 1] ?? null]);
  }
  return pairs;
}

export { opposite };
