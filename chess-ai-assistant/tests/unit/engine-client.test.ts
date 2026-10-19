import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineClient, EngineError } from '../../src/engine/client';

/**
 * A deterministic stand-in for the Stockfish worker. It speaks just enough UCI
 * to exercise the full client: handshake, search progress, bestmove and stop.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static mode: 'ok' | 'silent' | 'error' = 'ok';

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  received: string[] = [];
  terminated = false;
  private bestMoveSent = false;
  get sentBestMove() {
    return this.bestMoveSent;
  }

  constructor(public url: string | URL) {
    FakeWorker.instances.push(this);
    setTimeout(() => {
      if (FakeWorker.mode === 'silent') return;
      if (FakeWorker.mode === 'error') {
        this.emit("Stockfish failed to load the WebAssembly module.");
        return;
      }
      // Stockfish announces itself, then answers uci/isready.
      this.emit('id name Stockfish 19 Lite');
      this.emit('option name Hash type spin default 16 min 1 max 33554432');
      this.emit('option name Threads type spin default 1 min 1 max 1024');
    }, 0);
  }

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  postMessage(command: string) {
    this.received.push(command);
    if (FakeWorker.mode !== 'ok') return;
    if (command === 'uci') setTimeout(() => this.emit('uciok'), 0);
    if (command === 'isready') setTimeout(() => this.emit('readyok'), 0);
    if (command.startsWith('go')) {
      this.emit('info depth 8 multipv 1 score cp 25 pv e2e4 e7e5 g1f3');
      this.searchTimer = setTimeout(() => {
        this.emit('info depth 12 multipv 1 score cp 31 time 120 pv e2e4 e7e5 g1f3 b8c6');
        this.emit('info depth 12 multipv 2 score cp 18 time 120 pv d2d4 d7d5');
        this.finish();
      }, 150);
    }
    if (command === 'stop' && this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
      this.finish();
    }
  }

  private finish() {
    this.searchTimer = null;
    this.bestMoveSent = true;
    this.emit('bestmove e2e4 ponder e7e5');
  }

  addEventListener() {
    /* not used */
  }

  emit(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  terminate() {
    this.terminated = true;
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.mode = 'ok';
  vi.stubGlobal('Worker', FakeWorker as unknown as typeof Worker);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EngineClient', () => {
  it('boots, applies options and reports readiness', async () => {
    const statuses: string[] = [];
    const client = new EngineClient((status) => statuses.push(status));
    const name = await client.start();
    expect(name).toBe('Stockfish 19 Lite');
    expect(client.status).toBe('ready');
    expect(statuses).toContain('starting');
    expect(statuses).toContain('ready');
    expect(FakeWorker.instances[0].received).toContain('uci');
    expect(client.supportedOptions.map((option) => option.name)).toContain('Hash');
    client.setOptions({ hashMb: 64 });
    expect(FakeWorker.instances[0].received).toContain('setoption name Hash value 64');
    client.destroy();
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });

  it('returns MultiPV lines and the best move for a position', async () => {
    const client = new EngineClient();
    await client.start();
    const progress: number[] = [];
    const result = await client.analyze(
      { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', movetimeMs: 100, multiPv: 2 },
      (update) => progress.push(update.depth),
    );
    expect(result.bestMove).toBe('e2e4');
    expect(result.depth).toBe(12);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].score).toEqual({ type: 'cp', value: 31 });
    expect(result.cancelled).toBe(false);
    expect(progress.length).toBeGreaterThan(0);
    const worker = FakeWorker.instances[0];
    expect(worker.received).toContain('position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(worker.received.some((command) => command.startsWith('go movetime'))).toBe(true);
    client.destroy();
  });

  it('marks a stopped search as cancelled without hanging', async () => {
    const client = new EngineClient();
    await client.start();
    const pending = client.analyze(
      { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', movetimeMs: 5000, multiPv: 1 },
    );
    setTimeout(() => client.stop(), 10);
    const result = await pending;
    expect(result.cancelled).toBe(true);
    expect(FakeWorker.instances[0].received).toContain('stop');
    client.destroy();
  });

  it('rejects with a clear error when the engine never answers', async () => {
    FakeWorker.mode = 'silent';
    const client = new EngineClient(undefined, { uciTimeoutMs: 60, readyTimeoutMs: 60 });
    await expect(client.start()).rejects.toBeInstanceOf(EngineError);
    expect(client.status).toBe('error');
    expect(client.lastError).toBeTruthy();
    client.destroy();
  });

  it('surfaces engine-reported failures', async () => {
    FakeWorker.mode = 'error';
    const client = new EngineClient(undefined, { uciTimeoutMs: 400, readyTimeoutMs: 400 });
    await expect(client.start()).rejects.toBeInstanceOf(EngineError);
    expect(client.status).toBe('error');
    client.destroy();
  });
});
