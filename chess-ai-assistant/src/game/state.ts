import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type {
  Actor,
  Color,
  GameConfig,
  GameResult,
  GameState,
  MoveRecord,
  Settings,
} from '../types';
import { START_FEN } from '../types';
import {
  chessAt,
  makeRecord,
  moveNumberAt,
  opposite,
  parsePgn,
  tryMove,
  turnAt,
} from '../lib/chess';

let noticeSeq = 0;
export function notice(kind: 'info' | 'error' | 'success', text: string): GameState['notice'] {
  return { kind, text, id: ++noticeSeq };
}

export function freshGameState(settings?: Pick<Settings, 'pauseWhileAnalyzing'>): GameState {
  return {
    phase: 'setup',
    config: { playerColor: 'w', minutes: 5 },
    baseFen: START_FEN,
    history: [],
    redoStack: [],
    viewPly: 0,
    clocks: { w: 5 * 60_000, b: 5 * 60_000 },
    clockEnabled: true,
    paused: false,
    lastTickAt: null,
    startedAt: null,
    endedAt: null,
    result: null,
    flagged: null,
    flipped: false,
    analysisHold: false,
    pauseWhileAnalyzing: settings?.pauseWhileAnalyzing ?? false,
    endSummary: false,
    notice: null,
  };
}

export function liveFen(state: GameState): string {
  return state.history.length ? state.history[state.history.length - 1].fenAfter : state.baseFen;
}

export function displayFen(state: GameState): string {
  return state.viewPly <= 0 ? state.baseFen : state.history[state.viewPly - 1].fenAfter;
}

export function liveTurn(state: GameState): Color {
  return turnAt(liveFen(state));
}

export function isReviewing(state: GameState): boolean {
  return state.viewPly !== state.history.length;
}

export function clockIsRunning(state: GameState): boolean {
  return (
    state.phase === 'live' &&
    state.clockEnabled &&
    !state.paused &&
    !state.result &&
    state.lastTickAt !== null
  );
}

export function gameOverFromPosition(fen: string): GameResult | null {
  const game = new Chess(fen);
  const mover = game.turn();
  const other = opposite(mover);
  if (game.isCheckmate()) {
    return {
      winner: other,
      reason: 'checkmate',
      detail: `${other === 'w' ? 'White' : 'Black'} wins by checkmate.`,
    };
  }
  if (game.isStalemate()) {
    return { winner: 'draw', reason: 'stalemate', detail: 'Draw by stalemate.' };
  }
  if (game.isInsufficientMaterial()) {
    return {
      winner: 'draw',
      reason: 'insufficient-material',
      detail: 'Draw — neither side has enough material to mate.',
    };
  }
  if (game.isThreefoldRepetition()) {
    return {
      winner: 'draw',
      reason: 'threefold-repetition',
      detail: 'Draw by threefold repetition.',
    };
  }
  if (game.isDrawByFiftyMoves()) {
    return { winner: 'draw', reason: 'fifty-move', detail: 'Draw by the fifty-move rule.' };
  }
  if (game.isDraw()) {
    return { winner: 'draw', reason: 'draw', detail: 'Draw.' };
  }
  return null;
}

function timeoutResult(fen: string, flagged: Color): GameResult {
  const game = new Chess(fen);
  const winner = opposite(flagged);
  if (game.isInsufficientMaterial()) {
    return {
      winner: 'draw',
      reason: 'timeout',
      detail: `${flagged === 'w' ? 'White' : 'Black'} ran out of time, but ${winner === 'w' ? 'White' : 'Black'} cannot mate — draw.`,
    };
  }
  return {
    winner,
    reason: 'timeout',
    detail: `${flagged === 'w' ? 'White' : 'Black'} ran out of time. ${winner === 'w' ? 'White' : 'Black'} wins on time.`,
  };
}

function fullClocks(state: GameState) {
  const ms = state.config.minutes * 60_000;
  return { w: ms, b: ms };
}

/**
 * Charge elapsed wall-clock time to the side to move. Wall-clock deltas (rather
 * than interval counts) keep the clock correct when the tab is throttled.
 */
