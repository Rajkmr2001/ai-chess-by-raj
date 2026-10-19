/** Shared domain types for Chess AI Arena. */

export type Color = 'w' | 'b';
export type GamePhase = 'setup' | 'live' | 'finished';
export type Actor = 'me' | 'opponent';
export type BoardTheme = 'classic' | 'green' | 'ocean';

export const TIME_CONTROLS = [1, 3, 5, 10, 20, 30] as const;
export type TimeControlMinutes = (typeof TIME_CONTROLS)[number];

export interface MoveRecord {
  /** 1-based ply index within the recorded history. */
  ply: number;
  color: Color;
  moveNumber: number;
  actor: Actor;
  san: string;
  uci: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
  fenBefore: string;
  fenAfter: string;
  /** Clock values (ms) immediately AFTER this move was recorded. */
  clockW: number;
  clockB: number;
  /** Wall-clock timestamp when the move was recorded. */
  at: number;
}

export type ResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient-material'
  | 'threefold-repetition'
  | 'fifty-move'
  | 'draw'
  | 'timeout'
  | 'resignation'
  | 'imported';

export interface GameResult {
  winner: Color | 'draw';
  reason: ResultReason;
  detail: string;
}

export interface GameConfig {
  playerColor: Color;
  minutes: TimeControlMinutes;
}

export interface GameState {
  phase: GamePhase;
  config: GameConfig;
  /** FEN of the position the recorded history starts from. */
  baseFen: string;
  history: MoveRecord[];
  redoStack: MoveRecord[];
  /** Number of moves from `history` currently displayed (0..history.length). */
  viewPly: number;
  clocks: { w: number; b: number };
  clockEnabled: boolean;
  paused: boolean;
  lastTickAt: number | null;
  startedAt: number | null;
  endedAt: number | null;
  result: GameResult | null;
  flagged: Color | null;
  /** Board view orientation flipped relative to the player's color. */
  flipped: boolean;
  /** Engine search in progress — used by the optional "pause while analyzing" setting. */
  analysisHold: boolean;
  pauseWhileAnalyzing: boolean;
  /** Set when a move ends the game, so the summary opens once (not on redo). */
  endSummary: boolean;
  notice: { kind: 'info' | 'error' | 'success'; text: string; id: number } | null;
}

export interface Settings {
  theme: 'dark' | 'light';
  boardTheme: BoardTheme;
  analysisMs: number;
  multiPv: number;
  hashMb: number;
  autoAnalyze: boolean;
  showArrow: boolean;
  pauseWhileAnalyzing: boolean;
  showCoordinates: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  boardTheme: 'classic',
  analysisMs: 1500,
  multiPv: 3,
  hashMb: 32,
  autoAnalyze: true,
  showArrow: true,
  pauseWhileAnalyzing: false,
  showCoordinates: true,
};

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const PIECE_SYMBOL: Record<string, string> = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
};

export const PIECE_NAME: Record<string, string> = {
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
};
