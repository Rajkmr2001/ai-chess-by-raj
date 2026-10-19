import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { PIECE_NAME } from '../types';
import { pvToSan, tryMove } from './chess';

export interface TacticalNote {
  kind: 'check' | 'capture' | 'hanging' | 'threat' | 'promotion' | 'defense';
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

const PIECE_WORD: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

/**
 * Position facts derived from the current FEN only (no speculation):
 * checks available, captures, hanging pieces and promotions.
 */
export function tacticalNotes(fen: string, limit = 6): TacticalNote[] {
  const game = new Chess(fen);
  const notes: TacticalNote[] = [];
  const turn = game.turn();
  const myColor = turn;
  const theirColor: 'w' | 'b' = turn === 'w' ? 'b' : 'w';
  const legal = game.moves({ verbose: true });

  if (game.isCheck()) {
    notes.push({ kind: 'check', text: 'You are in check — only legal replies are shown.', tone: 'bad' });
  }

  const checks = legal.filter((m) => m.san.includes('+') || m.san.includes('#'));
  if (checks.length) {
    notes.push({
      kind: 'check',
      text: `Checking moves available: ${checks.slice(0, 3).map((m) => m.san).join(', ')}.`,
      tone: 'good',
    });
  }

  const promotions = legal.filter((m) => m.promotion);
  if (promotions.length) {
    notes.push({
      kind: 'promotion',
      text: `Promotion available: ${[...new Set(promotions.map((m) => m.san.replace(/[+#]/g, '')))].slice(0, 3).join(', ')}.`,
      tone: 'good',
    });
  }

  // Hanging pieces: attacked, undefended, and not defended by the king's value.
  const hanging: { color: 'w' | 'b'; square: Square; type: string }[] = [];
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue;
      const square = piece.square;
      const attackers = game.attackers(square, piece.color === 'w' ? 'b' : 'w');
      if (!attackers.length) continue;
      const defenders = game.attackers(square, piece.color);
      if (!defenders.length) {
        hanging.push({ color: piece.color, square, type: piece.type });
      }
    }
  }

  const myHanging = hanging.filter((h) => h.color === myColor);
  const theirHanging = hanging.filter((h) => h.color === theirColor);
  if (theirHanging.length) {
    const list = theirHanging
      .slice(0, 3)
      .map((h) => `${PIECE_WORD[h.type]} on ${h.square}`)
      .join(', ');
    notes.push({ kind: 'hanging', text: `Undefended opponent piece${theirHanging.length > 1 ? 's' : ''}: ${list}.`, tone: 'good' });
  }
  if (myHanging.length) {
    const list = myHanging
      .slice(0, 3)
      .map((h) => `${PIECE_WORD[h.type]} on ${h.square}`)
      .join(', ');
    notes.push({ kind: 'hanging', text: `Your undefended piece${myHanging.length > 1 ? 's' : ''} under attack: ${list}.`, tone: 'bad' });
  }

  const captures = legal.filter((m) => m.captured);
  if (captures.length && !theirHanging.length) {
    const best = captures
      .slice()
      .sort((a, b) => valueOf(b.captured) - valueOf(a.captured))[0];
    notes.push({
      kind: 'capture',
      text: `Capture available: ${best.san} (${PIECE_NAME[best.captured ?? 'p']} on ${best.to}).`,
      tone: 'neutral',
    });
  }

  return notes.slice(0, limit);
}

function valueOf(type?: string): number {
  return { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }[type ?? 'p'] ?? 0;
}

/** One-sentence description of a move, e.g. "Knight g1 → f3, attacking e5". */
export function describeMove(fenBefore: string, uci: string): string {
  const game = new Chess(fenBefore);
  const move = tryMove(game, {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  });
  if (!move) return '';
  if (move.san.startsWith('O-O-O')) return 'Castles queenside, tucking the king to safety.';
  if (move.san.startsWith('O-O')) return 'Castles kingside, tucking the king to safety.';
  const piece = PIECE_WORD[move.piece] ?? 'piece';
  const parts: string[] = [`${capitalise(piece)} ${move.from} → ${move.to}`];
  if (move.captured) parts.push(`captures the ${PIECE_WORD[move.captured]}`);
  if (move.promotion) parts.push(`promotes to a ${PIECE_WORD[move.promotion]}`);
  const suffix = game.isCheckmate() ? ' — checkmate' : game.isCheck() ? ' — giving check' : '';
  return `${parts.join(', ')}${suffix}.`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Short SAN preview of the principal variation. */
export function pvPreview(fen: string, pv: string[], limit = 8): string {
  return pvToSan(fen, pv, limit).join(' ');
}
