import { PIECE_NAME, type Color } from '../../types';
import { Piece } from '../../pieces/Piece';
import { Modal } from '../ui';

const OPTIONS = ['q', 'r', 'b', 'n'] as const;

export function PromotionDialog({
  open,
  color,
  onSelect,
  onCancel,
}: {
  open: boolean;
  color: Color;
  onSelect: (piece: 'q' | 'r' | 'b' | 'n') => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Promote your pawn"
      description="Choose the piece your pawn becomes. This also applies to a promotion you entered for your opponent."
      width="sm"
    >
      <div className="grid grid-cols-4 gap-2">
        {OPTIONS.map((option, index) => (
          <button
            key={option}
            type="button"
            data-autofocus={index === 0 ? true : undefined}
            onClick={() => onSelect(option)}
            className="group flex flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-emerald-400/60 dark:hover:bg-emerald-400/10"
          >
            <span className="h-12 w-12">
              <Piece piece={`${color}${option.toUpperCase()}`} />
            </span>
            <span className="text-[11px] font-medium capitalize text-slate-700 dark:text-slate-200">
              {PIECE_NAME[option]}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
