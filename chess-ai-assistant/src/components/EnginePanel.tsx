import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Crown,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Telescope,
  Zap,
} from 'lucide-react';
import type { EngineStatus } from '../engine/client';
import type { useAnalysis } from '../engine/useAnalysis';
import type { EngineLine } from '../engine/protocol';
import { describeMove, pvPreview, tacticalNotes, type TacticalNote } from '../lib/tactics';
import { pvToSan } from '../lib/chess';
import { evalLabel, formatDuration, whiteBarFraction, whitePovCp } from '../lib/format';
import type { Color } from '../types';
import { Badge, Button, Spinner, cx } from './ui';
import { MoveInput, type NotationMode, type SubmitResult } from './MoveInput';

export interface EnginePanelProps {
  engineStatus: EngineStatus;
  engineName: string;
  engineError: string | null;
  engineInfo: string;
  analysis: ReturnType<typeof useAnalysis>;
  fen: string;
  turn: Color;
  /** Number of engine lines requested; used to reserve space while searching. */
  multiPv: number;
  myTurn: boolean;
  reviewing: boolean;
  gameOver: boolean;
  selectedUci: string | null;
  onSelectUci: (uci: string) => void;
  onConfirm: (uci: string) => void;
  onRecordOther: (raw: string, notation: NotationMode) => SubmitResult;
  onRetryEngine: () => void;
  onAnalyze: () => void;
}

function StatusBadge({ status, depth, progress }: { status: EngineStatus; depth: number; progress: boolean }) {
  if (status === 'starting') {
    return (
      <Badge tone="sky">
        <Spinner className="h-3 w-3" /> loading
      </Badge>
    );
  }
  if (status === 'error') return <Badge tone="rose">engine error</Badge>;
  if (status === 'thinking') {
    return (
      <Badge tone="amber">
        <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        {progress ? 'provisional' : 'searching'} {depth ? `· d${depth}` : ''}
      </Badge>
    );
  }
  return <Badge tone="emerald">ready</Badge>;
}

