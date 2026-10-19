import { useState } from 'react';
import { ClipboardCopy, Download, FileText, Upload } from 'lucide-react';
import { Button, Modal, Segmented, cx } from '../ui';
import { downloadText, timestampSlug } from '../../lib/download';

export type DataTab = 'fen' | 'pgn';

export function FenPgnDialog({
  open,
  onClose,
  initialTab,
  fen,
  pgn,
  onLoadFen,
  onLoadPgn,
  onCopy,
}: {
  open: boolean;
  onClose: () => void;
  initialTab: DataTab;
  fen: string;
  pgn: string;
  onLoadFen: (text: string) => { ok: boolean; error?: string };
  onLoadPgn: (text: string) => { ok: boolean; error?: string };
  onCopy: (text: string, label: string) => void;
}) {
  // The dialog is mounted on demand (see GameScreen), so these initialisers run
  // with the current position — no empty-flash and no effect race.
  const [tab, setTab] = useState<DataTab>(initialTab);
  const [text, setText] = useState(() => (initialTab === 'fen' ? fen : pgn));
  const [error, setError] = useState<string | null>(null);

  const switchTab = (next: DataTab) => {
    setTab(next);
    setText(next === 'fen' ? fen : pgn);
    setError(null);
  };

  const load = () => {
    const result = tab === 'fen' ? onLoadFen(text) : onLoadPgn(text);
    if (result.ok) {
      setError(null);
      onClose();
    } else {
      setError(result.error ?? 'Could not load that data.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import or export a position"
      description="Use FEN to resynchronise a single position, or PGN to bring in a whole game."
      width="lg"
      icon={<FileText className="h-5 w-5" />}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => onCopy(text, tab.toUpperCase())}
            disabled={!text.trim()}
          >
            <ClipboardCopy className="h-4 w-4" /> Copy
          </Button>
          <Button variant="secondary" onClick={() => downloadText(`chess-ai-arena-${timestampSlug()}.${tab === 'fen' ? 'fen.txt' : 'pgn'}`, text)} disabled={!text.trim()}>
            <Download className="h-4 w-4" /> Download
          </Button>
          <Button variant="primary" onClick={load} disabled={!text.trim()}>
            <Upload className="h-4 w-4" /> Load {tab.toUpperCase()}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Segmented
          label="Data format"
          value={tab}
          onChange={switchTab}
          options={[
            { value: 'fen', label: 'FEN — position' },
            { value: 'pgn', label: 'PGN — full game' },
          ]}
        />
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
          spellCheck={false}
          rows={tab === 'fen' ? 4 : 10}
          aria-label={tab === 'fen' ? 'FEN' : 'PGN'}
          aria-invalid={Boolean(error)}
          className={cx(
            'w-full resize-y rounded-xl border bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 focus:outline-none focus:ring-2 dark:bg-white/[0.04] dark:text-slate-100',
            error
              ? 'border-rose-400 focus:ring-rose-400/30'
              : 'border-slate-300 focus:border-emerald-400 focus:ring-emerald-400/30 dark:border-white/15',
            tab === 'fen' && 'break-all',
          )}
        />
        {error && (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
          <strong className="font-semibold">Heads-up:</strong> loading replaces the current move list and
          resets the clocks. Export your game first if you want to keep it.
        </div>
        <div className="text-[11px] leading-relaxed muted">
          <p>
            <strong className="font-semibold text-slate-700 dark:text-slate-200">FEN</strong> describes one
            position, including whose turn it is and castling rights. It is the quickest way to fix a
            desynchronised game.
          </p>
          <p className="mt-1">
            <strong className="font-semibold text-slate-700 dark:text-slate-200">PGN</strong> stores the
            complete game with headers. Import it after the game to review, or to recover a session you
            saved elsewhere.
          </p>
        </div>
      </div>
    </Modal>
  );
}
