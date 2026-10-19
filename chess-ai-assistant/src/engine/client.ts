import { ENGINE_FILES } from './engineFiles';
import {
  parseBestMove,
  parseIdName,
  parseInfo,
  parseOption,
  type EngineLine,
  type EngineScore,
  type UciOption,
} from './protocol';

export type EngineStatus = 'idle' | 'starting' | 'ready' | 'thinking' | 'error';

export interface SearchRequest {
  fen: string;
  movetimeMs: number;
  multiPv: number;
  depth?: number;
}

export interface SearchProgress {
  lines: EngineLine[];
  depth: number;
  bestMove: string | null;
  elapsedMs: number;
}

export interface SearchResult {
  lines: EngineLine[];
  depth: number;
  seldepth?: number;
  bestMove: string | null;
  ponder?: string;
  elapsedMs: number;
  gameOver: boolean;
  cancelled: boolean;
  engineName: string;
}

interface Waiter {
  test: (line: string) => boolean;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  label: string;
}

interface ActiveSearch {
  id: number;
  lines: Map<number, EngineLine>;
  startedAt: number;
  cancelled: boolean;
  resolve: (result: SearchResult) => void;
  onProgress?: (progress: SearchProgress) => void;
  lastProgressAt: number;
  watchdog: ReturnType<typeof setTimeout> | null;
  multiPv: number;
}

export class EngineError extends Error {}

const ENGINE_FILE = ENGINE_FILES[0] ?? 'stockfish-19-lite-single.js';

