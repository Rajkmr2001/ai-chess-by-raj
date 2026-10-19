import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  displayFen,
  freshGameState,
  gameReducer,
  liveFen,
  liveTurn,
} from '../../src/game/state';
import type { GameState, MoveRecord, TimeControlMinutes } from '../../src/types';
import { START_FEN } from '../../src/types';

function play(state: GameState, san: string, actor: 'me' | 'opponent', now: number): GameState {
  const game = new Chess(displayFen(state));
  const move = game.move(san);
  return gameReducer(state, { type: 'record', actor, move, now });
}

function started(playerColor: 'w' | 'b' = 'w', minutes: TimeControlMinutes = 5, now = 1_000_000): GameState {
  return gameReducer(freshGameState(), {
    type: 'start',
    config: { playerColor, minutes },
    now,
  });
}

describe('game start', () => {
  it('initialises clocks for all six time controls', () => {
    for (const minutes of [1, 3, 5, 10, 20, 30] as TimeControlMinutes[]) {
      const state = started('w', minutes);
      expect(state.phase).toBe('live');
      expect(state.clocks.w).toBe(minutes * 60_000);
      expect(state.clocks.b).toBe(minutes * 60_000);
      expect(state.history).toHaveLength(0);
    }
  });

  it('orients the player colour and keeps White to move first', () => {
    const white = started('w', 5);
    expect(liveTurn(white)).toBe('w');
    expect(white.config.playerColor).toBe('w');
    const black = started('b', 5);
    expect(liveTurn(black)).toBe('w');
    expect(black.config.playerColor).toBe('b');
  });
});

describe('recording moves and synchronisation', () => {
  it('records my move then the opponent move and alternates the clock', () => {
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_010_000 });
    expect(state.clocks.w).toBe(290_000);
    expect(state.clocks.b).toBe(300_000);
    state = play(state, 'e4', 'me', 1_010_000);
    expect(state.history).toHaveLength(1);
    expect(state.history[0].actor).toBe('me');
    expect(liveTurn(state)).toBe('b');
    state = gameReducer(state, { type: 'tick', now: 1_020_000 });
    expect(state.clocks.b).toBe(290_000);
    state = play(state, 'e5', 'opponent', 1_020_000);
    expect(state.history.map((h) => h.san)).toEqual(['e4', 'e5']);
    expect(liveTurn(state)).toBe('w');
  });

  it('works when the player is Black', () => {
    let state = started('b', 5, 1_000_000);
    // White (opponent) moves first
    state = play(state, 'd4', 'opponent', 1_000_000);
    expect(liveTurn(state)).toBe('b');
    state = play(state, 'd5', 'me', 1_000_000);
    expect(liveTurn(state)).toBe('w');
    state = play(state, 'c4', 'opponent', 1_000_000);
    expect(state.history.map((h) => h.san)).toEqual(['d4', 'd5', 'c4']);
  });

  it('rejects a move recorded for the wrong actor', () => {
    const state = started('w');
    const game = new Chess();
    const move = game.move('e4');
    const next = gameReducer(state, { type: 'record', actor: 'opponent', move, now: 2_000_000 });
    expect(next.history).toHaveLength(0);
    expect(next.notice?.kind).toBe('error');
    expect(next.notice?.text).toMatch(/your turn/i);
  });

  it('rejects duplicate submissions of the same move', () => {
    let state = started('w');
    state = play(state, 'e4', 'me', 1_000_000);
    const game = new Chess(displayFen(state));
    const move = game.move('e5');
    state = gameReducer(state, { type: 'record', actor: 'opponent', move, now: 1_000_000 });
    // Replay the same move object: the turn is now White, so the actor check trips first.
    const again = gameReducer(state, { type: 'record', actor: 'opponent', move, now: 1_000_000 });
    expect(again.history).toHaveLength(2);
  });

  it('detects checkmate and ends the game', () => {
    let state = started('w', 5, 1_000_000);
    const sequence: ['f3' | 'e5' | 'g4' | 'Qh4#', 'me' | 'opponent'][] = [
      ['f3', 'me'],
      ['e5', 'opponent'],
      ['g4', 'me'],
      ['Qh4#', 'opponent'],
    ];
    for (const [san, actor] of sequence) state = play(state, san, actor, 1_000_000);
    expect(state.phase).toBe('finished');
    expect(state.result?.reason).toBe('checkmate');
    expect(state.result?.winner).toBe('b');
    // No further moves are accepted.
    const game = new Chess(displayFen(state));
    expect(game.moves()).toHaveLength(0);
  });
});

