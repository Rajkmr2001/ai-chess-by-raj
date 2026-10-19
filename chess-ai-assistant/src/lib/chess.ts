import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import type { Color, GameResult, MoveRecord, Actor } from '../types';

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export function squareName(fileIndex: number, rankIndex: number): string {
  return `${FILES[fileIndex]}${RANKS[rankIndex]}`;
}

/** Build the Chess instance for `ply` moves into the recorded game. */
export function chessAt(baseFen: string, history: MoveRecord[], ply = history.length): Chess {
  const fen = ply <= 0 ? baseFen : history[ply - 1].fenAfter;
  try {
    return new Chess(fen);
  } catch {
    return new Chess(baseFen);
  }
}

/** Never throws: falls back to the initial position if a FEN is malformed. */
export function safeChess(fen: string): Chess {
  try {
    return new Chess(fen);
  } catch {
    return new Chess();
  }
}

export function moveNumberAt(fen: string): number {
  const parts = fen.split(' ');
  const n = Number.parseInt(parts[5] ?? '1', 10);
  return Number.isFinite(n) ? n : 1;
}

export function turnAt(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'b' : 'w';
}

/** Apply a move to a game, returning null instead of throwing. */
export function tryMove(
  game: Chess,
  move: { from: string; to: string; promotion?: string } | string,
): Move | null {
  try {
    return game.move(move as never);
  } catch {
    return null;
  }
}

export function uciOf(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

export function sanOfUci(fen: string, uci: string): string | null {
  const game = new Chess(fen);
  const move = tryMove(game, {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  });
  return move ? move.san : null;
}

/** Convert a UCI principal variation into SAN, stopping at the first illegal move. */
export function pvToSan(fen: string, pv: string[], limit = 10): string[] {
  const game = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, limit)) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) break;
    const move = tryMove(game, {
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });
    if (!move) break;
    out.push(move.san);
  }
  return out;
}

export interface ParsedMove {
  ok: true;
  move: Move;
  notation: 'san' | 'uci';
}
export interface ParseFailure {
  ok: false;
  error: string;
  suggestions: string[];
}

function cleanInput(raw: string): string {
  let s = raw.trim();
  // Strip a leading move number only when it is followed by a period, so that
  // castling typed as "0-0" is not mistaken for a move number.
  s = s.replace(/^\d+\s*\.+\s*/, '');
  // Normalise annotation glyphs, drops "e.p." and converts castling zeroes.
  s = s.replace(/[!?]+/g, '');
  s = s.replace(/\s+/g, '');
  s = s.replace(/e\.?p\.?$/i, '');
  s = s.replace(/0/g, 'O');
  return s;
}

