import { useCallback, useEffect, useRef, useState } from 'react';
import { EngineClient, type EngineStatus } from '../engine/client';

export interface StockfishHandle {
  client: EngineClient | null;
  ensure: () => Promise<EngineClient | null>;
  status: EngineStatus;
  /** True once the worker has answered `uciok`/`readyok`. Stays true while searching. */
  booted: boolean;
  error: string | null;
  name: string;
}

/**
 * Owns exactly one Stockfish worker for the lifetime of the app. The worker is
 * created lazily (the setup screen never pays for it) and terminated on unmount.
 */
export function useStockfish(): StockfishHandle {
  const clientRef = useRef<EngineClient | null>(null);
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('Stockfish');
  const [booted, setBooted] = useState(false);

  const ensure = useCallback(async () => {
    if (!clientRef.current) {
      clientRef.current = new EngineClient((next, detail) => {
        setStatus(next);
        if (next === 'error') setError(detail ?? 'The engine reported an error.');
        if (next === 'starting') setError(null);
      });
    }
    const client = clientRef.current;
    try {
      const engineName = await client.start();
      setName(engineName);
      setBooted(true);
      setStatus(client.status);
      return client;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not start Stockfish.';
      setError(message);
      return null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clientRef.current?.destroy();
      clientRef.current = null;
    };
  }, []);

  return { client: clientRef.current, ensure, status, booted, error, name };
}
