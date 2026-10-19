import { describe, expect, it } from 'vitest';
import {
  classifyLoss,
  gradeMove,
  moveAccuracy,
  pairMoves,
  summariseReview,
  winPercent,
} from '../../src/lib/review';
import { evalLabel, formatClock, formatDuration, whiteBarFraction, whitePovCp } from '../../src/lib/format';
import type { MoveRecord } from '../../src/types';

function record(
  ply: number,
  color: 'w' | 'b',
  actor: 'me' | 'opponent',
  san: string,
  fenBefore: string,
  fenAfter: string,
): MoveRecord {
  return {
    ply,
    color,
    moveNumber: Math.ceil(ply / 2),
    actor,
    san,
    uci: '',
    from: '',
    to: '',
    piece: 'p',
    fenBefore,
    fenAfter,
    clockW: 0,
    clockB: 0,
    at: 0,
  };
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

describe('move classification', () => {
  it('classifies loss thresholds', () => {
    expect(classifyLoss(0).tag).toBe('good');
    expect(classifyLoss(60).tag).toBe('inaccuracy');
    expect(classifyLoss(200).tag).toBe('mistake');
    expect(classifyLoss(500).tag).toBe('blunder');
  });

  it('measures loss from the mover point of view', () => {
    // White drops from +1.00 to +0.30 => 70cp loss
    expect(gradeMove(100, 30, 'w').lossCp).toBe(70);
    // Black improves from White's point of view: no loss
    expect(gradeMove(100, 30, 'b').lossCp).toBe(0);
    // Black loses 200cp: White evals go from 0 to +200
    expect(gradeMove(0, 200, 'b').tag).toBe('mistake');
  });

  it('does not flag a move that keeps a winning position as a blunder', () => {
    expect(gradeMove(9_800, 9_700, 'w').tag).toBe('good');
  });

  it('produces accuracy percentages in a plausible range', () => {
    expect(moveAccuracy(0, 0)).toBeGreaterThan(95);
    expect(moveAccuracy(50, -500)).toBeLessThan(60);
    expect(winPercent(0)).toBeCloseTo(50, 5);
    expect(winPercent(400)).toBeGreaterThan(80);
  });

  it('summarises a whole game', () => {
    const records = [
      record(1, 'w', 'me', 'e4', START, AFTER_E4),
      record(2, 'b', 'opponent', 'e5', AFTER_E4, AFTER_E5),
    ];
    const summary = summariseReview({ records, evals: [20, 30, 25] });
    expect(summary.counts.good).toBe(2);
    expect(summary.accuracy.me).not.toBeNull();
    expect(summary.accuracy.opponent).not.toBeNull();
  });

  it('pairs moves correctly when White starts and when Black starts', () => {
    const records = [
      record(1, 'w', 'me', 'e4', START, AFTER_E4),
      record(2, 'b', 'opponent', 'e5', AFTER_E4, AFTER_E5),
    ];
    const pairs = pairMoves(records, START);
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0]?.san).toBe('e4');
    expect(pairs[0][1]?.san).toBe('e5');

    const blackStart = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const onlyBlack = [record(1, 'b', 'me', 'e5', blackStart, AFTER_E5)];
    const blackPairs = pairMoves(onlyBlack, blackStart);
    expect(blackPairs[0][0]).toBeNull();
    expect(blackPairs[0][1]?.san).toBe('e5');
  });
});

describe('formatting helpers', () => {
  it('formats clocks with tenths under 20 seconds', () => {
    expect(formatClock(300_000)).toBe('5:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(9_400)).toBe('9.4');
    expect(formatClock(0)).toBe('0.0');
    expect(formatClock(-500)).toBe('0.0');
  });

  it('formats durations', () => {
    expect(formatDuration(450)).toBe('450 ms');
    expect(formatDuration(1_500)).toBe('1.5 s');
    expect(formatDuration(12_000)).toBe('12 s');
    expect(formatDuration(95_000)).toBe('1m 35s');
  });

  it('renders evaluations from White perspective', () => {
    expect(evalLabel({ type: 'cp', value: 32 }, 'w')).toBe('+0.32');
    expect(evalLabel({ type: 'cp', value: 32 }, 'b')).toBe('−0.32');
    expect(evalLabel({ type: 'cp', value: -105 }, 'w')).toBe('−1.05');
    expect(evalLabel({ type: 'mate', value: 5 }, 'w')).toBe('+M5');
    expect(evalLabel({ type: 'mate', value: 2 }, 'b')).toBe('−M2');
    expect(evalLabel(undefined, 'w')).toBe('—');
  });

  it('maps scores to the evaluation bar', () => {
    expect(whiteBarFraction(0)).toBeCloseTo(0.5, 5);
    expect(whiteBarFraction(400)).toBeGreaterThan(0.7);
    expect(whiteBarFraction(-400)).toBeLessThan(0.3);
    expect(whiteBarFraction(null)).toBe(0.5);
  });

  it('converts mate scores to centipawns consistently', () => {
    expect(whitePovCp({ type: 'cp', value: 100 }, 'w')).toBe(100);
    expect(whitePovCp({ type: 'cp', value: 100 }, 'b')).toBe(-100);
    expect(whitePovCp({ type: 'mate', value: 1 }, 'w')).toBe(9990);
  });
});