const NORMALISE = (san: string) => san.replace(/[+#!?]+$/g, '');

/**
 * Parse human move input. Accepts SAN, a forgiving SAN variant (missing
 * disambiguation, lowercase piece letters, `e8Q`) and UCI (`e2e4`, `e7e8q`).
 */
export function parseMoveInput(raw: string, game: Chess): ParsedMove | ParseFailure {
  const input = cleanInput(raw);
  if (!input) {
    return { ok: false, error: 'Enter a move, for example e4, Nf3 or e2e4.', suggestions: [] };
  }

  const legal = game.moves({ verbose: true });
  const legalSans = legal.map((m) => m.san);
  const turn = game.turn();
  const side = turn === 'w' ? 'White' : 'Black';

  // 1. UCI (with or without a dash, with optional promotion piece).
  const uciMatch = input.match(/^([a-h][1-8])-?([a-h][1-8])([qrbnQRBN])?$/);
  if (uciMatch) {
    const move = tryMove(game, {
      from: uciMatch[1],
      to: uciMatch[2],
      promotion: uciMatch[3]?.toLowerCase(),
    });
    if (move) return { ok: true, move, notation: 'uci' };
    // Allow "e7e8" without a promotion piece -> default to queen.
    const isPromotion = legal.some(
      (m) => m.from === uciMatch[1] && m.to === uciMatch[2] && m.promotion,
    );
    if (isPromotion && !uciMatch[3]) {
      const queen = tryMove(game, { from: uciMatch[1], to: uciMatch[2], promotion: 'q' });
      if (queen) return { ok: true, move: queen, notation: 'uci' };
    }
    return {
      ok: false,
      error: `${input.toUpperCase()} is not a legal ${side} move in this position.`,
      suggestions: suggestionsFor(input, legalSans),
    };
  }

  // 2. Exact SAN (case sensitive, chess.js handles the details).
  const exact = legal.find((m) => NORMALISE(m.san) === NORMALISE(input));
  if (exact) return { ok: true, move: exact, notation: 'san' };

  // 3. Forgiving SAN: ignore case, allow missing disambiguation and "=" in promotions.
  const target = NORMALISE(input)
    .replace(/=/, '')
    .replace(/x/g, 'x')
    .toUpperCase()
    .replace(/O-O-O/, 'O-O-O')
    .replace(/O-O/, 'O-O');

  const deflate = (san: string) =>
    NORMALISE(san)
      .replace(/=/, '')
      .replace(/^([KQRBN])[a-h1-8]x/, '$1x')
      .replace(/^([KQRBN])[a-h1-8](?=[a-h][1-8])/, '$1')
      .toUpperCase();

  const loose = legal.filter((m) => {
    const a = deflate(m.san);
    const b = target;
    if (a === b) return true;
    // "e8Q" == "e8=Q"
    if (/^[a-h][18][QRBN]$/.test(b) && NORMALISE(m.san).toUpperCase() === b) return true;
    return false;
  });

  if (loose.length === 1) return { ok: true, move: loose[0], notation: 'san' };

  if (loose.length > 1) {
    const options = loose.map((m) => m.san).join(', ');
    return {
      ok: false,
      error: `“${raw.trim()}” is ambiguous. Disambiguate with the starting file or rank: ${options}.`,
      suggestions: loose.map((m) => m.san),
    };
  }

  // 4. Things that look like a move for the wrong side get a clearer message.
  const otherSide = turn === 'w' ? 'Black' : 'White';
  const occupant = /^[a-h][1-8]$/.test(input) ? game.get(input as Square) : null;
  const looksLikeOtherSide = Boolean(occupant && occupant.color !== turn);

  return {
    ok: false,
    error: looksLikeOtherSide
      ? `That square holds a ${otherSide.toLowerCase()} piece, but it is ${side}'s turn.`
      : `“${raw.trim()}” is not a legal ${side} move here.`,
    suggestions: suggestionsFor(input, legalSans),
  };
}

function suggestionsFor(input: string, legalSans: string[]): string[] {
  const needle = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!needle) return legalSans.slice(0, 3);
  const scored = legalSans
    .map((san) => {
      const s = san.toUpperCase();
      let score = 0;
      if (s === needle) score = 100;
      else if (s.startsWith(needle.slice(0, 1))) score += 5;
      if (s.endsWith(needle.slice(-2))) score += 4;
      if (needle.length > 1 && s.includes(needle.slice(-2))) score += 2;
      return { san, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.san);
  return scored.length ? scored : legalSans.slice(0, 3);
}

/** Returns a canonical FEN, or null if the input is not a usable position. */
export function sanitiseFen(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  if (input.trim().split(/\s+/).length !== 6) return null;
  try {
    return new Chess(input.trim()).fen();
  } catch {
    return null;
  }
}

export type NotationMode = 'auto' | 'san' | 'uci';

const UCI_PATTERN = /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/;

/** Notation-aware wrapper around parseMoveInput. */
export function parseMoveWithMode(
  raw: string,
  game: Chess,
  mode: NotationMode,
): ParsedMove | ParseFailure {
  const candidate = raw.trim();
  if (mode === 'uci' && !UCI_PATTERN.test(candidate.replace(/\s+/g, ''))) {
    return {
      ok: false,
      error: 'UCI moves look like e2e4 (or e7e8q for promotion). Switch to Auto/SAN for e4 and Nf3.',
      suggestions: [],
    };
  }
  if (mode === 'san' && UCI_PATTERN.test(candidate.replace(/\s+/g, '')) && candidate.length > 3) {
    return {
      ok: false,
      error: 'That looks like UCI notation. Switch the format to UCI to use e2e4, or type e4/Nf3 for SAN.',
      suggestions: [],
    };
  }
  return parseMoveInput(raw, game);
}

export function makeRecord(
  move: Move,
  actor: Actor,
  ply: number,
  clocks: { w: number; b: number },
  at: number,
): MoveRecord {
  return {
    ply,
    color: move.color,
    moveNumber: moveNumberAt(move.before),
    actor,
    san: move.san,
    uci: uciOf(move),
    from: move.from,
    to: move.to,
    piece: move.piece,
    captured: move.captured,
    promotion: move.promotion,
    fenBefore: move.before,
    fenAfter: move.after,
    clockW: clocks.w,
    clockB: clocks.b,
    at,
  };
}

/* ------------------------------------------------------------------ */
/* Material                                                            */
/* ------------------------------------------------------------------ */

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const INITIAL_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

export interface MaterialSummary {
  whiteValue: number;
  blackValue: number;
  diff: number;
  /** Pieces captured BY White (i.e. missing black pieces), strongest first. */
  capturedByWhite: string[];
  capturedByBlack: string[];
  /** True when the position still contains a standard army on both sides. */
  standard: boolean;
}

export function materialSummary(fen: string): MaterialSummary {
  const game = new Chess(fen);
  const counts: Record<string, Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  };
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece) counts[piece.color][piece.type] += 1;
    }
  }
  let whiteValue = 0;
  let blackValue = 0;
  for (const type of Object.keys(VALUES)) {
    whiteValue += counts.w[type] * VALUES[type];
    blackValue += counts.b[type] * VALUES[type];
  }
  const sortStrongFirst = (types: string[]) =>
    types.sort((a, b) => VALUES[b] - VALUES[a] || a.localeCompare(b));

  const capturedByWhite: string[] = [];
  const capturedByBlack: string[] = [];
  for (const type of Object.keys(INITIAL_COUNTS)) {
    for (let i = 0; i < Math.max(0, INITIAL_COUNTS[type] - counts.b[type]); i++) {
      capturedByWhite.push(type);
    }
    for (let i = 0; i < Math.max(0, INITIAL_COUNTS[type] - counts.w[type]); i++) {
      capturedByBlack.push(type);
    }
  }
  const standard =
    whiteValue + blackValue === 78 && counts.w.k === 1 && counts.b.k === 1;

  return {
    whiteValue,
    blackValue,
    diff: whiteValue - blackValue,
    capturedByWhite: sortStrongFirst(capturedByWhite),
    capturedByBlack: sortStrongFirst(capturedByBlack),
    standard,
  };
}