describe('clocks', () => {
  it('pause freezes the clock and resume restarts it', () => {
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_005_000 });
    expect(state.clocks.w).toBe(295_000);
    state = gameReducer(state, { type: 'togglePause', now: 1_005_000 });
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'tick', now: 1_075_000 });
    expect(state.clocks.w).toBe(295_000);
    state = gameReducer(state, { type: 'togglePause', now: 1_075_000 });
    state = gameReducer(state, { type: 'tick', now: 1_080_000 });
    expect(state.clocks.w).toBe(290_000);
  });

  it('never runs both clocks at once', () => {
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_010_000 });
    expect(state.clocks.w).toBeLessThan(300_000);
    expect(state.clocks.b).toBe(300_000);
    state = play(state, 'e4', 'me', 1_010_000);
    state = gameReducer(state, { type: 'tick', now: 1_020_000 });
    expect(state.clocks.w).toBe(290_000);
    expect(state.clocks.b).toBe(290_000);
  });

  it('accounting is correct across browser throttling (single large delta)', () => {
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_000_000 + 47_500 });
    expect(state.clocks.w).toBe(300_000 - 47_500);
  });

  it('flags a timeout and records the result', () => {
    let state = started('w', 1, 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_000_000 + 60_500 });
    expect(state.clocks.w).toBe(0);
    expect(state.phase).toBe('finished');
    expect(state.result?.reason).toBe('timeout');
    expect(state.result?.winner).toBe('b');
    expect(state.flagged).toBe('w');
  });

  it('only the side to move can flag', () => {
    let state = started('w', 1, 1_000_000);
    state = play(state, 'e4', 'me', 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_000_000 + 65_000 });
    expect(state.result?.winner).toBe('w');
    expect(state.flagged).toBe('b');
  });

  it('reset restores the full time and pauses', () => {
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_006_000 });
    state = gameReducer(state, { type: 'resetClock', now: 1_006_000 });
    expect(state.clocks).toEqual({ w: 300_000, b: 300_000 });
    expect(state.paused).toBe(true);
  });

  it('optional hold pauses time while the engine thinks', () => {
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'setPauseWhileAnalyzing', value: true });
    state = gameReducer(state, { type: 'setAnalysisHold', hold: true, now: 1_000_000 });
    state = gameReducer(state, { type: 'tick', now: 1_010_000 });
    expect(state.clocks.w).toBe(300_000);
  });
});

