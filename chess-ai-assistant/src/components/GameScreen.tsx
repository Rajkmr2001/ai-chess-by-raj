import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Database,
  Flag,
  FlipVertical2,
  Gamepad2,
  Info,
  ListChecks,
  Plus,
  RefreshCw,
  Redo2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { Chess } from 'chess.js';
import { Board } from './Board';
import { ClocksCard } from './Clocks';
import { EnginePanel } from './EnginePanel';
import { MoveInput, type NotationMode, type SubmitResult } from './MoveInput';
import { MoveList } from './MoveList';
import { Badge, Button, cx } from './ui';
import { Piece } from '../pieces/Piece';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import { PromotionDialog } from './dialogs/PromotionDialog';
import { SummaryDialog } from './dialogs/SummaryDialog';
import { FenPgnDialog, type DataTab } from './dialogs/FenPgnDialog';
import {
  buildPgn,
  materialSummary,
  opposite,
  parseMoveWithMode,
  safeChess,
  tryMove,
  turnAt,
} from '../lib/chess';
import { displayFen, isReviewing, liveFen, type GameAction } from '../game/state';
import { formatClock, whitePovCp } from '../lib/format';
import { copyText, downloadText, timestampSlug } from '../lib/download';
import { gradeMove, summariseReview, type MoveGrade, type ReviewSummary } from '../lib/review';
import { useAnalysis } from '../engine/useAnalysis';
import type { StockfishHandle } from '../hooks/useStockfish';
import {
  PIECE_NAME,
  type Actor,
  type Color,
  type GameState,
  type Settings,
} from '../types';

const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'] as const;

function CapturedRow({ pieces, color }: { pieces: string[]; color: Color }) {
  if (!pieces.length) return <span className="text-[10px] muted">no captures yet</span>;
  const sorted = [...pieces].sort(
    (a, b) =>
      PIECE_ORDER.indexOf(a as (typeof PIECE_ORDER)[number]) -
      PIECE_ORDER.indexOf(b as (typeof PIECE_ORDER)[number]),
  );
  return (
    <span
      className="flex items-center gap-0.5"
      aria-label={`Captured: ${sorted.map((piece) => PIECE_NAME[piece]).join(', ')}`}
    >
      {sorted.map((type, index) => (
        <span key={`${type}-${index}`} className="h-3.5 w-3.5 opacity-80" aria-hidden="true">
          <Piece piece={`${color}${type.toUpperCase()}`} />
        </span>
      ))}
    </span>
  );
}