/* ------------------------------------------------------------------ */
/* PGN                                                                 */
/* ------------------------------------------------------------------ */

export function resultToken(winner: Color | 'draw' | null): string {
  if (winner === null) return '*';
  if (winner === 'draw') return '1/2-1/2';
  return winner === 'w' ? '1-0' : '0-1';
}

export interface PgnInput {
  baseFen: string;
  history: MoveRecord[];
  playerColor: Color;
  minutes: number;
  result: GameResult | null;
}

export function buildPgn(input: PgnInput): string {
  const { baseFen, history, result } = input;
  const start = new Chess(baseFen);
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const headers: [string, string][] = [
    ['Event', 'Chess AI Arena practice game'],
    ['Site', 'Chess AI Arena (browser)'],
    ['Date', `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`],
    ['Round', '-'],
    ['White', input.playerColor === 'w' ? 'You' : 'Opponent'],
    ['Black', input.playerColor === 'b' ? 'You' : 'Opponent'],
    ['Result', resultToken(result?.winner ?? null)],
    ['TimeControl', `${Math.round(input.minutes * 60)}`],
  ];
  if (baseFen.split(' ')[0] !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') {
    headers.push(['SetUp', '1'], ['FEN', baseFen]);
  }

  const startTurn = start.turn();
  const startNumber = moveNumberAt(baseFen);
  const tokens: string[] = [];
  let number = startNumber;
  let turn = startTurn;
  for (const record of history) {
    if (turn === 'w') {
      tokens.push(`${number}.`);
    } else if (tokens.length === 0 || record.ply === 1) {
      tokens.push(`${number}...`);
    }
    tokens.push(record.san);
    if (turn === 'b') number += 1;
    turn = turn === 'w' ? 'b' : 'w';
  }
  const resultTokenStr = resultToken(result?.winner ?? null);
  if (resultTokenStr !== '*') tokens.push(resultTokenStr);

  const body = tokens.join(' ');
  return `${headers.map(([k, v]) => `[${k} "${v}"]`).join('\n')}\n\n${body}\n`;
}

export interface ImportedPgn {
  baseFen: string;
  history: MoveRecord[];
  resultHeader: string;
  headers: Record<string, string>;
}

export function parsePgn(pgn: string, playerColor: Color): ImportedPgn {
  const game = new Chess();
  game.loadPgn(pgn.trim());
  const headers = game.header() as Record<string, string>;
  const verbose = game.history({ verbose: true });
  const baseFen = headers.FEN && headers.SetUp === '1' ? headers.FEN : new Chess().fen();
  let clocks = { w: 0, b: 0 };
  const history: MoveRecord[] = verbose.map((move, index) => {
    const actor: Actor = move.color === playerColor ? 'me' : 'opponent';
    return makeRecord(move, actor, index + 1, clocks, 0);
  });
  return { baseFen, history, resultHeader: headers.Result ?? '*', headers };
}
