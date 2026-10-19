import type { EngineScore } from '../engine/protocol';
import type { Color } from '../types';

/** 65_000 -> "1:05", 9_400 -> "9.4" (below 20s tenths are shown). */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 20_000) {
    const seconds = clamped / 1000;
    return seconds.toFixed(1);
  }
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/** Numeric score in centipawns from White's point of view (mate mapped to ±10000). */
export function whitePovCp(score: EngineScore | undefined, turn: Color): number | null {
  if (!score) return null;
  const mateValue = (n: number) => (n > 0 ? 10_000 - n * 10 : -10_000 - n * 10);
  const raw = score.type === 'mate' ? mateValue(score.value) : score.value;
  return turn === 'w' ? raw : -raw;
}

/** Human label from White's point of view, e.g. "+0.42", "−1.10", "+M5". */
export function evalLabel(score: EngineScore | undefined, turn: Color): string {
  if (!score) return '—';
  const sign = (value: number) => (value > 0 ? '+' : value < 0 ? '−' : '');
  if (score.type === 'mate') {
    const n = Math.abs(score.value);
    const whiteMates = (score.value > 0 && turn === 'w') || (score.value < 0 && turn === 'b');
    return `${whiteMates ? '+' : '−'}M${n}`;
  }
  const cp = turn === 'w' ? score.value : -score.value;
  const abs = Math.abs(cp);
  if (cp === 0) return '0.00';
  return `${sign(cp)}${(abs / 100).toFixed(abs >= 1000 ? 0 : 2)}`;
}

/** Bar fill fraction (0..1) for White, using a smooth sigmoid. */
export function whiteBarFraction(cp: number | null): number {
  if (cp === null) return 0.5;
  const clamped = Math.max(-1200, Math.min(1200, cp));
  return 1 / (1 + Math.exp(-clamped / 320));
}

export function materialText(diff: number): string {
  if (diff === 0) return '0';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function ordinal(n: number): string {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}
