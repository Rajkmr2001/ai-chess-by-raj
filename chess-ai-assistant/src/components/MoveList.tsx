import { useEffect, useMemo, useRef } from 'react';
import { ClipboardCopy, ListOrdered } from 'lucide-react';
import type { MoveRecord } from '../types';
import { pairMoves, TAG_STYLES, type MoveGrade } from '../lib/review';
import { EmptyState, cx } from './ui';

export interface MoveListProps {
  baseFen: string;
  history: MoveRecord[];
  viewPly: number;
  onSelectPly: (ply: number) => void;
  tags?: Record<number, MoveGrade>;
  onCopyPgn: () => void;
}

export function MoveList({ baseFen, history, viewPly, onSelectPly, tags, onCopyPgn }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => pairMoves(history, baseFen), [history, baseFen]);
  const startNumber = useMemo(() => {
    const parts = baseFen.split(' ');
    return Number.parseInt(parts[5] ?? '1', 10) || 1;
  }, [baseFen]);
  const startsWithBlack = useMemo(() => baseFen.split(' ')[1] === 'b', [baseFen]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const current = container.querySelector<HTMLElement>('[data-current="true"]');
    current?.scrollIntoView({ block: 'nearest' });
  }, [viewPly, history.length]);

  const MoveButton = ({ record }: { record: MoveRecord }) => {
    const current = record.ply === viewPly;
    const tag = tags?.[record.ply];
    return (
      <button
        type="button"
        data-current={current}
        onClick={() => onSelectPly(record.ply)}
        aria-current={current ? 'true' : undefined}
        aria-label={`${record.moveNumber}${record.color === 'w' ? '.' : '…'} ${record.san} — view position`}
        title={`${record.moveNumber}${record.color === 'w' ? '.' : '...'} ${record.san} — view position`}
        className={cx(
          'flex w-full items-center justify-between gap-1 rounded-md px-1.5 py-1 text-left font-mono text-[13px] transition-colors',
          current
            ? 'bg-emerald-500/15 font-semibold text-emerald-800 ring-1 ring-emerald-400/40 dark:text-emerald-200'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10',
        )}
      >
        <span className="truncate">{record.san}</span>
        {tag && (
          <span
            className={cx('shrink-0 text-[10px] font-bold', TAG_STYLES[tag.tag].className)}
            title={`${tag.label} (${(tag.lossCp / 100).toFixed(2)} eval change)`}
          >
            {TAG_STYLES[tag.tag].symbol}
          </span>
        )}
      </button>
    );
  };

  return (
    <section className="surface flex min-h-0 flex-col" aria-label="Move history">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 px-3 py-2 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <ListOrdered className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Moves</h2>
          <span className="text-[11px] muted">({history.length})</span>
        </div>
        <button
          type="button"
          onClick={onCopyPgn}
          disabled={!history.length}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ClipboardCopy className="h-3 w-3" aria-hidden="true" />
          Copy PGN
        </button>
      </div>

      {history.length === 0 ? (
        <EmptyState title="No moves yet" icon={<ListOrdered className="h-5 w-5" />}>
          Record the first move — by clicking the board or typing it — and it will appear here.
        </EmptyState>
      ) : (
        <div
          ref={scrollRef}
          className="no-scrollbar max-h-56 min-h-0 flex-1 overflow-y-auto p-1.5 lg:max-h-[15rem]"
        >
          <button
            type="button"
            onClick={() => onSelectPly(0)}
            className={cx(
              'mb-1 w-full rounded-md px-1.5 py-1 text-left text-[11px] font-medium transition-colors',
              viewPly === 0
                ? 'bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-400/40 dark:text-emerald-200'
                : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10',
            )}
          >
            {startsWithBlack ? 'Start (Black to move)' : 'Start position'}
          </button>
          {rows.map((pair, index) => {
            const number = startNumber + index;
            const white = pair[0];
            const black = pair[1];
            return (
              <div
                key={number}
                className="grid grid-cols-[1.85rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-0.5 py-0.5"
              >
                <span className="tabular text-[11px] text-slate-400 dark:text-slate-500">{number}.</span>
                {white ? <MoveButton record={white} /> : <span />}
                {black ? <MoveButton record={black} /> : <span />}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