export function engineUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}engine/${ENGINE_FILE}`;
}

export class EngineClient {
  private worker: Worker | null = null;
  private waiters: Waiter[] = [];
  private active: ActiveSearch | null = null;
  private searchSeq = 0;
  private startPromise: Promise<string> | null = null;
  private disposed = false;
  private options = new Map<string, UciOption>();
  private progressTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingProgress: SearchProgress | null = null;

  name = 'Stockfish';
  status: EngineStatus = 'idle';
  lastError: string | null = null;

  private readonly uciTimeoutMs: number;
  private readonly readyTimeoutMs: number;

  constructor(
    private readonly onStatus: (status: EngineStatus, detail?: string) => void = () => {},
    options: { uciTimeoutMs?: number; readyTimeoutMs?: number } = {},
  ) {
    this.uciTimeoutMs = options.uciTimeoutMs ?? 25_000;
    this.readyTimeoutMs = options.readyTimeoutMs ?? 20_000;
  }

  get engineName(): string {
    return this.name;
  }

  get supportedOptions(): UciOption[] {
    return [...this.options.values()];
  }

  /** Boot the worker (idempotent). Resolves with the engine name. */
  start(): Promise<string> {
    if (this.disposed) return Promise.reject(new EngineError('Engine has been disposed.'));
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.boot().catch((error: unknown) => {
      this.startPromise = null;
      throw error;
    });
    return this.startPromise;
  }

  private async boot(): Promise<string> {
    this.setStatus('starting');
    let worker: Worker;
    try {
      worker = new Worker(engineUrl());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start the engine worker';
      this.fail(message);
      throw new EngineError(message);
    }
    this.worker = worker;
    worker.onmessage = (event: MessageEvent) => this.handleMessage(event.data);
    worker.onerror = (event: ErrorEvent) => {
      const message = event.message || 'The engine worker crashed';
      this.fail(message);
    };

    this.post('uci');
    try {
      await this.waitFor((line) => line === 'uciok', this.uciTimeoutMs, 'uciok');
    } catch (error) {
      this.fail('Stockfish did not finish loading. The WebAssembly file may be blocked or missing.');
      throw error;
    }
    this.post('isready');
    await this.waitFor((line) => line === 'readyok', this.readyTimeoutMs, 'readyok');
    this.setStatus('ready');
    return this.name;
  }

  setOptions(options: { hashMb?: number; threads?: number }) {
    if (!this.worker) return;
    if (typeof options.hashMb === 'number' && this.hasOption('Hash')) {
      this.post(`setoption name Hash value ${Math.max(1, Math.round(options.hashMb))}`);
    }
    if (typeof options.threads === 'number' && this.hasOption('Threads')) {
      this.post(`setoption name Threads value ${Math.max(1, Math.round(options.threads))}`);
    }
  }

  private hasOption(name: string): boolean {
    if (!this.options.size) return true;
    return this.options.has(name);
  }

  async analyze(
    request: SearchRequest,
    onProgress?: (progress: SearchProgress) => void,
  ): Promise<SearchResult> {
    await this.start();
    if (this.active) await this.stopAndWait();

    const id = ++this.searchSeq;
    if (!this.worker) throw new EngineError('Engine worker is not available.');
    this.post(`setoption name MultiPV value ${Math.max(1, request.multiPv)}`);
    this.post(`position fen ${request.fen}`);

    const startedAt = performance.now();
    const result = new Promise<SearchResult>((resolve) => {
      this.active = {
        id,
        lines: new Map(),
        startedAt,
        cancelled: false,
        resolve,
        onProgress,
        lastProgressAt: 0,
        watchdog: null,
        multiPv: request.multiPv,
      };
    });
    this.setStatus('thinking');

    if (request.depth && request.depth > 0) {
      this.post(`go depth ${Math.round(request.depth)}`);
    } else {
      this.post(`go movetime ${Math.max(50, Math.round(request.movetimeMs))}`);
    }

    const search = this.active as ActiveSearch;
    const limit = (request.depth ? 60_000 : request.movetimeMs) + 15_000;
    search.watchdog = setTimeout(() => this.handleWatchdog(id, limit), limit);
    return result;
  }

  /** Ask the engine to stop. The pending analyze() promise resolves as cancelled. */
  stop() {
    if (!this.active) return;
    this.active.cancelled = true;
    this.post('stop');
  }

  private async stopAndWait() {
    if (!this.active) return;
    const current = this.active;
    this.stop();
    const finished = await Promise.race([
      this.waitUntilIdle(800),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 850)),
    ]);
    if (!finished && this.active?.id === current.id) {
      // The engine ignored "stop"; abandon this search so the UI cannot hang.
      clearTimeout(current.watchdog ?? undefined);
      this.active = null;
      this.emitResult(current);
      this.setStatus('ready');
    }
  }

  private waitUntilIdle(timeoutMs: number): Promise<boolean> {
    const deadline = performance.now() + timeoutMs;
    return new Promise((resolve) => {
      const poll = () => {
        if (!this.active) resolve(true);
        else if (performance.now() > deadline) resolve(false);
        else setTimeout(poll, 25);
      };
      poll();
    });
  }

  private handleWatchdog(id: number, limit: number) {
    if (!this.active || this.active.id !== id) return;
    this.active.cancelled = true;
    this.post('stop');
    setTimeout(() => {
      if (this.active?.id === id) {
        const search = this.active;
        clearTimeout(search.watchdog ?? undefined);
        this.active = null;
        this.emitResult(search, `The engine exceeded its ${(limit / 1000).toFixed(0)}s search limit.`);
        this.setStatus('ready');
      }
    }, 600);
  }

  private emitResult(search: ActiveSearch, error?: string) {
    const lines = [...search.lines.values()].sort((a, b) => a.multipv - b.multipv);
    const depth = lines.reduce((max, line) => Math.max(max, line.depth), 0);
    const best = lines[0]?.pv[0] ?? null;
    search.resolve({
      lines,
      depth,
      seldepth: lines.reduce((max, line) => Math.max(max, line.seldepth ?? 0), 0) || undefined,
      bestMove: best,
      elapsedMs: Math.round(performance.now() - search.startedAt),
      gameOver: false,
      cancelled: search.cancelled || Boolean(error),
      engineName: this.name,
    });
  }

  private scheduleProgress(search: ActiveSearch, immediate = false) {
    const lines = [...search.lines.values()].sort((a, b) => a.multipv - b.multipv);
    const depth = lines.reduce((max, line) => Math.max(max, line.depth), 0);
    const progress: SearchProgress = {
      lines,
      depth,
      bestMove: lines[0]?.pv[0] ?? null,
      elapsedMs: Math.round(performance.now() - search.startedAt),
    };
    this.pendingProgress = progress;
    const emit = () => {
      this.progressTimer = null;
      if (this.pendingProgress && this.active?.id === search.id) {
        search.onProgress?.(this.pendingProgress);
        search.lastProgressAt = performance.now();
      }
      this.pendingProgress = null;
    };
    if (immediate || !search.onProgress) {
      emit();
      return;
    }
    if (this.progressTimer) return;
    const elapsedSince = performance.now() - search.lastProgressAt;
    const delay = Math.max(0, 90 - elapsedSince);
    this.progressTimer = setTimeout(emit, delay);
  }

  private handleMessage(data: unknown) {
    if (typeof data !== 'string') {
      const obj = data as { type?: string; message?: string } | null;
      if (obj?.type === 'error') this.fail(obj.message ?? 'Engine error');
      return;
    }
    for (const line of data.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const idName = parseIdName(trimmed);
      if (idName) this.name = idName;
      const option = parseOption(trimmed);
      if (option) this.options.set(option.name, option);

      if (this.waiters.length) {
        const matched = this.waiters.filter((w) => w.test(trimmed));
        if (matched.length) {
          this.waiters = this.waiters.filter((w) => !matched.includes(w));
          for (const waiter of matched) {
            clearTimeout(waiter.timer);
            waiter.resolve(trimmed);
          }
        }
      }

      if (trimmed.startsWith('info ')) {
        if (!this.active) continue;
        const info = parseInfo(trimmed);
        if (!info) continue;
        const existing = this.active.lines.get(info.multipv);
        if (!existing || info.depth >= existing.depth) {
          this.active.lines.set(info.multipv, info);
          this.scheduleProgress(this.active);
        }
        continue;
      }

      const best = parseBestMove(trimmed);
      if (best && this.active) {
        const search = this.active;
        clearTimeout(search.watchdog ?? undefined);
        if (this.progressTimer) {
          clearTimeout(this.progressTimer);
          this.progressTimer = null;
        }
        this.active = null;
        const lines = [...search.lines.values()].sort((a, b) => a.multipv - b.multipv);
        const depth = lines.reduce((max, line) => Math.max(max, line.depth), 0);
        search.resolve({
          lines,
          depth,
          seldepth: lines.reduce((max, line) => Math.max(max, line.seldepth ?? 0), 0) || undefined,
          bestMove: best.bestMove,
          ponder: best.ponder,
          elapsedMs: Math.round(performance.now() - search.startedAt),
          gameOver: best.bestMove === null,
          cancelled: search.cancelled,
          engineName: this.name,
        });
        this.setStatus('ready');
      }
    }
  }

  private waitFor(test: (line: string) => boolean, timeout: number, label: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        test,
        resolve,
        reject,
        label,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new EngineError(`Timed out waiting for "${label}".`));
        }, timeout),
      };
      this.waiters.push(waiter);
    });
  }

  private post(command: string) {
    this.worker?.postMessage(command);
  }

  private setStatus(status: EngineStatus, detail?: string) {
    this.status = status;
    this.onStatus(status, detail);
  }

  private fail(message: string) {
    this.lastError = message;
    this.setStatus('error', message);
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new EngineError(message));
    }
    this.waiters = [];
    if (this.active) {
      clearTimeout(this.active.watchdog ?? undefined);
      this.active.cancelled = true;
      this.emitResult(this.active, message);
      this.active = null;
    }
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.worker?.terminate();
    this.worker = null;
    this.startPromise = null;
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.setStatus('idle');
  }
}

/** Score for the side to move. */
export function scoreFromWhite(score: EngineScore, turn: 'w' | 'b'): number {
  const value = score.type === 'mate' ? (score.value > 0 ? 10_000 - score.value * 10 : -10_000 - score.value * 10) : score.value;
  return turn === 'w' ? value : -value;
}
