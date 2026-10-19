import { useEffect, useMemo, useState } from 'react';
import type { Chess, Square } from 'chess.js';
import { FILES, safeChess } from '../lib/chess';
import { PIECE_NAME, type BoardTheme, type Color } from '../types';
import { Piece } from '../pieces/Piece';
import { cx } from './ui';

export interface BoardProps {
  fen: string;
  orientation: Color;
  interactive: boolean;
  /** Colour whose pieces may be picked up (defaults to the side to move). */
  movableColor?: Color | null;
  lastMove?: { from: string; to: string } | null;
  bestMove?: { from: string; to: string } | null;
  showCoordinates?: boolean;
  theme?: BoardTheme;
  onMove: (from: string, to: string) => void;
  onSelectionChange?: (square: string | null) => void;
  className?: string;
}

const THEME_CLASS: Record<BoardTheme, string> = {
  classic: 'board-classic',
  green: 'board-green',
  ocean: 'board-ocean',
};

function squareIsLight(file: number, rank: number): boolean {
  return (file + rank) % 2 === 1;
}

export function Board({
  fen,
  orientation,
  interactive,
  movableColor,
  lastMove,
  bestMove,
  showCoordinates = true,
  theme = 'classic',
  onMove,
  onSelectionChange,
  className,
}: BoardProps) {
  const game: Chess = useMemo(() => safeChess(fen), [fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState<string>(orientation === 'w' ? 'a1' : 'h1');
  const [dragFrom, setDragFrom] = useState<string | null>(null);

  useEffect(() => {
    setSelected(null);
    setDragFrom(null);
    onSelectionChange?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);

  const pieces = useMemo(() => {
    const map = new Map<string, { type: string; color: Color }>();
    for (const row of game.board()) {
      for (const piece of row) {
        if (piece) map.set(piece.square, { type: piece.type, color: piece.color });
      }
    }
    return map;
  }, [game]);

  const legal = useMemo(() => game.moves({ verbose: true }), [game]);
  const turn = game.turn();
  const pickable = movableColor ?? turn;
  const legalFromSelected = useMemo(
    () => (selected ? legal.filter((move) => move.from === selected) : []),
    [legal, selected],
  );
  const targets = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const move of legalFromSelected) map.set(move.to, Boolean(move.captured));
    return map;
  }, [legalFromSelected]);

  const checkSquare = useMemo(() => {
    if (!game.isCheck()) return null;
    for (const row of game.board()) {
      for (const piece of row) {
        if (piece && piece.type === 'k' && piece.color === turn) return piece.square;
      }
    }
    return null;
  }, [game, turn]);

  const rankOrder = orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const fileOrder = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  const select = (square: string) => {
    const piece = pieces.get(square);
    if (piece && piece.color === turn && piece.color === pickable && interactive) {
      setSelected(square);
      onSelectionChange?.(square);
    } else {
      setSelected(null);
      onSelectionChange?.(null);
    }
  };

  const handleSquare = (square: string) => {
    if (!interactive) return;
    if (selected) {
      if (selected === square) {
        setSelected(null);
        onSelectionChange?.(null);
        return;
      }
      if (targets.has(square)) {
        onMove(selected, square);
        setSelected(null);
        onSelectionChange?.(null);
        return;
      }
    }
    select(square);
  };

  const tryDrop = (square: string) => {
    if (!dragFrom || dragFrom === square) {
      setDragFrom(null);
      return;
    }
    if (targets.has(square)) onMove(dragFrom, square);
    else select(square);
    setDragFrom(null);
    setSelected(null);
  };

  const moveFocus = (square: string, dFile: number, dRank: number) => {
    const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
    const rank = Number(square[1]) - 1;
    const nextFile = Math.min(7, Math.max(0, file + dFile));
    const nextRank = Math.min(7, Math.max(0, rank + dRank));
    const next = `${FILES[nextFile]}${nextRank + 1}`;
    setFocused(next);
    const el = document.getElementById(`sq-${next}`);
    el?.focus();
  };

  const arrow = useMemo(() => {
    if (!bestMove) return null;
    const center = (square: string) => {
      const file = FILES.indexOf(square[0] as (typeof FILES)[number]);
      const rank = Number(square[1]) - 1;
      const x = orientation === 'w' ? file : 7 - file;
      const y = orientation === 'w' ? 7 - rank : rank;
      return [x + 0.5, y + 0.5] as const;
    };
    const [x1, y1] = center(bestMove.from);
    const [x2, y2] = center(bestMove.to);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const startX = x1 + ux * 0.34;
    const startY = y1 + uy * 0.34;
    const tipX = x2 - ux * 0.16;
    const tipY = y2 - uy * 0.16;
    const head = 0.42;
    const halfWidth = 0.24;
    const baseX = tipX - ux * head;
    const baseY = tipY - uy * head;
    const perpX = -uy;
    const perpY = ux;
    const points = `${tipX},${tipY} ${baseX + perpX * halfWidth},${baseY + perpY * halfWidth} ${baseX - perpX * halfWidth},${baseY - perpY * halfWidth}`;
    return { startX, startY, endX: baseX, endY: baseY, points };
  }, [bestMove, orientation]);

  return (
    <div
      className={cx(
        'board-frame relative w-full overflow-hidden rounded-xl ring-1 ring-black/20 dark:ring-white/10',
        THEME_CLASS[theme],
        className,
      )}
      role="group"
      aria-label={`Chessboard, ${orientation === 'w' ? 'White' : 'Black'} at the bottom. ${turn === 'w' ? 'White' : 'Black'} to move.`}
    >
      <div className="grid aspect-square w-full grid-cols-8 grid-rows-8">
        {rankOrder.map((rank) =>
          fileOrder.map((file) => {
            const square = `${FILES[file]}${rank + 1}` as Square;
            const piece = pieces.get(square);
            const light = squareIsLight(file, rank);
            const isSelected = selected === square;
            const isTarget = targets.has(square);
            const isCapture = targets.get(square) === true;
            const isLast = lastMove && (lastMove.from === square || lastMove.to === square);
            const isCheck = checkSquare === square;
            const isBest = bestMove && (bestMove.from === square || bestMove.to === square);
            const canPick =
              interactive && piece && piece.color === turn && piece.color === pickable;
            const label = [
              square,
              piece ? `${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAME[piece.type]}` : 'empty',
              isSelected ? 'selected' : '',
              isTarget ? 'legal move' : '',
              isCheck ? 'king in check' : '',
            ]
              .filter(Boolean)
              .join(', ');

            return (
              <button
                key={square}
                id={`sq-${square}`}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                tabIndex={focused === square ? 0 : -1}
                draggable={Boolean(canPick)}
                onFocus={() => setFocused(square)}
                onClick={() => handleSquare(square)}
                onKeyDown={(event) => {
                  const deltas: Record<string, [number, number]> = {
                    ArrowLeft: [-1, 0],
                    ArrowRight: [1, 0],
                    ArrowUp: [0, 1],
                    ArrowDown: [0, -1],
                  };
                  const delta = deltas[event.key];
                  if (delta) {
                    event.preventDefault();
                    moveFocus(square, delta[0], delta[1]);
                  } else if (event.key === 'Escape') {
                    setSelected(null);
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleSquare(square);
                  }
                }}
                onDragStart={(event) => {
                  if (!canPick) {
                    event.preventDefault();
                    return;
                  }
                  setSelected(square);
                  setDragFrom(square);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', square);
                }}
                onDragOver={(event) => {
                  if (dragFrom) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  tryDrop(square);
                }}
                onDragEnd={() => setDragFrom(null)}
                className={cx(
                  'relative flex touch-manipulation items-center justify-center overflow-hidden',
                  light ? 'square-light' : 'square-dark',
                  canPick ? 'cursor-grab active:cursor-grabbing' : interactive ? 'cursor-pointer' : 'cursor-default',
                )}
              >
                {isLast && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[1] bg-amber-300/45 dark:bg-amber-300/30"
                  />
                )}
                {isSelected && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[2] bg-emerald-400/45 dark:bg-emerald-300/30"
                  />
                )}
                {isCheck && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-[2]"
                    style={{
                      background:
                        'radial-gradient(circle at 50% 50%, rgba(244,63,94,0.85) 0%, rgba(244,63,94,0.45) 45%, rgba(244,63,94,0) 72%)',
                    }}
                  />
                )}
                {isBest && !isSelected && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[3px] z-[2] rounded-[3px] border-[2.5px] border-emerald-500/80 dark:border-emerald-300/70"
                  />
                )}
                {isTarget && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'pointer-events-none absolute z-[3]',
                      isCapture
                        ? 'inset-[6%] rounded-full border-[5px] border-slate-900/25 dark:border-slate-950/35'
                        : 'left-1/2 top-1/2 h-[24%] w-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/25 dark:bg-slate-950/35',
                    )}
                  />
                )}
                {piece && (
                  <span
                    className={cx(
                      'pointer-events-none relative z-10 h-full w-full p-[5.5%]',
                      dragFrom === square && 'opacity-40',
                    )}
                  >
                    <Piece piece={`${piece.color}${piece.type.toUpperCase()}`} />
                  </span>
                )}
                {showCoordinates && rank === (orientation === 'w' ? 0 : 7) && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'pointer-events-none absolute right-[3px] bottom-[1px] z-20 text-[9px] font-bold leading-none sm:text-[10px]',
                      light ? 'text-amber-950/45' : 'text-amber-50/60',
                    )}
                  >
                    {FILES[file]}
                  </span>
                )}
                {showCoordinates && file === (orientation === 'w' ? 0 : 7) && (
                  <span
                    aria-hidden="true"
                    className={cx(
                      'pointer-events-none absolute left-[3px] top-[2px] z-20 text-[9px] font-bold leading-none sm:text-[10px]',
                      light ? 'text-amber-950/45' : 'text-amber-50/60',
                    )}
                  >
                    {rank + 1}
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>
      {arrow && (
        <svg
          viewBox="0 0 8 8"
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          aria-hidden="true"
        >
          <line
            x1={arrow.startX}
            y1={arrow.startY}
            x2={arrow.endX}
            y2={arrow.endY}
            stroke="rgb(16 185 129)"
            strokeWidth={0.16}
            strokeLinecap="round"
            opacity={0.85}
          />
          <polygon points={arrow.points} fill="rgb(16 185 129)" opacity={0.9} />
        </svg>
      )}
    </div>
  );
}
