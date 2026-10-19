import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineClient } from './client';
import type { EngineLine } from './protocol';

export type AnalysisStatus = 'idle' | 'thinking' | 'done' | 'cancelled' | 'error';

export interface AnalysisState {
  status: AnalysisStatus;
  lines: EngineLine[];
  depth: number;
  bestMove: string | null;
  ponder?: string;
  elapsedMs: number;
  error: string | null;
  deep: boolean;
  analysedFen: string | null;
  progress: boolean;
}

const EMPTY: AnalysisState = {
  status: 'idle',
  lines: [],
  depth: 0,
  bestMove: null,
  elapsedMs: 0,
  error: null,
  deep: false,
  analysedFen: null,
  progress: false,
};

export interface AnalysisOptions {
  client: EngineClient | null;
  ready: boolean;
  fen: string;
  enabled: boolean;
  auto: boolean;
  movetimeMs: number;
  multiPv: number;
}

/**
 * Runs (and automatically cancels) Stockfish searches for the current FEN.
 * Every cleanup bumps a run id so late messages from an obsolete search can
 * never overwrite the UI.
 */
export function useAnalysis({ client, ready, fen, enabled, auto, movetimeMs, multiPv }: AnalysisOptions) {
  const [state, setState] = useState<AnalysisState>(EMPTY);
  const [nonce, setNonce] = useState(0);
  const [requestedFor, setRequestedFor] = useState<string | null>(null);
  const [deep, setDeep] = useState(false);
  const runRef = useRef(0);

  useEffect(() => {
    setDeep(false);
  }, [fen]);

  const shouldRun = enabled && Boolean(fen) && (auto || requestedFor === fen);

  useEffect(() => {
    if (!client || !ready || !shouldRun) {
      setState((previous) => (previous.status === 'idle' ? previous : { ...EMPTY }));
      return;
    }
    const id = ++runRef.current;
    let disposed = false;
    const duration = deep ? Math.max(8_000, movetimeMs * 4) : movetimeMs;
    setState({
      ...EMPTY,
      status: 'thinking',
      deep,
      analysedFen: fen,
      progress: true,
    });

    const timer = window.setTimeout(() => {
      client
        .analyze({ fen, movetimeMs: duration, multiPv }, (progress) => {
          if (disposed || id !== runRef.current) return;
          setState((previous) => ({
            ...previous,
            status: 'thinking',
            progress: true,
            lines: progress.lines,
            depth: progress.depth,
            bestMove: progress.bestMove,
            elapsedMs: progress.elapsedMs,
          }));
        })
        .then((result) => {
          if (disposed || id !== runRef.current) return;
          setState({
            status: result.cancelled ? 'cancelled' : 'done',
            lines: result.lines,
            depth: result.depth,
            bestMove: result.bestMove,
            ponder: result.ponder,
            elapsedMs: result.elapsedMs,
            error: null,
            deep,
            analysedFen: fen,
            progress: false,
          });
        })
        .catch((error: unknown) => {
          if (disposed || id !== runRef.current) return;
          const message = error instanceof Error ? error.message : 'Engine error';
          setState({ ...EMPTY, status: 'error', error: message, deep, analysedFen: fen });
        });
    }, 160);

    return () => {
      disposed = true;
      runRef.current += 1;
      window.clearTimeout(timer);
      client.stop();
    };
  }, [client, ready, shouldRun, fen, movetimeMs, multiPv, deep, nonce]);

  const recalculate = useCallback(() => {
    setRequestedFor(fen);
    setNonce((n) => n + 1);
  }, [fen]);

  const analyseDeeper = useCallback(() => {
    setDeep(true);
    setRequestedFor(fen);
    setNonce((n) => n + 1);
  }, [fen]);

  return { ...state, shouldRun, recalculate, analyseDeeper };
}