function PlayerBar({
  color,
  isYou,
  clock,
  active,
  captured,
  advantage,
  running,
  low,
}: {
  color: Color;
  isYou: boolean;
  clock: number;
  active: boolean;
  captured: string[];
  advantage: number;
  running: boolean;
  low: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cx(
            'h-3 w-3 shrink-0 rounded-full border',
            color === 'w'
              ? 'border-slate-400 bg-white'
              : 'border-slate-900 bg-slate-900 dark:border-slate-500',
          )}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
              {isYou ? 'You' : 'Opponent'} ({color === 'w' ? 'White' : 'Black'})
            </span>
            {isYou && (
              <Badge tone="emerald" className="px-1 py-0 text-[9px]">
                you
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <CapturedRow pieces={captured} color={color === 'w' ? 'b' : 'w'} />
            {advantage > 0 && (
              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                +{advantage}
              </span>
            )}
          </div>
        </div>
      </div>
      <div
        className={cx(
          'shrink-0 rounded-lg px-2 py-1 font-mono text-lg font-semibold tabular transition-colors sm:text-xl',
          active && running
            ? 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-400/40 dark:text-emerald-300'
            : 'text-slate-700 dark:text-slate-200',
          low && 'text-rose-600 dark:text-rose-400',
        )}
        aria-label={`${isYou ? 'Your' : 'Opponent'} clock: ${Math.ceil(clock / 1000)} seconds`}
      >
        {formatClock(clock)}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-35 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
    >
      {children}
    </button>
  );
}

export interface GameScreenProps {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  settings: Settings;
  engine: StockfishHandle;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}

export function GameScreen({ state, dispatch, settings, engine, onOpenSettings, onOpenAbout }: GameScreenProps) {
  const playerColor = state.config.playerColor;
  const fen = displayFen(state);
  const liveFenValue = liveFen(state);
  const reviewing = isReviewing(state);
  const gameOver = Boolean(state.result);
  const turn = turnAt(fen);
  const myTurn = !gameOver && !reviewing && turn === playerColor;
  const orientation: Color = state.flipped ? opposite(playerColor) : playerColor;

  const [selectedUci, setSelectedUci] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string; actor: Actor } | null>(null);
  const [confirmKind, setConfirmKind] = useState<'new' | 'restart' | 'resign' | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [dataTab, setDataTab] = useState<DataTab>('fen');
  const [review, setReview] = useState<{ tags: Record<number, MoveGrade>; summary: ReviewSummary } | null>(null);
  const [reviewRun, setReviewRun] = useState<{ running: boolean; done: number; total: number } | null>(null);
  const reviewAbort = useRef(false);

  /* Engine lifecycle ------------------------------------------------- */

  useEffect(() => {
    if (state.phase === 'setup') return;
    void engine.ensure().then((client) => client?.setOptions({ hashMb: settings.hashMb }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  useEffect(() => {
    if (engine.client && engine.status === 'ready') {
      engine.client.setOptions({ hashMb: settings.hashMb });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.hashMb, engine.status]);

  /* Clock ------------------------------------------------------------ */

  const clockRunning = state.phase === 'live' && state.clockEnabled && !state.paused && !state.result;

  useEffect(() => {
    if (!clockRunning) return;
    const id = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 200);
    const onVisibility = () => {
      if (!document.hidden) dispatch({ type: 'tick', now: Date.now() });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [clockRunning, dispatch]);

  useEffect(() => {
    dispatch({ type: 'setPauseWhileAnalyzing', value: settings.pauseWhileAnalyzing });
  }, [settings.pauseWhileAnalyzing, dispatch]);

  /* Analysis --------------------------------------------------------- */

  const analysis = useAnalysis({
    client: engine.client,
    ready: engine.booted,
    fen,
    enabled: (myTurn || reviewing) && !reviewRun?.running,
    auto: settings.autoAnalyze && !reviewing,
    movetimeMs: settings.analysisMs,
    multiPv: settings.multiPv,
  });

  useEffect(() => {
    setSelectedUci(null);
  }, [fen]);

  useEffect(() => {
    if (state.pauseWhileAnalyzing) {
      dispatch({ type: 'setAnalysisHold', hold: analysis.status === 'thinking', now: Date.now() });
    }
  }, [analysis.status, state.pauseWhileAnalyzing, dispatch]);

  useEffect(() => {
    if (state.endSummary) setShowSummary(true);
  }, [state.endSummary, state.history.length]);

  /* Move entry ------------------------------------------------------- */

  const commit = useCallback(
    (from: string, to: string, promotionPiece: string | undefined, actor: Actor) => {
      const game: Chess = safeChess(fen);
      const applied = tryMove(game, { from, to, promotion: promotionPiece });
      if (!applied) {
        dispatch({ type: 'notify', kind: 'error', text: 'That move is not legal in this position.' });
        return;
      }
      dispatch({ type: 'record', actor, move: applied, now: Date.now() });
    },
    [fen, dispatch],
  );

  const attemptMove = useCallback(
    (from: string, to: string) => {
      const game = safeChess(fen);
      const needsPromotion = game
        .moves({ verbose: true })
        .some((move) => move.from === from && move.to === to && move.promotion);
      const actor: Actor = turn === playerColor ? 'me' : 'opponent';
      if (needsPromotion) {
        setPromotion({ from, to, actor });
        return;
      }
      commit(from, to, undefined, actor);
    },
    [commit, fen, playerColor, turn],
  );

  const submitMove = useCallback(
    (raw: string, notation: NotationMode, actor: Actor): SubmitResult => {
      if (gameOver) return { ok: false, error: 'The game is already over.' };
      if (reviewing) return { ok: false, error: 'Return to the live position first.' };
      const expected: Actor = turn === playerColor ? 'me' : 'opponent';
      if (expected !== actor) {
        return {
          ok: false,
          error:
            expected === 'me'
              ? 'It is your turn — enter your own move.'
              : "It is your opponent's turn — enter their move.",
        };
      }
      const game = safeChess(fen);
      const parsed = parseMoveWithMode(raw, game, notation);
      if (!parsed.ok) return { ok: false, error: parsed.error, suggestions: parsed.suggestions };
      dispatch({ type: 'record', actor, move: parsed.move, now: Date.now() });
      return { ok: true };
    },
    [dispatch, fen, gameOver, playerColor, reviewing, turn],
  );

  const confirmSuggested = useCallback(
    (uci: string) => {
      const game = safeChess(fen);
      const move = tryMove(game, {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!move) {
        dispatch({
          type: 'notify',
          kind: 'error',
          text: 'That move is no longer legal here — recalculating.',
        });
        analysis.recalculate();
        return;
      }
      dispatch({ type: 'record', actor: 'me', move, now: Date.now() });
    },
    [analysis, dispatch, fen],
  );

  /* PGN / FEN -------------------------------------------------------- */

  const pgn = useMemo(
    () =>
      buildPgn({
        baseFen: state.baseFen,
        history: state.history,
        playerColor,
        minutes: state.config.minutes,
        result: state.result,
      }),
    [state.baseFen, state.history, state.result, playerColor, state.config.minutes],
  );

  const loadFen = (text: string): { ok: boolean; error?: string } => {
    if (text.trim().split(/\s+/).length !== 6) {
      return { ok: false, error: 'A FEN needs six fields: placement, turn, castling, en passant, half-move clock, move number.' };
    }
    try {
      const game = new Chess(text.trim());
      if (!game.fen()) throw new Error('invalid');
    } catch {
      return { ok: false, error: 'That is not a valid FEN position.' };
    }
    dispatch({ type: 'loadFen', fen: text.trim(), now: Date.now() });
    return { ok: true };
  };

  const loadPgn = (text: string): { ok: boolean; error?: string } => {
    try {
      const game = safeChess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      game.loadPgn(text.trim());
      const moves = game.history();
      const hasFen = /\[FEN\s+"/i.test(text);
      if (!moves.length && !hasFen) throw new Error('no moves found');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      return { ok: false, error: `Could not read that PGN — ${message}` };
    }
    dispatch({ type: 'loadPgn', pgn: text, now: Date.now() });
    return { ok: true };
  };

  const copyPgn = async () => {
    const ok = await copyText(pgn);
    dispatch({
      type: 'notify',
      kind: ok ? 'success' : 'error',
      text: ok ? 'PGN copied to the clipboard.' : 'Clipboard unavailable — use Import / Export to download.',
    });
  };

  /* Game review ------------------------------------------------------ */

  const runGameReview = useCallback(async () => {
    if (!engine.client || engine.status !== 'ready') {
      dispatch({ type: 'notify', kind: 'error', text: 'Wait for Stockfish to finish loading.' });
      return;
    }
    if (!state.history.length) return;
    if (!state.paused && state.phase === 'live') {
      dispatch({ type: 'togglePause', now: Date.now() });
    }
    const client = engine.client;
    const records = state.history;
    const positions = [state.baseFen, ...records.map((item) => item.fenAfter)];
    reviewAbort.current = false;
    setReview(null);
    setReviewRun({ running: true, done: 0, total: positions.length });
    await new Promise((resolve) => setTimeout(resolve, 90));
    const evals: (number | null)[] = [];
    for (let index = 0; index < positions.length; index++) {
      if (reviewAbort.current) break;
      setReviewRun({ running: true, done: index, total: positions.length });
      try {
        const result = await client.analyze({ fen: positions[index], movetimeMs: 320, multiPv: 1 });
        if (reviewAbort.current) break;
        const score = result.lines[0]?.score;
        evals.push(score ? whitePovCp(score, turnAt(positions[index])) : null);
      } catch {
        evals.push(null);
      }
    }
    if (reviewAbort.current) {
      setReviewRun(null);
      return;
    }
    const tags: Record<number, MoveGrade> = {};
    records.forEach((item, index) => {
      const before = evals[index];
      const after = evals[index + 1];
      if (before === null || before === undefined || after === null || after === undefined) return;
      tags[item.ply] = gradeMove(before, after, item.color);
    });
    setReview({ tags, summary: summariseReview({ records, evals }) });
    setReviewRun(null);
  }, [dispatch, engine.client, engine.status, state.baseFen, state.history, state.paused, state.phase]);

  useEffect(() => () => {
    reviewAbort.current = true;
  }, []);

  /* Derived ---------------------------------------------------------- */

  const material = useMemo(() => materialSummary(fen), [fen]);
  const bestLine = analysis.lines.find((line) => line.pv[0] === selectedUci) ?? analysis.lines[0] ?? null;
  const bestMoveSquares =
    settings.showArrow && bestLine?.pv[0] && (myTurn || reviewing)
      ? { from: bestLine.pv[0].slice(0, 2), to: bestLine.pv[0].slice(2, 4) }
      : null;
  const lastMove = state.viewPly > 0 ? state.history[state.viewPly - 1] : null;
  const moveNumber = useMemo(() => {
    const parts = fen.split(' ');
    return Number.parseInt(parts[5] ?? '1', 10) || 1;
  }, [fen]);

  const statusTitle = gameOver
    ? state.result?.winner === 'draw'
      ? 'Game drawn'
      : state.result?.winner === playerColor
        ? 'You won'
        : 'You lost'
    : reviewing
      ? `Reviewing move ${state.viewPly} of ${state.history.length}`
      : myTurn
        ? 'Your move'
        : "Opponent's move";

  const statusSubtitle = gameOver
    ? (state.result?.detail ?? '')
    : reviewing
      ? 'Position is behind live play — press “Back to live”.'
      : myTurn
        ? 'Record the move you actually played.'
        : 'Enter your opponent’s move from your board.';

  const confirmCopy = {
    new: {
      title: 'Start a new game?',
      description:
        'This game has moves recorded. Starting a new one discards the current position and clocks.',
      confirmLabel: 'Discard and start new',
      run: () => dispatch({ type: 'newGame' }),
    },
    restart: {
      title: 'Restart this game?',
      description: 'The board resets to the starting position with the same colour and time control.',
      confirmLabel: 'Restart',
      run: () =>
        dispatch({
          type: 'start',
          config: state.config,
          now: Date.now(),
          pauseWhileAnalyzing: settings.pauseWhileAnalyzing,
        }),
    },
    resign: {
      title: 'Resign this game?',
      description: 'The game ends and the result is recorded as a loss for you.',
      confirmLabel: 'Resign',
      run: () => dispatch({ type: 'resign', now: Date.now() }),
    },
  } as const;

  const activeConfirm = confirmKind ? confirmCopy[confirmKind] : null;
  const opponentColor = opposite(playerColor);

  const opponentCard = (
    <section className="surface p-3" aria-label="Enter opponent move">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {opponentColor === 'w' ? "White's" : "Black's"} move · opponent
          </h2>
          <p className="text-[11px] leading-relaxed muted">
            Enter what Person 2 just played. Every move is validated before the position changes.
          </p>
        </div>
        <Badge tone="amber">awaiting input</Badge>
      </div>
      <MoveInput
        key={`opponent-${turn}-${state.history.length}`}
        label={`Opponent's ${turn === 'w' ? 'White' : 'Black'} move`}
        submitLabel="Enter move"
        tone="amber"
        autoFocus
        onSubmit={(raw, notation) => submitMove(raw, notation, 'opponent')}
        hint="You can also click or drag their piece on the board."
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDataTab('fen');
            setDataOpen(true);
          }}
        >
          <Database className="h-3.5 w-3.5" /> Fix with FEN
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDataTab('pgn');
            setDataOpen(true);
          }}
        >
          <ListChecks className="h-3.5 w-3.5" /> Paste PGN
        </Button>
      </div>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1420px] px-3 pb-16 pt-3 sm:px-5">
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_370px] xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-4">
        <div className="mx-auto w-full min-w-0 max-w-[min(620px,calc(100dvh-20rem))] space-y-2.5 lg:sticky lg:top-[4.25rem] lg:max-w-[min(720px,calc(100dvh-18rem))]">
          <div className="surface flex items-center justify-between gap-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cx(
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  gameOver ? 'bg-slate-400' : myTurn ? 'bg-emerald-500' : 'pulse-dot bg-amber-500',
                )}
              />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {statusTitle}
                </div>
                <div className="truncate text-[11px] muted">{statusSubtitle}</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge tone="neutral">{state.config.minutes} min</Badge>
              <Badge tone={myTurn ? 'emerald' : 'neutral'}>move {moveNumber}</Badge>
            </div>
          </div>

          {reviewing && (
            <div className="fade-in flex flex-col gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-sky-400/25 dark:bg-sky-400/10">
              <div className="flex items-center gap-1.5 text-[11px] leading-relaxed text-sky-800 dark:text-sky-200">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Reviewing position after move {state.viewPly}. Clock paused; moves disabled.
                </span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => dispatch({ type: 'setViewPly', ply: state.history.length, now: Date.now() })}
              >
                Back to live
              </Button>
            </div>
          )}

          {gameOver && state.result && (
            <div className="fade-in flex flex-col gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white">
                    {state.result.winner === 'draw'
                      ? 'Draw'
                      : state.result.winner === playerColor
                        ? 'You win'
                        : 'Opponent wins'}
                    <span className="ml-1 font-normal muted">{state.result.detail}</span>
                  </div>
                  <div className="text-[11px] muted">
                    Review the game, analyse any position, or start a rematch.
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => setShowSummary(true)}>
                  Summary
                </Button>
                <Button size="sm" variant="primary" onClick={() => dispatch({ type: 'rematch', now: Date.now() })}>
                  <RotateCcw className="h-3.5 w-3.5" /> Rematch
                </Button>
              </div>
            </div>
          )}

          <div className="surface p-1.5 sm:p-2">
            <PlayerBar
              color={orientation}
              isYou={orientation === playerColor}
              clock={state.clocks[orientation]}
              active={turn === orientation && !gameOver}
              captured={orientation === 'w' ? material.capturedByWhite : material.capturedByBlack}
              advantage={orientation === 'w' ? Math.max(0, material.diff) : Math.max(0, -material.diff)}
              running={clockRunning}
              low={state.clocks[orientation] < 30_000}
            />
            <Board
              fen={fen}
              orientation={orientation}
              interactive={state.phase === 'live' && !gameOver && !reviewing}
              movableColor={turn}
              lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
              bestMove={bestMoveSquares}
              showCoordinates={settings.showCoordinates}
              theme={settings.boardTheme}
              onMove={attemptMove}
            />
            <PlayerBar
              color={opposite(orientation)}
              isYou={orientation !== playerColor}
              clock={state.clocks[opposite(orientation)]}
              active={turn !== orientation && !gameOver}
              captured={orientation === 'w' ? material.capturedByBlack : material.capturedByWhite}
              advantage={orientation === 'w' ? Math.max(0, -material.diff) : Math.max(0, material.diff)}
              running={clockRunning}
              low={state.clocks[opposite(orientation)] < 30_000}
            />
          </div>

          <div className="surface flex flex-wrap items-center gap-1 p-1.5">
            <div className="flex items-center gap-0.5">
              <IconButton
                label="First move"
                onClick={() => dispatch({ type: 'setViewPly', ply: 0, now: Date.now() })}
                disabled={state.viewPly === 0}
              >
                <ChevronsLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Previous move"
                onClick={() => dispatch({ type: 'setViewPly', ply: state.viewPly - 1, now: Date.now() })}
                disabled={state.viewPly === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Next move"
                onClick={() => dispatch({ type: 'setViewPly', ply: state.viewPly + 1, now: Date.now() })}
                disabled={state.viewPly >= state.history.length}
              >
                <ChevronRight className="h-4 w-4" />
              </IconButton>
              <IconButton
                label="Live position"
                onClick={() => dispatch({ type: 'setViewPly', ply: state.history.length, now: Date.now() })}
                disabled={!reviewing}
              >
                <ChevronsRight className="h-4 w-4" />
              </IconButton>
            </div>
            <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden="true" />
            <IconButton
              label="Undo last move"
              onClick={() => dispatch({ type: 'undo', now: Date.now() })}
              disabled={!state.history.length}
            >
              <Undo2 className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Redo move"
              onClick={() => dispatch({ type: 'redo', now: Date.now() })}
              disabled={!state.redoStack.length}
            >
              <Redo2 className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Flip board"
              onClick={() => dispatch({ type: 'setFlipped', flipped: !state.flipped })}
            >
              <FlipVertical2 className="h-4 w-4" />
            </IconButton>
            <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block dark:bg-white/10" aria-hidden="true" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDataOpen(true)}
              aria-label="Import or export FEN or PGN"
            >
              <Database className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import / Export</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSummary(true)}
              aria-label="Open game summary"
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Summary</span>
            </Button>
            <div className="ml-auto flex items-center gap-0.5">
              {state.phase === 'live' && !gameOver && (
                <Button size="sm" variant="ghost" onClick={() => setConfirmKind('resign')} aria-label="Resign game">
                  <Flag className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Resign</span>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setConfirmKind('restart')} aria-label="Restart game">
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Restart</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmKind('new')} aria-label="New game">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New</span>
              </Button>
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-2.5">
          {!myTurn && !gameOver && !reviewing && opponentCard}

          <EnginePanel
            engineStatus={engine.status}
            engineName={engine.name}
            engineError={engine.error}
            engineInfo={`${settings.hashMb} MB hash`}
            analysis={analysis}
            fen={fen}
            turn={turn}
            multiPv={settings.multiPv}
            myTurn={myTurn}
            reviewing={reviewing}
            gameOver={gameOver}
            selectedUci={selectedUci}
            onSelectUci={setSelectedUci}
            onConfirm={confirmSuggested}
            onRecordOther={(raw, notation) => submitMove(raw, notation, 'me')}
            onRetryEngine={() => void engine.ensure()}
            onAnalyze={analysis.recalculate}
          />

          <ClocksCard
            clocks={state.clocks}
            turn={turn}
            playerColor={playerColor}
            paused={state.paused}
            running={clockRunning}
            finished={gameOver}
            clockEnabled={state.clockEnabled}
            onTogglePause={() => dispatch({ type: 'togglePause', now: Date.now() })}
            onReset={() => dispatch({ type: 'resetClock', now: Date.now() })}
          />

          <MoveList
            baseFen={state.baseFen}
            history={state.history}
            viewPly={state.viewPly}
            onSelectPly={(ply) => dispatch({ type: 'setViewPly', ply, now: Date.now() })}
            tags={review?.tags}
            onCopyPgn={() => void copyPgn()}
          />

          <section className="surface p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                <Gamepad2 className="h-3.5 w-3.5 text-emerald-500" /> Session
              </div>
              <Badge tone="neutral">
                {state.history.length} ply · {state.config.minutes} min
              </Badge>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-lg bg-slate-100/70 px-2 py-1.5 dark:bg-white/[0.04]">
                <dt className="muted">You play</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">
                  {playerColor === 'w' ? 'White' : 'Black'}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-100/70 px-2 py-1.5 dark:bg-white/[0.04]">
                <dt className="muted">Material</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">
                  {material.diff === 0
                    ? 'equal'
                    : material.diff > 0
                      ? `White +${material.diff}`
                      : `Black +${-material.diff}`}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-100/70 px-2 py-1.5 dark:bg-white/[0.04]">
                <dt className="muted">Moves</dt>
                <dd className="font-semibold tabular text-slate-800 dark:text-slate-100">
                  {Math.ceil(state.history.length / 2)}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-100/70 px-2 py-1.5 dark:bg-white/[0.04]">
                <dt className="muted">Mode</dt>
                <dd className="font-semibold text-slate-800 dark:text-slate-100">
                  {reviewing ? 'Review' : gameOver ? 'Finished' : 'Live'}
                </dd>
              </div>
            </dl>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="secondary" onClick={onOpenSettings}>
                Settings
              </Button>
              <Button size="sm" variant="ghost" onClick={onOpenAbout}>
                Fair play & privacy
              </Button>
            </div>
            <p className="mt-2 flex items-start gap-1 text-[10px] leading-relaxed muted">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
              Live engine help is only appropriate where the rules allow it. Never in rated games.
            </p>
          </section>
        </aside>
      </div>

      {myTurn && !gameOver && (
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] muted lg:hidden">
          <Sparkles className="h-3 w-3 text-emerald-500" />
          The recommendation is in the panel below the board.
        </div>
      )}

      <PromotionDialog
        open={Boolean(promotion)}
        color={promotion ? (promotion.actor === 'me' ? playerColor : opponentColor) : 'w'}
        onSelect={(piece) => {
          if (!promotion) return;
          commit(promotion.from, promotion.to, piece, promotion.actor);
          setPromotion(null);
        }}
        onCancel={() => setPromotion(null)}
      />

      <ConfirmDialog
        open={Boolean(activeConfirm)}
        title={activeConfirm?.title ?? ''}
        description={activeConfirm?.description}
        confirmLabel={activeConfirm?.confirmLabel}
        destructive
        onCancel={() => setConfirmKind(null)}
        onConfirm={() => {
          activeConfirm?.run();
          setConfirmKind(null);
        }}
      />

      <SummaryDialog
        open={showSummary}
        onClose={() => setShowSummary(false)}
        result={state.result}
        playerColor={playerColor}
        history={state.history}
        summary={review?.summary ?? null}
        reviewRun={reviewRun}
        onReview={() => void runGameReview()}
        onCancelReview={() => {
          reviewAbort.current = true;
          setReviewRun(null);
        }}
        onExportPgn={() => downloadText(`chess-ai-arena-${timestampSlug()}.pgn`, pgn)}
        onCopyPgn={() => void copyPgn()}
        onOpenData={() => {
          setDataTab('pgn');
          setDataOpen(true);
        }}
        onRematch={() => dispatch({ type: 'rematch', now: Date.now() })}
        onNewGame={() => setConfirmKind('new')}
      />

      {dataOpen && (
        <FenPgnDialog
          open
          onClose={() => setDataOpen(false)}
          initialTab={dataTab}
          fen={liveFenValue}
          pgn={pgn}
          onLoadFen={loadFen}
          onLoadPgn={loadPgn}
          onCopy={(text, label) => {
            void copyText(text).then((ok) =>
              dispatch({
                type: 'notify',
                kind: ok ? 'success' : 'error',
                text: ok ? `${label} copied to the clipboard.` : 'Clipboard unavailable in this browser.',
              }),
            );
          }}
        />
      )}
    </div>
  );
}
