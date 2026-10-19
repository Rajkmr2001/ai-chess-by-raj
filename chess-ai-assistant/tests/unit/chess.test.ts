import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  buildPgn,
  materialSummary,
  parseMoveInput,
  parsePgn,
  pvToSan,
  parseMoveWithMode,
  sanitiseFen,
} from '../../src/lib/chess';
import type { MoveRecord } from '../../src/types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseMoveInput — SAN and UCI', () => {
  it('accepts plain SAN', () => {
    const result = parseMoveInput('e4', new Chess());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.move.san).toBe('e4');
  });

  it('accepts SAN captures and rejects illegal captures', () => {
    const capture = new Chess('rnbqkbnr/ppp2ppp/8/4p3/8/2B5/PPPP1PPP/RNBQK1NR w KQkq - 0 3');
    const good = parseMoveInput('Bxe5', capture);
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.move.san).toBe('Bxe5');
    const illegal = parseMoveInput('Bxh7', new Chess('rnbqkbnr/ppp2ppp/8/4p3/8/2B5/PPPP1PPP/RNBQK1NR w KQkq - 0 3'));
    expect(illegal.ok).toBe(false);
  });

  it('accepts UCI with promotion and maps to the right SAN', () => {
    const game = new Chess('8/P6k/8/8/8/8/8/7K w - - 0 1');
    const result = parseMoveInput('a7a8q', game);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.move.san).toBe('a8=Q');
  });

  it('defaults a promotion UCI without a piece to queen', () => {
    const game = new Chess('8/P6k/8/8/8/8/8/7K w - - 0 1');
    const result = parseMoveInput('a7a8', game);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.move.promotion).toBe('q');
  });

  it('handles castling in both notations', () => {
    const short = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(parseMoveInput('O-O', short).ok).toBe(true);
    const long = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(parseMoveInput('0-0-0', long).ok).toBe(true);
    const uci = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const moved = parseMoveInput('e1g1', uci);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(moved.move.san).toBe('O-O');
  });

  it('rejects illegal moves with a helpful message', () => {
    const result = parseMoveInput('e5', new Chess());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not a legal White move/i);
    }
  });

  it('explains when a square holds the wrong colour', () => {
    const result = parseMoveInput('e7', new Chess());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/black piece/i);
  });

  it('asks for disambiguation when two pieces can reach a square', () => {
    const game = new Chess('rnbqkbnr/ppp1pppp/8/8/8/5N2/PPP1PPPP/RNBQKB1R w KQkq - 0 3');
    const ambiguous = parseMoveInput('Nd2', game);
    expect(ambiguous.ok).toBe(false);
    if (!ambiguous.ok) {
      expect(ambiguous.error).toMatch(/ambiguous/i);
      expect(ambiguous.suggestions).toContain('Nfd2');
      expect(ambiguous.suggestions).toContain('Nbd2');
    }
    expect(parseMoveInput('Nfd2', game).ok).toBe(true);
  });

  it('tolerates move numbers, annotations and lower-case piece letters', () => {
    const game = new Chess();
    expect(parseMoveInput('1. e4!', game).ok).toBe(true);
    const afterE4 = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    expect(parseMoveInput('1...e5', afterE4).ok).toBe(true);
    expect(parseMoveInput('nf3', new Chess()).ok).toBe(true);
  });

  it('enforces the selected notation mode', () => {
    const game = new Chess();
    const asUci = parseMoveWithMode('Nf3', game, 'uci');
    expect(asUci.ok).toBe(false);
    const asSan = parseMoveWithMode('e2e4', game, 'san');
    expect(asSan.ok).toBe(false);
    expect(parseMoveWithMode('e2e4', new Chess(), 'uci').ok).toBe(true);
    expect(parseMoveWithMode('e4', new Chess(), 'auto').ok).toBe(true);
  });

  it('rejects empty input', () => {
    const result = parseMoveInput('   ', new Chess());
    expect(result.ok).toBe(false);
  });
});

