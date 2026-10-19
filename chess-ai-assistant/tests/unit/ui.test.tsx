import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from '../../src/components/Board';
import { MoveInput } from '../../src/components/MoveInput';
import { ClocksCard } from '../../src/components/Clocks';
import { MoveList } from '../../src/components/MoveList';
import { EnginePanel } from '../../src/components/EnginePanel';
import type { useAnalysis } from '../../src/engine/useAnalysis';
import { loadSession, loadSettings, saveSession, saveSettings } from '../../src/lib/persistence';
import { DEFAULT_SETTINGS, START_FEN, type MoveRecord } from '../../src/types';
import { freshGameState, gameReducer } from '../../src/game/state';
import { Chess } from 'chess.js';

describe('Board', () => {
  it('renders 64 squares and moves a piece by click, click', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board fen={START_FEN} orientation="w" interactive onMove={onMove} />);
    expect(screen.getAllByRole('button')).toHaveLength(64);
    await user.click(screen.getByRole('button', { name: /^e2,/ }));
    // legal targets are announced
    expect(screen.getByRole('button', { name: /^e4, empty, legal move/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^e4,/ }));
    expect(onMove).toHaveBeenCalledWith('e2', 'e4');
  });

  it('flips the board for Black orientation', () => {
    render(<Board fen={START_FEN} orientation="b" interactive onMove={() => undefined} />);
    const squares = screen.getAllByRole('button');
    // In black orientation the first square rendered is h1.
    expect(squares[0].id).toBe('sq-h1');
    expect(squares[63].id).toBe('sq-a8');
  });

  it('does not allow moving the side that is not to move', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board fen={START_FEN} orientation="w" interactive onMove={onMove} />);
    await user.click(screen.getByRole('button', { name: /^e7,/ }));
    await user.click(screen.getByRole('button', { name: /^e5,/ }));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('is inert when interactive is false', async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board fen={START_FEN} orientation="w" interactive={false} onMove={onMove} />);
    await user.click(screen.getByRole('button', { name: /^e2,/ }));
    await user.click(screen.getByRole('button', { name: /^e4,/ }));
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe('MoveInput', () => {
  it('shows a validation error and suggestions for an illegal move', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockReturnValue({ ok: false, error: 'Not legal', suggestions: ['e4', 'd4'] });
    render(<MoveInput label="Opponent move" submitLabel="Enter" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Opponent move'), 'e5');
    await user.click(screen.getByRole('button', { name: /enter/i }));
    expect(onSubmit).toHaveBeenCalledWith('e5', 'auto');
    expect(screen.getByRole('alert')).toHaveTextContent('Not legal');
    expect(screen.getByRole('button', { name: 'd4' })).toBeInTheDocument();
  });

  it('clears the field after a successful submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockReturnValue({ ok: true });
    render(<MoveInput label="Move" submitLabel="Send" onSubmit={onSubmit} />);
    const input = screen.getByLabelText('Move') as HTMLInputElement;
    await user.type(input, 'e4{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('e4', 'auto');
    expect(input.value).toBe('');
  });

  it('passes the selected notation mode', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockReturnValue({ ok: true });
    render(<MoveInput label="Move" submitLabel="Send" onSubmit={onSubmit} />);
    await user.click(screen.getByRole('radio', { name: 'UCI' }));
    await user.type(screen.getByLabelText('Move'), 'e2e4{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('e2e4', 'uci');
  });
});

describe('ClocksCard', () => {
  const base = {
    clocks: { w: 300_000, b: 240_500 },
    turn: 'w' as const,
    playerColor: 'w' as const,
    paused: false,
    running: true,
    finished: false,
    clockEnabled: true,
    onTogglePause: () => undefined,
    onReset: () => undefined,
  };

  it('shows both clocks and the running state', () => {
    render(<ClocksCard {...base} />);
    expect(screen.getByText('5:00')).toBeInTheDocument();
    expect(screen.getByText('4:01')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause clock/i })).toBeInTheDocument();
  });

  it('labels the paused state and shows "Resume"', () => {
    render(<ClocksCard {...base} paused running={false} />);
    expect(screen.getByText('paused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resume clock/i })).toBeInTheDocument();
  });

  it('explains that it is an independent clock', () => {
    render(<ClocksCard {...base} />);
    expect(screen.getByText(/not synced with your phone/i)).toBeInTheDocument();
  });
});