describe('undo and redo', () => {
  it('undoes the last move, restores clocks and reopens the turn', () => {
    let state = started('w', 5, 1_000_000);
    state = play(state, 'e4', 'me', 1_000_000);
    state = play(state, 'e5', 'opponent', 1_010_000);
    // Black spent 10s on the move that is about to be undone.
    expect(state.clocks.b).toBe(290_000);
    state = gameReducer(state, { type: 'undo', now: 1_020_000 });
    expect(state.history).toHaveLength(1);
    expect(liveTurn(state)).toBe('b');
    expect(state.clocks.b).toBe(300_000);
    expect(state.clocks.w).toBe(300_000);
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'redo', now: 1_030_000 });
    expect(state.history).toHaveLength(2);
    expect(liveTurn(state)).toBe('w');
  });

  it('undo after a timeout clears the result', () => {
    let state = started('w', 1, 1_000_000);
    state = play(state, 'e4', 'me', 1_000_000);
    state = gameReducer(state, { type: 'tick', now: 1_065_000 });
    expect(state.result?.reason).toBe('timeout');
    state = gameReducer(state, { type: 'undo', now: 1_066_000 });
    expect(state.result).toBeNull();
    expect(state.phase).toBe('live');
    expect(state.flagged).toBeNull();
  });

  it('marks the analysis of a stale position as unreachable (view changes pause the clock)', () => {
    let state = started('w', 5, 1_000_000);
    state = play(state, 'e4', 'me', 1_000_000);
    state = play(state, 'e5', 'opponent', 1_000_000);
    state = gameReducer(state, { type: 'setViewPly', ply: 0, now: 1_005_000 });
    expect(state.viewPly).toBe(0);
    expect(displayFen(state)).toBe(START_FEN);
    expect(liveFen(state)).not.toBe(displayFen(state));
    expect(state.paused).toBe(true);
  });
});

describe('FEN and PGN loading', () => {
  it('loads a FEN, resets the history and pauses the clock', () => {
    let state = started('w', 5, 1_000_000);
    state = play(state, 'e4', 'me', 1_000_000);
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    state = gameReducer(state, { type: 'loadFen', fen, now: 1_010_000 });
    expect(state.history).toHaveLength(0);
    expect(state.baseFen).toBe(new Chess(fen).fen());
    expect(state.paused).toBe(true);
  });

  it('rejects an invalid FEN', () => {
    const state = started('w');
    const next = gameReducer(state, { type: 'loadFen', fen: 'garbage', now: 1_000_000 });
    expect(next.notice?.kind).toBe('error');
    expect(next.baseFen).toBe(START_FEN);
  });

  it('loads a PGN with the correct actor attribution', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5';
    let state = started('b', 3, 1_000_000);
    state = gameReducer(state, { type: 'loadPgn', pgn, now: 1_000_000 });
    expect(state.history).toHaveLength(5);
    expect(state.history[0].actor).toBe('opponent'); // White move, player is Black
    expect(state.history[1].actor).toBe('me');
    expect(liveTurn(state)).toBe('b');
    expect(state.paused).toBe(true);
  });

  it('preserves the result header when the position is not terminal', () => {
    const pgn = '[Result "1-0"]\n\n1. e4 e5 2. Nf3';
    let state = started('w', 5, 1_000_000);
    state = gameReducer(state, { type: 'loadPgn', pgn, now: 1_000_000 });
    expect(state.result?.winner).toBe('w');
    expect(state.result?.reason).toBe('imported');
  });
});

describe('rematch and new game', () => {
  it('keeps the configuration for a rematch', () => {
    let state = started('b', 10, 1_000_000);
    state = play(state, 'b3', 'opponent', 1_000_000);
    state = gameReducer(state, { type: 'rematch', now: 2_000_000 });
    expect(state.history).toHaveLength(0);
    expect(state.config).toEqual({ playerColor: 'b', minutes: 10 });
    expect(state.clocks.w).toBe(600_000);
    expect(state.paused).toBe(false);
  });

  it('returns to the setup screen on new game', () => {
    let state = started('w', 5, 1_000_000);
    state = play(state, 'e4', 'me', 1_000_000);
    state = gameReducer(state, { type: 'newGame' });
    expect(state.phase).toBe('setup');
    expect(state.history).toHaveLength(0);
  });
});

describe('repetition helpers', () => {
  it('exposes move records with stable identifiers', () => {
    let state = started('w');
    state = play(state, 'Nf3', 'me', 1_000_000);
    const record: MoveRecord = state.history[0];
    expect(record.ply).toBe(1);
    expect(record.uci).toBe('g1f3');
    expect(record.fenBefore).toBe(START_FEN);
    expect(record.fenAfter.split(' ')[1]).toBe('b');
  });
});