describe('special rules', () => {
  it('supports en passant', () => {
    const game = new Chess('rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3');
    const result = parseMoveInput('exf6', game);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.move.flags).toContain('e');
      expect(result.move.after.split(' ')[0]).toBe('rnbqkbnr/ppp1p1pp/5P2/3p4/8/8/PPPP1PPP/RNBQKBNR');
    }
  });

  it('detects checkmate and stalemate from a FEN', () => {
    const mate = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
    expect(mate.isCheckmate()).toBe(true);
    const stalemate = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(stalemate.isStalemate()).toBe(true);
  });

  it('sanitises a FEN and rejects junk', () => {
    expect(sanitiseFen(START)).toBe(START);
    expect(sanitiseFen('not a fen')).toBeNull();
  });
});

describe('principal variation conversion', () => {
  it('converts UCI PV into SAN and stops at illegal moves', () => {
    const san = pvToSan(START, ['e2e4', 'e7e5', 'g1f3', 'zzzz'], 10);
    expect(san).toEqual(['e4', 'e5', 'Nf3']);
  });
});

describe('material summary', () => {
  it('reports equality on the starting position', () => {
    const material = materialSummary(START);
    expect(material.diff).toBe(0);
    expect(material.standard).toBe(true);
    expect(material.capturedByWhite).toHaveLength(0);
  });

  it('attributes captured pieces to the right side', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNB1KBNR w KQkq - 0 1';
    const material = materialSummary(fen);
    expect(material.diff).toBe(-9);
    expect(material.capturedByWhite).toEqual([]);
    expect(material.capturedByBlack).toEqual(['q']);
  });
});

function recordFromSanList(moves: string[], playerColor: 'w' | 'b'): MoveRecord[] {
  const game = new Chess();
  return moves.map((san, index) => {
    const move = game.move(san);
    const color = move.color;
    return {
      ply: index + 1,
      color,
      moveNumber: Number(move.before.split(' ')[5]),
      actor: color === playerColor ? 'me' : 'opponent',
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ''}`,
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      promotion: move.promotion,
      fenBefore: move.before,
      fenAfter: move.after,
      clockW: 0,
      clockB: 0,
      at: 0,
    };
  });
}

describe('PGN', () => {
  it('exports headers, numbering and result', () => {
    const history = recordFromSanList(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], 'w');
    const pgn = buildPgn({
      baseFen: START,
      history,
      playerColor: 'w',
      minutes: 5,
      result: { winner: 'w', reason: 'checkmate', detail: 'mate' },
    });
    expect(pgn).toContain('[White "You"]');
    expect(pgn).toContain('[Black "Opponent"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('[TimeControl "300"]');
    expect(pgn).toContain('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0');
    expect(pgn.startsWith('[Event ')).toBe(true);
  });

  it('round-trips through the importer', () => {
    const history = recordFromSanList(['d4', 'd5', 'c4'], 'b');
    const pgn = buildPgn({ baseFen: START, history, playerColor: 'b', minutes: 3, result: null });
    const imported = parsePgn(pgn, 'b');
    expect(imported.baseFen).toBe(START);
    expect(imported.history.map((h) => h.san)).toEqual(['d4', 'd5', 'c4']);
    expect(imported.history.map((h) => h.actor)).toEqual(['opponent', 'me', 'opponent']);
    expect(imported.history[2].fenAfter).toBe(history[2].fenAfter);
  });

  it('starts numbering from the FEN move number for positions joined mid-game', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const game = new Chess(fen);
    const move = game.move('e5');
    const history: MoveRecord[] = [
      {
        ply: 1,
        color: 'b',
        moveNumber: 1,
        actor: 'me',
        san: move.san,
        uci: 'e7e5',
        from: move.from,
        to: move.to,
        piece: move.piece,
        fenBefore: move.before,
        fenAfter: move.after,
        clockW: 0,
        clockB: 0,
        at: 0,
      },
    ];
    const pgn = buildPgn({ baseFen: fen, history, playerColor: 'b', minutes: 5, result: null });
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain('1... e5');
  });
});