describe('MoveList', () => {
  const records: MoveRecord[] = (() => {
    const game = new Chess();
    const out: MoveRecord[] = [];
    ['e4', 'e5', 'Nf3'].forEach((san, index) => {
      const move = game.move(san);
      out.push({
        ply: index + 1,
        color: move.color,
        moveNumber: Number(move.before.split(' ')[5]),
        actor: move.color === 'w' ? 'me' : 'opponent',
        san: move.san,
        uci: `${move.from}${move.to}`,
        from: move.from,
        to: move.to,
        piece: move.piece,
        fenBefore: move.before,
        fenAfter: move.after,
        clockW: 0,
        clockB: 0,
        at: 0,
      });
    });
    return out;
  })();

  it('groups moves into numbered pairs and jumps to a ply', async () => {
    const user = userEvent.setup();
    const onSelectPly = vi.fn();
    render(
      <MoveList baseFen={START_FEN} history={records} viewPly={3} onSelectPly={onSelectPly} onCopyPgn={() => undefined} />,
    );
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    const row = screen.getByText('2.').parentElement as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /Nf3/ }));
    expect(onSelectPly).toHaveBeenCalledWith(3);
  });

  it('shows an empty state before the first move', () => {
    render(
      <MoveList baseFen={START_FEN} history={[]} viewPly={0} onSelectPly={() => undefined} onCopyPgn={() => undefined} />,
    );
    expect(screen.getByText('No moves yet')).toBeInTheDocument();
  });
});

describe('persistence', () => {
  it('round-trips settings', () => {
    saveSettings({ ...DEFAULT_SETTINGS, theme: 'light', analysisMs: 3000 });
    const loaded = loadSettings();
    expect(loaded.theme).toBe('light');
    expect(loaded.analysisMs).toBe(3000);
  });

  it('recovers a saved session and forces it into a paused state', () => {
    let state = gameReducer(freshGameState(), {
      type: 'start',
      config: { playerColor: 'w', minutes: 5 },
      now: 1_000_000,
    });
    const move = new Chess().move('e4');
    state = gameReducer(state, { type: 'record', actor: 'me', move, now: 1_000_000 });
    saveSession(state);
    const loaded = loadSession();
    expect(loaded?.state.history).toHaveLength(1);
    expect(loaded?.state.paused).toBe(true);
    expect(loaded?.state.lastTickAt).toBeNull();
  });

  it('ignores corrupt session data', () => {
    localStorage.setItem('chess-ai-arena:session:v1', '{not json');
    expect(loadSession()).toBeNull();
  });

  it('does not persist the setup screen', () => {
    saveSession(freshGameState());
    expect(loadSession()).toBeNull();
  });
});

describe('EnginePanel error handling', () => {
  const analysisStub = {
    status: 'error' as const,
    lines: [],
    depth: 0,
    bestMove: null,
    elapsedMs: 0,
    error: 'WebAssembly blocked',
    deep: false,
    analysedFen: null,
    progress: false,
    shouldRun: false,
    recalculate: () => undefined,
    analyseDeeper: () => undefined,
  } as unknown as ReturnType<typeof useAnalysis>;

  it('explains the failure, offers a retry and stays usable', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <EnginePanel
        engineStatus="error"
        engineName="Stockfish 19"
        engineError="The WebAssembly module could not be loaded."
        engineInfo=""
        analysis={analysisStub}
        fen={START_FEN}
        turn="w"
        multiPv={1}
        myTurn
        reviewing={false}
        gameOver={false}
        selectedUci={null}
        onSelectUci={() => undefined}
        onConfirm={() => undefined}
        onRecordOther={() => ({ ok: true })}
        onRetryEngine={retry}
        onAnalyze={() => undefined}
      />,
    );
    expect(screen.getByText(/Stockfish could not start/i)).toBeInTheDocument();
    expect(screen.getByText(/The WebAssembly module could not be loaded/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Retry engine/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('tells the user it is waiting for the opponent when it is not their turn', () => {
    render(
      <EnginePanel
        engineStatus="ready"
        engineName="Stockfish 19"
        engineError={null}
        engineInfo=""
        analysis={analysisStub}
        fen={START_FEN}
        turn="b"
        multiPv={1}
        myTurn={false}
        reviewing={false}
        gameOver={false}
        selectedUci={null}
        onSelectUci={() => undefined}
        onConfirm={() => undefined}
        onRecordOther={() => ({ ok: true })}
        onRetryEngine={() => undefined}
        onAnalyze={() => undefined}
      />,
    );
    expect(screen.getByText(/Waiting for your opponent's move/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm/i })).not.toBeInTheDocument();
  });
});
