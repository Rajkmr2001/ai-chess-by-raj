import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import type { Color } from '../types';
import { formatClock } from '../lib/format';
import { Badge, Button, cx } from './ui';

export interface ClocksCardProps {
  clocks: { w: number; b: number };
  turn: Color;
  playerColor: Color;
  paused: boolean;
  running: boolean;
  finished: boolean;
  clockEnabled: boolean;
  onTogglePause: () => void;
  onReset: () => void;
}

function ClockRow({
  color,
  ms,
  active,
  label,
  running,
  low,
}: {
  color: Color;
  ms: number;
  active: boolean;
  label: string;
  running: boolean;
  low: boolean;
}) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        active
          ? 'border-emerald-400/60 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10'
          : 'border-slate-200/80 bg-white/60 dark:border-white/5 dark:bg-white/[0.02]',
      )}
    >
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
          <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{label}</div>
          <div className="text-[10px] uppercase tracking-wide muted">
            {color === 'w' ? 'White' : 'Black'}
            {active && running ? ' · to move' : ''}
          </div>
        </div>
      </div>
      <div
        className={cx(
          'tabular text-xl font-semibold tracking-tight sm:text-2xl',
          active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200',
          low && !active && 'text-rose-600 dark:text-rose-400',
        )}
        aria-label={`${label} clock ${Math.ceil(ms / 1000)} seconds`}
      >
        {formatClock(ms)}
      </div>
    </div>
  );
}

export function ClocksCard({
  clocks,
  turn,
  playerColor,
  paused,
  running,
  finished,
  clockEnabled,
  onTogglePause,
  onReset,
}: ClocksCardProps) {
  return (
    <section className="surface p-3" aria-label="Chess clock">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <Timer className="h-3.5 w-3.5" aria-hidden="true" />
          Training clock
        </div>
        {finished ? (
          <Badge tone="neutral">stopped</Badge>
        ) : paused ? (
          <Badge tone="amber">paused</Badge>
        ) : running ? (
          <Badge tone="emerald">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            running
          </Badge>
        ) : (
          <Badge tone="neutral">stopped</Badge>
        )}
      </div>
      <div className="space-y-1.5">
        <ClockRow
          color="b"
          ms={clocks.b}
          active={turn === 'b' && !finished}
          label={playerColor === 'b' ? 'You (Black)' : 'Opponent (Black)'}
          running={running}
          low={clocks.b < 30_000}
        />
        <ClockRow
          color="w"
          ms={clocks.w}
          active={turn === 'w' && !finished}
          label={playerColor === 'w' ? 'You (White)' : 'Opponent (White)'}
          running={running}
          low={clocks.w < 30_000}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={paused ? 'primary' : 'secondary'}
          onClick={onTogglePause}
          disabled={finished || !clockEnabled}
          aria-label={paused ? 'Resume clock' : 'Pause clock'}
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onReset} disabled={finished} aria-label="Reset clock">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed muted">
        Independent website clock. It is not synced with your phone, chess app or tournament clock — use it
        as a training aid.
      </p>
    </section>
  );
}
