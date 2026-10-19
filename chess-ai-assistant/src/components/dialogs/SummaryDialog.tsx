import {
  ClipboardCopy,
  Download,
  Gauge,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { Color, GameResult, MoveRecord } from '../../types';
import { TAG_STYLES, pairMoves, type ReviewSummary } from '../../lib/review';
import { Badge, Button, Modal, ProgressBar } from '../ui';

function ResultHeadline({ result, playerColor }: { result: GameResult | null; playerColor: Color }) {
  if (!result) return <span>Game in progress</span>;
  if (result.winner === 'draw') return <span>Draw</span>;
  return <span>{result.winner === playerColor ? 'You win' : 'You lost'}</span>;
}

export function SummaryDialog({
  open,
  onClose,
  result,
  playerColor,
  history,
  summary,
  reviewRun,
  onReview,
  onCancelReview,
  onExportPgn,
  onCopyPgn,
  onOpenData,
  onRematch,
  onNewGame,
}: {
  open: boolean;
  onClose: () => void;
  result: GameResult | null;
  playerColor: Color;
  history: MoveRecord[];
  summary: ReviewSummary | null;
  reviewRun: { running: boolean; done: number; total: number } | null;
  onReview: () => void;
  onCancelReview: () => void;
  onExportPgn: () => void;
  onCopyPgn: () => void;
  onOpenData: () => void;
  onRematch: () => void;
  onNewGame: () => void;
}) {
  const you = summary?.accuracy.me;
  const opponent = summary?.accuracy.opponent;
  const lastRows = history.length ? pairMoves(history, history[0].fenBefore).slice(-4) : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Game summary"
      description="Results, notation and an optional Stockfish review of every move."
      icon={<Trophy className="h-5 w-5" />}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCopyPgn} disabled={!history.length}>
            <ClipboardCopy className="h-4 w-4" /> Copy PGN
          </Button>
          <Button variant="secondary" onClick={onExportPgn} disabled={!history.length}>
            <Download className="h-4 w-4" /> Export PGN
          </Button>
          <Button variant="secondary" onClick={onNewGame}>
            <Plus className="h-4 w-4" /> New game
          </Button>
          <Button variant="primary" onClick={onRematch}>
            <RotateCcw className="h-4 w-4" /> Rematch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:from-white/[0.06] dark:to-transparent">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider muted">
              {result ? 'Result' : 'Status'}
            </div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <ResultHeadline result={result} playerColor={playerColor} />
            </div>
            <p className="mt-0.5 text-xs leading-relaxed muted">
              {result?.detail ?? 'The game is still in progress.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">You: {playerColor === 'w' ? 'White' : 'Black'}</Badge>
            <Badge tone="neutral">{history.length} ply</Badge>
            {result?.reason && <Badge tone="sky">{result.reason.replace(/-/g, ' ')}</Badge>}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Your accuracy</span>
              <Gauge className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular text-slate-900 dark:text-white">
              {you === null || you === undefined ? '—' : `${you}%`}
            </div>
            <p className="text-[10px] leading-relaxed muted">
              Estimated from engine evaluations — a heuristic, not an official score.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Opponent accuracy
              </span>
              <Gauge className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-1 text-2xl font-bold tabular text-slate-900 dark:text-white">
              {opponent === null || opponent === undefined ? '—' : `${opponent}%`}
            </div>
            <p className="text-[10px] leading-relaxed muted">
              Same method, applied to their moves.
            </p>
          </div>
        </div>

        {summary && (
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['blunder', 'Blunders'],
                ['mistake', 'Mistakes'],
                ['inaccuracy', 'Inaccuracies'],
              ] as const
            ).map(([tag, label]) => (
              <Badge key={tag} tone={tag === 'blunder' ? 'rose' : tag === 'mistake' ? 'amber' : 'neutral'}>
                <span className={TAG_STYLES[tag].className}>{TAG_STYLES[tag].symbol}</span>
                {summary.counts[tag]} {label}
              </Badge>
            ))}
          </div>
        )}

        {reviewRun?.running ? (
          <div className="rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 dark:border-emerald-400/25 dark:bg-emerald-400/10">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reviewing position {Math.min(reviewRun.done + 1, reviewRun.total)} of {reviewRun.total}…
              </span>
              <span className="tabular">
                {Math.round((reviewRun.done / Math.max(1, reviewRun.total)) * 100)}%
              </span>
            </div>
            <ProgressBar
              value={reviewRun.done / Math.max(1, reviewRun.total)}
              className="mt-2"
              label="Review progress"
            />
            <Button size="sm" variant="ghost" className="mt-2" onClick={onCancelReview}>
              Stop review
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200/80 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {summary ? 'Review complete' : 'Post-game review'}
              </div>
              <p className="text-[11px] leading-relaxed muted">
                {summary
                  ? 'Click any move in the list to revisit the position and analyse it.'
                  : 'Run Stockfish over every move to spot mistakes and estimate accuracy. Takes a few seconds and pauses the clock.'}
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={onReview} disabled={!history.length}>
              <Sparkles className="h-3.5 w-3.5" />
              {summary ? 'Review again' : 'Review with Stockfish'}
            </Button>
          </div>
        )}

        {lastRows.length > 0 && (
          <div className="rounded-xl border border-slate-200/80 p-3 dark:border-white/10">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider muted">
              Final moves
            </div>
            <div className="space-y-1 font-mono text-xs text-slate-700 dark:text-slate-200">
              {lastRows.map((pair, index) => {
                const number = pair[0]?.moveNumber ?? pair[1]?.moveNumber ?? index + 1;
                return (
                  <div key={index} className="flex gap-3">
                    <span className="w-7 text-right text-slate-400">{number}.</span>
                    <span className="min-w-16">{pair[0]?.san ?? '…'}</span>
                    <span className="min-w-16">{pair[1]?.san ?? ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenData}
          className="text-[11px] font-medium text-emerald-700 underline decoration-emerald-500/40 underline-offset-2 hover:decoration-emerald-500 dark:text-emerald-300"
        >
          Import or export FEN / PGN
        </button>
      </div>
    </Modal>
  );
}
