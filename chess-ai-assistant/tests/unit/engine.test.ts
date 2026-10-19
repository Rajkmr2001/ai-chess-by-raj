import { describe, expect, it } from 'vitest';
import {
  parseBestMove,
  parseIdName,
  parseInfo,
  parseOption,
} from '../../src/engine/protocol';
import { scoreFromWhite } from '../../src/engine/client';

describe('UCI info parsing', () => {
  it('extracts depth, score, time and the principal variation', () => {
    const line =
      'info depth 18 seldepth 24 multipv 1 score cp 33 nodes 1200000 nps 800000 hashfull 12 time 1500 pv e2e4 e7e5 g1f3 b8c6';
    const info = parseInfo(line);
    expect(info).not.toBeNull();
    expect(info?.depth).toBe(18);
    expect(info?.seldepth).toBe(24);
    expect(info?.multipv).toBe(1);
    expect(info?.score).toEqual({ type: 'cp', value: 33 });
    expect(info?.timeMs).toBe(1500);
    expect(info?.pv).toEqual(['e2e4', 'e7e5', 'g1f3', 'b8c6']);
  });

  it('handles mate scores and multipv indexes', () => {
    const info = parseInfo('info depth 12 multipv 2 score mate -3 time 200 pv h7h8q');
    expect(info?.multipv).toBe(2);
    expect(info?.score).toEqual({ type: 'mate', value: -3 });
  });

  it('ignores lines without a score or PV', () => {
    expect(parseInfo('info depth 1 currmove e2e4')).toBeNull();
    expect(parseInfo('info string NNUE evaluation using nn-abc.nnue')).toBeNull();
  });

  it('parses bestmove, including ponder and (none)', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({
      bestMove: 'e2e4',
      ponder: 'e7e5',
    });
    expect(parseBestMove('bestmove (none)')).toEqual({ bestMove: null, ponder: undefined });
    expect(parseBestMove('info depth 3')).toBeNull();
  });

  it('parses engine identification and options', () => {
    expect(parseIdName('id name Stockfish 19')).toBe('Stockfish 19');
    const option = parseOption('option name Hash type spin default 16 min 1 max 33554432');
    expect(option).toEqual({ name: 'Hash', type: 'spin', default: '16', min: 1, max: 33554432 });
  });
});

describe('score conversion', () => {
  it('keeps centipawn scores relative to White', () => {
    expect(scoreFromWhite({ type: 'cp', value: 40 }, 'w')).toBe(40);
    expect(scoreFromWhite({ type: 'cp', value: 40 }, 'b')).toBe(-40);
  });

  it('maps mate scores to large magnitudes on the right side', () => {
    const mateForWhite = scoreFromWhite({ type: 'mate', value: 3 }, 'w');
    // "mate -2" for the side to move (Black) means Black gets mated: good for White.
    const blackGetsMated = scoreFromWhite({ type: 'mate', value: -2 }, 'b');
    // "mate -2" for White means White gets mated: good for Black.
    const whiteGetsMated = scoreFromWhite({ type: 'mate', value: -2 }, 'w');
    expect(mateForWhite).toBeGreaterThan(9000);
    expect(blackGetsMated).toBe(9980);
    expect(whiteGetsMated).toBe(-9980);
  });
});