function settle(state: GameState, now: number): GameState {
  if (!clockIsRunning(state)) return state;
  const elapsed = now - (state.lastTickAt ?? now);
  if (elapsed <= 0) return state;
  if (state.pauseWhileAnalyzing && state.analysisHold) {
    return { ...state, lastTickAt: now };
  }
  const active = liveTurn(state);
  const remaining = Math.max(0, state.clocks[active] - elapsed);
  const clocks = { ...state.clocks, [active]: remaining } as GameState['clocks'];
  if (remaining === 0) {
    return {
      ...state,
      clocks,
      lastTickAt: now,
      flagged: active,
      paused: true,
      phase: 'finished',
      endedAt: now,
      result: timeoutResult(liveFen(state), active),
      notice: notice('error', 'Time is up.'),
    };
  }
  return { ...state, clocks, lastTickAt: now };
}

function previousClockSnapshot(state: GameState, keep: number): { w: number; b: number } {
  if (keep <= 0) return fullClocks(state);
  const record = state.history[keep - 1];
  return { w: record.clockW, b: record.clockB };
}

export type GameAction =
  | { type: 'start'; config: GameConfig; now: number; pauseWhileAnalyzing?: boolean }
  | { type: 'record'; actor: Actor; move: Move; now: number }
  | { type: 'undo'; now: number }
  | { type: 'redo'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'togglePause'; now: number }
  | { type: 'setViewPly'; ply: number; now: number }
  | { type: 'resetClock'; now: number }
  | { type: 'resign'; now: number }
  | { type: 'loadFen'; fen: string; now: number }
  | { type: 'loadPgn'; pgn: string; now: number }
  | { type: 'newGame' }
  | { type: 'rematch'; now: number }
  | { type: 'setFlipped'; flipped: boolean }
  | { type: 'setAnalysisHold'; hold: boolean; now: number }
  | { type: 'setPauseWhileAnalyzing'; value: boolean }
  | { type: 'restore'; state: GameState }
  | { type: 'clearNotice' }
  | { type: 'notify'; kind: 'info' | 'error' | 'success'; text: string };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start': {
      const ms = action.config.minutes * 60_000;
      const fresh = freshGameState();
      return {
        ...fresh,
        phase: 'live',
        config: action.config,
        clocks: { w: ms, b: ms },
        startedAt: action.now,
        lastTickAt: action.now,
        paused: false,
        pauseWhileAnalyzing: action.pauseWhileAnalyzing ?? false,
        notice: notice(
          'info',
          `New game — you play ${action.config.playerColor === 'w' ? 'White' : 'Black'}. The website clock is a training clock, not the official one.`,
        ),
      };
    }

    case 'record': {
      if (state.phase !== 'live' || state.result) {
        return { ...state, notice: notice('error', 'The game is over. Start a rematch or a new game.') };
      }
      if (isReviewing(state)) {
        return {
          ...state,
          notice: notice('error', 'You are viewing an earlier position. Return to the live position first.'),
        };
      }
      const expected: Actor = liveTurn(state) === state.config.playerColor ? 'me' : 'opponent';
      if (action.actor !== expected) {
        return {
          ...state,
          notice: notice(
            'error',
            expected === 'me'
              ? 'It is your turn — record your own move (or confirm the engine suggestion).'
              : "It is your opponent's turn — enter their move first.",
          ),
        };
      }
      const settled = settle(state, action.now);
      if (settled.result) return settled;

      const last = settled.history[settled.history.length - 1];
      const move = action.move;
      if (last && last.san === move.san && last.fenBefore === move.before) {
        return { ...settled, notice: notice('info', `“${move.san}” is already recorded.`) };
      }

      const record = makeRecord(
        move,
        action.actor,
        settled.history.length + 1,
        settled.clocks,
        action.now,
      );
      const history = [...settled.history, record];
      const result = gameOverFromPosition(record.fenAfter);
      return {
        ...settled,
        history,
        redoStack: [],
        viewPly: history.length,
        result,
        phase: result ? 'finished' : 'live',
        endedAt: result ? action.now : null,
        paused: result ? true : settled.paused,
        lastTickAt: action.now,
        endSummary: Boolean(result),
        notice: null,
      };
    }

    case 'undo': {
      if (!state.history.length) {
        return { ...state, notice: notice('info', 'There are no moves to undo.') };
      }
      const settled = settle(state, action.now);
      const history = settled.history.slice(0, -1);
      const removed = settled.history[settled.history.length - 1];
      const clocks = previousClockSnapshot(settled, history.length);
      return {
        ...settled,
        history,
        redoStack: [...settled.redoStack, removed],
        viewPly: history.length,
        clocks,
        paused: true,
        lastTickAt: null,
        result: null,
        phase: 'live',
        endedAt: null,
        flagged: null,
        endSummary: false,
        notice: notice('info', `Undid ${removed.san}. Clock paused — press Resume when ready.`),
      };
    }

    case 'redo': {
      if (!state.redoStack.length) {
        return { ...state, notice: notice('info', 'Nothing to redo.') };
      }
      const stack = [...state.redoStack];
      const record = stack.pop() as MoveRecord;
      const history = [...state.history, record];
      const result = gameOverFromPosition(record.fenAfter);
      return {
        ...state,
        history,
        redoStack: stack,
        viewPly: history.length,
        clocks: { w: record.clockW, b: record.clockB },
        paused: true,
        lastTickAt: null,
        result,
        phase: result ? 'finished' : 'live',
        endedAt: result ? action.now : null,
        notice: notice('info', `Redid ${record.san}. Clock paused — press Resume when ready.`),
      };
    }

    case 'tick':
      return settle(state, action.now);

    case 'togglePause': {
      if (state.phase !== 'live' || state.result) return state;
      if (state.paused) {
        return {
          ...state,
          paused: false,
          lastTickAt: action.now,
          notice: notice('info', 'Clock resumed.'),
        };
      }
      const settled = settle(state, action.now);
      return { ...settled, paused: true, lastTickAt: null, notice: notice('info', 'Clock paused.') };
    }

    case 'setViewPly': {
      if (action.ply === state.viewPly) return state;
      const ply = Math.max(0, Math.min(state.history.length, action.ply));
      let next = settle(state, action.now);
      if (ply !== next.history.length) {
        next = { ...next, paused: true, lastTickAt: null };
        return {
          ...next,
          viewPly: ply,
          notice: notice('info', 'Reviewing an earlier position — the clock is paused.'),
        };
      }
      return {
        ...next,
        viewPly: ply,
        paused: true,
        lastTickAt: null,
        notice: notice('info', 'Back at the live position. Clock paused — press Resume.'),
      };
    }

    case 'resetClock': {
      const clocks = fullClocks(state);
      const wasTimeout = state.result?.reason === 'timeout';
      return {
        ...state,
        clocks,
        flagged: null,
        result: wasTimeout ? null : state.result,
        phase: wasTimeout ? 'live' : state.phase,
        endedAt: wasTimeout ? null : state.endedAt,
        paused: true,
        lastTickAt: null,
        notice: notice('info', 'Clock reset and paused. Press Resume to start it.'),
      };
    }

    case 'resign': {
      if (state.phase !== 'live') return state;
      const winner = opposite(state.config.playerColor);
      return {
        ...state,
        paused: true,
        lastTickAt: null,
        phase: 'finished',
        endedAt: action.now,
        endSummary: false,
        result: {
          winner,
          reason: 'resignation',
          detail: `You resigned. ${winner === 'w' ? 'White' : 'Black'} wins.`,
        },
      };
    }

    case 'loadFen': {
      let fen: string;
      try {
        const game = new Chess(action.fen.trim());
        fen = game.fen();
        const result = gameOverFromPosition(fen);
        return {
          ...state,
          phase: result ? 'finished' : 'live',
          baseFen: fen,
          history: [],
          redoStack: [],
          viewPly: 0,
          clocks: fullClocks(state),
          paused: true,
          lastTickAt: null,
          startedAt: action.now,
          endedAt: result ? action.now : null,
          result,
          flagged: null,
          notice: notice('success', 'Position loaded from FEN. Clocks reset and paused.'),
        };
      } catch {
        return { ...state, notice: notice('error', 'That FEN is not a valid chess position.') };
      }
    }

    case 'loadPgn': {
      try {
        const imported = parsePgn(action.pgn, state.config.playerColor);
        const ms = state.config.minutes * 60_000;
        const clocks = { w: ms, b: ms };
        const history = imported.history.map((record) => ({
          ...record,
          clockW: ms,
          clockB: ms,
        }));
        const finalFen = history.length ? history[history.length - 1].fenAfter : imported.baseFen;
        let result = gameOverFromPosition(finalFen);
        if (!result) {
          if (imported.resultHeader === '1-0') {
            result = { winner: 'w', reason: 'imported', detail: 'Result from the imported PGN: 1-0.' };
          } else if (imported.resultHeader === '0-1') {
            result = { winner: 'b', reason: 'imported', detail: 'Result from the imported PGN: 0-1.' };
          } else if (imported.resultHeader === '1/2-1/2') {
            result = {
              winner: 'draw',
              reason: 'imported',
              detail: 'Result from the imported PGN: draw.',
            };
          }
        }
        const meta = new Chess(imported.baseFen);
        return {
          ...state,
          phase: result ? 'finished' : 'live',
          baseFen: meta.fen(),
          history,
          redoStack: [],
          viewPly: history.length,
          clocks,
          paused: true,
          lastTickAt: null,
          startedAt: action.now,
          endedAt: result ? action.now : null,
          result,
          flagged: null,
          notice: notice('success', `Loaded ${history.length} moves from PGN. Clocks paused.`),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          ...state,
          notice: notice('error', `Could not read that PGN — ${message.slice(0, 120)}`),
        };
      }
    }

    case 'newGame':
      return {
        ...freshGameState({ pauseWhileAnalyzing: state.pauseWhileAnalyzing }),
        config: state.config,
        clocks: fullClocks(state),
      };

    case 'rematch': {
      const ms = state.config.minutes * 60_000;
      return {
        ...freshGameState({ pauseWhileAnalyzing: state.pauseWhileAnalyzing }),
        phase: 'live',
        config: state.config,
        clocks: { w: ms, b: ms },
        startedAt: action.now,
        lastTickAt: action.now,
        paused: false,
        notice: notice('info', 'Rematch started. Good luck!'),
      };
    }

    case 'setFlipped':
      return { ...state, flipped: action.flipped };

    case 'setPauseWhileAnalyzing':
      return state.pauseWhileAnalyzing === action.value
        ? state
        : { ...state, pauseWhileAnalyzing: action.value };

    case 'setAnalysisHold': {
      if (state.analysisHold === action.hold) return state;
      const settled = settle(state, action.now);
      return {
        ...settled,
        analysisHold: action.hold,
        lastTickAt: action.hold ? settled.lastTickAt : action.now,
      };
    }

    case 'restore': {
      const restored = action.state;
      return {
        ...restored,
        paused: true,
        lastTickAt: null,
        analysisHold: false,
        notice: notice(
          'info',
          'Session restored from this browser. The clock is paused — press Resume.',
        ),
      };
    }

    case 'clearNotice':
      return state.notice ? { ...state, notice: null } : state;

    case 'notify':
      return { ...state, notice: notice(action.kind, action.text) };

    default:
      return state;
  }
}

/** Search for a legal move on a fresh board; used by UI handlers before dispatching. */
export function findMove(
  state: GameState,
  from: string,
  to: string,
  promotion?: string,
): { game: Chess; move: Move | null } {
  const fen = displayFen(state);
  const game = new Chess(fen);
  const move = tryMove(game, { from, to, promotion });
  return { game, move };
}

export function moveNumberForFen(fen: string): number {
  return moveNumberAt(fen);
}

export function resultLabel(result: GameResult | null): string {
  if (!result) return 'In progress';
  if (result.winner === 'draw') return 'Draw';
  return result.winner === 'w' ? 'White wins' : 'Black wins';
}

export function clockMsFor(state: GameState, color: Color): number {
  return state.clocks[color];
}

/** Positions repeated in the game (for threefold awareness in the UI). */
export function repetitionCount(state: GameState): number {
  const fen = liveFen(state).split(' ').slice(0, 4).join(' ');
  let count = 0;
  const seen = (candidate: string) => candidate.split(' ').slice(0, 4).join(' ') === fen;
  if (seen(state.baseFen)) count++;
  for (const record of state.history) if (seen(record.fenAfter)) count++;
  return count;
}

export { chessAt };