function EvalBar({ cp }: { cp: number | null }) {
  const fraction = whiteBarFraction(cp);
  return (
    <div>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full border border-slate-300 bg-slate-800 dark:border-white/10"
        role="img"
        aria-label={`Evaluation bar: White ${Math.round(fraction * 100)} percent`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-slate-100 transition-[width] duration-300"
          style={{ width: `${fraction * 100}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-400/70" />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium uppercase tracking-wider muted">
        <span>White</span>
        <span>Black</span>
      </div>
    </div>
  );
}

function CandidateRow({
  line,
  fen,
  turn,
  selected,
  onSelect,
  index,
}: {
  line: EngineLine;
  fen: string;
  turn: Color;
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const san = pvToSan(fen, line.pv, 1)[0] ?? line.pv[0] ?? '—';
  const preview = pvPreviewSafe(fen, line.pv);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'group flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
        selected
          ? 'border-emerald-400/70 bg-emerald-50 dark:border-emerald-400/40 dark:bg-emerald-400/10'
          : 'border-slate-200/70 bg-white/60 hover:border-slate-300 hover:bg-white dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-white/15 dark:hover:bg-white/[0.05]',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-4 shrink-0 text-[10px] font-semibold muted">{index}</span>
        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{san}</span>
        <span className="truncate font-mono text-[11px] muted">{preview}</span>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular text-slate-700 dark:text-slate-200">
        {evalLabel(line.score, turn)}
      </span>
    </button>
  );
}

function pvPreviewSafe(fen: string, pv: string[]): string {
  try {
    return pvPreview(fen, pv.slice(1), 4);
  } catch {
    return '';
  }
}

function NoteRow({ note }: { note: TacticalNote }) {
  const Icon = note.tone === 'bad' ? ShieldAlert : note.tone === 'good' ? Target : Info;
  return (
    <li
      className={cx(
        'flex items-start gap-1.5 text-[11px] leading-relaxed',
        note.tone === 'bad'
          ? 'text-rose-600 dark:text-rose-300'
          : note.tone === 'good'
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-slate-600 dark:text-slate-300',
      )}
    >
      <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{note.text}</span>
    </li>
  );
}

export function EnginePanel({
  engineStatus,
  engineName,
  engineError,
  engineInfo,
  analysis,
  fen,
  turn,
  multiPv,
  myTurn,
  reviewing,
  gameOver,
  selectedUci,
  onSelectUci,
  onConfirm,
  onRecordOther,
  onRetryEngine,
  onAnalyze,
}: EnginePanelProps) {
  const [showAlt, setShowAlt] = useState(false);
  useEffect(() => setShowAlt(false), [fen]);

  const notes = useMemo(() => {
    try {
      return tacticalNotes(fen);
    } catch {
      return [];
    }
  }, [fen]);

  const primary = analysis.lines[0] ?? null;
  const selectedLine = analysis.lines.find((line) => line.pv[0] === selectedUci) ?? primary;
  const chosenSan = selectedLine?.pv[0] ? pvToSan(fen, selectedLine.pv, 1)[0] : null;
  const primarySan = primary?.pv[0] ? pvToSan(fen, primary.pv, 1)[0] : null;
  const cp = selectedLine ? whitePovCp(selectedLine.score, turn) : null;
  const busy = analysis.status === 'thinking';
  const hasLines = analysis.lines.length > 0;
  const engineLoading = engineStatus === 'starting' || (engineStatus === 'idle' && !engineError);

  return (
    <section className="surface overflow-hidden" aria-label="Engine recommendation">
      <header className="flex items-start justify-between gap-2 border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">
              AI recommendation
            </h2>
            <p className="truncate text-[10px] muted">
              {engineName} · {engineInfo}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge status={engineStatus} depth={analysis.depth} progress={analysis.progress} />
          <button
            type="button"
            onClick={analysis.recalculate}
            disabled={!myTurn && !reviewing && !gameOver}
            aria-label="Recalculate recommendation"
            title="Recalculate"
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <RefreshCw className={cx('h-3.5 w-3.5', busy && 'animate-spin')} />
          </button>
        </div>
      </header>

      <div className="space-y-3 p-3">
        {engineError && engineStatus === 'error' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-700 dark:border-rose-400/25 dark:bg-rose-500/10 dark:text-rose-300">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> Stockfish could not start
            </div>
            <p>{engineError}</p>
            <p className="mt-1 opacity-80">
              Check that <code className="font-mono">engine/stockfish-*-lite-single.wasm</code> is served
              next to the app (right path after deployment), then retry.
            </p>
            <Button size="sm" className="mt-2" onClick={onRetryEngine}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry engine
            </Button>
          </div>
        )}

        {engineLoading && !engineError && (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/5 dark:bg-white/[0.02]">
            <Spinner className="h-5 w-5 text-emerald-500" />
            <div>
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                Loading Stockfish…
              </div>
              <div className="text-[11px] muted">Downloading the WebAssembly engine (~1.9 MB, cached).</div>
            </div>
          </div>
        )}

        {!myTurn && !reviewing && !gameOver && engineStatus !== 'error' && (
          <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center dark:border-white/15">
            <ArrowLeftRight className="mx-auto mb-1.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
              Waiting for your opponent's move
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed muted">
              Enter their move below — the board, the clocks and the engine all update automatically.
            </p>
          </div>
        )}

        {reviewing && (
          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-[11px] leading-relaxed text-sky-800 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-200">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Review mode: analysing a past position. Nothing here changes the live game — click the last
              move to return.
            </span>
          </div>
        )}

        {hasLines && selectedLine && (
          <>
            <div className="rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-3 dark:border-white/10 dark:from-white/[0.06] dark:to-white/[0.02]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider muted">
                    {reviewing ? 'Best move here' : 'Recommended move'}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {chosenSan ?? '—'}
                    </span>
                    {selectedLine.pv[0] && (
                      <span className="font-mono text-[11px] muted">
                        {selectedLine.pv[0].slice(0, 2)} → {selectedLine.pv[0].slice(2, 4)}
                      </span>
                    )}
                  </div>
                  {selectedLine.pv[0] && (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                      {describeMove(fen, selectedLine.pv[0])}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular text-slate-900 dark:text-white">
                    {evalLabel(selectedLine.score, turn)}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide muted">White POV</div>
                  <Badge tone={busy ? 'amber' : 'emerald'} className="mt-1">
                    {busy ? 'provisional' : 'completed'}
                  </Badge>
                </div>
              </div>

              <div className="mt-2.5">
                <EvalBar cp={cp} />
              </div>

              <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-slate-100/70 px-1.5 py-1 dark:bg-white/[0.05]">
                  <dt className="text-[9px] uppercase tracking-wide muted">Depth</dt>
                  <dd className="text-xs font-semibold tabular text-slate-800 dark:text-slate-100">
                    {analysis.depth || '—'}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-100/70 px-1.5 py-1 dark:bg-white/[0.05]">
                  <dt className="text-[9px] uppercase tracking-wide muted">Time</dt>
                  <dd className="text-xs font-semibold tabular text-slate-800 dark:text-slate-100">
                    {analysis.elapsedMs ? formatDuration(analysis.elapsedMs) : '—'}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-100/70 px-1.5 py-1 dark:bg-white/[0.05]">
                  <dt className="text-[9px] uppercase tracking-wide muted">Mode</dt>
                  <dd className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {analysis.deep ? 'Deep' : 'Quick'}
                  </dd>
                </div>
              </dl>

              {selectedLine.pv.length > 1 && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed">
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                  <span className="min-w-0 break-words font-mono text-slate-600 dark:text-slate-300">
                    {pvPreview(fen, selectedLine.pv, 8) || '—'}
                  </span>
                </div>
              )}

              {primarySan && chosenSan && primarySan !== chosenSan && (
                <p className="mt-1.5 text-[10px] muted">
                  Engine's first choice: <span className="font-mono font-semibold">{primarySan}</span>
                </p>
              )}
            </div>

            {analysis.lines.length > 1 && (
              <div className="space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider muted">
                  Alternatives
                </div>
                {analysis.lines.slice(1, 4).map((line, index) => (
                  <CandidateRow
                    key={`${line.multipv}-${line.pv[0]}`}
                    line={line}
                    fen={fen}
                    turn={turn}
                    index={index + 2}
                    selected={line.pv[0] === selectedLine.pv[0]}
                    onSelect={() => line.pv[0] && onSelectUci(line.pv[0])}
                  />
                ))}
              </div>
            )}

          </>
        )}

        {!hasLines && !engineError && (myTurn || reviewing || gameOver) && (
          <>
            {/* Placeholder mirrors the recommendation card so nothing jumps when the
                first result arrives. */}
            <div className="rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50 p-3 dark:border-white/10 dark:from-white/[0.06] dark:to-white/[0.02]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider muted">
                    {reviewing ? 'Best move here' : 'Recommended move'}
                  </div>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-mono text-3xl font-bold tracking-tight text-slate-400 dark:text-slate-500">
                      —
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {busy ? (
                      <>
                        <Spinner className="h-3 w-3 text-emerald-500" /> Stockfish is thinking…
                      </>
                    ) : analysis.status === 'error' ? (
                      analysis.error
                    ) : (
                      'No evaluation yet — analyse this position.'
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular text-slate-400 dark:text-slate-500">—</div>
                  <div className="text-[10px] uppercase tracking-wide muted">White POV</div>
                  <Badge tone={busy ? 'amber' : 'neutral'} className="mt-1">
                    {busy ? 'searching' : 'idle'}
                  </Badge>
                </div>
              </div>
              <div className="mt-2.5">
                <EvalBar cp={0} />
              </div>
              <dl className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                {['Depth', 'Time', 'Mode'].map((label) => (
                  <div key={label} className="rounded-lg bg-slate-100/70 px-1.5 py-1 dark:bg-white/[0.05]">
                    <dt className="text-[9px] uppercase tracking-wide muted">{label}</dt>
                    <dd className="text-xs font-semibold tabular text-slate-400 dark:text-slate-500">—</dd>
                  </div>
                ))}
              </dl>
            </div>
            {multiPv > 1 && (
              <div className="space-y-1" aria-hidden="true">
                <div className="text-[10px] font-semibold uppercase tracking-wider muted">Alternatives</div>
                {Array.from({ length: Math.min(multiPv - 1, 3) }, (_, index) => (
                  <div
                    key={index}
                    className="h-[38px] rounded-lg border border-dashed border-slate-200/80 dark:border-white/10"
                  />
                ))}
              </div>
            )}
          </>
        )}

        {myTurn && !reviewing && !gameOver && (
          <div className="space-y-2 pt-0.5">
            <Button
              variant="primary"
              size="lg"
              full
              disabled={!chosenSan || !selectedLine?.pv[0]}
              onClick={() => selectedLine?.pv[0] && onConfirm(selectedLine.pv[0])}
            >
              <Check className="h-4 w-4" />
              {hasLines ? `Confirm ${chosenSan ?? 'move'} played` : 'Waiting for Stockfish…'}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowAlt((value) => !value)}>
                <Crown className="h-3.5 w-3.5" />
                I played another move
              </Button>
              <Button size="sm" variant="ghost" onClick={analysis.analyseDeeper} disabled={busy}>
                <Telescope className="h-3.5 w-3.5" />
                Deeper analysis
              </Button>
            </div>
            {showAlt && (
              <div className="fade-in rounded-xl border border-slate-200/70 bg-slate-50/70 p-2.5 dark:border-white/10 dark:bg-white/[0.03]">
                <MoveInput
                  label="Your actual move"
                  submitLabel="Record"
                  autoFocus
                  disabled={!myTurn}
                  hint="Record what you really played on your board. The game continues from that position."
                  onSubmit={onRecordOther}
                />
              </div>
            )}
            <p className="text-center text-[10px] leading-relaxed muted">
              Only press <span className="font-medium">Confirm</span> after you have played the move on your
              real board.
            </p>
          </div>
        )}

        {!hasLines && !engineError && (myTurn || reviewing || gameOver) && !busy && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-[11px] dark:border-white/15">
            <span className="min-w-0 muted">
              {analysis.status === 'error'
                ? analysis.error
                : 'Auto-analysis did not produce a move yet.'}
            </span>
            <Button size="sm" variant="secondary" onClick={onAnalyze}>
              <Sparkles className="h-3.5 w-3.5" /> Analyze
            </Button>
          </div>
        )}

        {notes.length > 0 && (
          <details className="group rounded-xl border border-slate-200/70 px-2.5 py-2 dark:border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3" aria-hidden="true" /> Position facts
              </span>
              <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-2 space-y-1">
              {notes.map((note, index) => (
                <NoteRow key={index} note={note} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
