import { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Clock3,
  Crown,
  Gauge,
  GitBranch,
  History,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Board } from './Board';
import { Badge, Button, cx } from './ui';
import { Piece } from '../pieces/Piece';
import { TIME_CONTROLS, type Color, type GameConfig, type TimeControlMinutes } from '../types';
import { relativeTime } from '../lib/format';

const DEMO_FEN = 'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4';

const CONTROL_LABEL: Record<number, string> = {
  1: 'Bullet',
  3: 'Blitz',
  5: 'Blitz',
  10: 'Rapid',
  20: 'Rapid',
  30: 'Classical',
};

export interface SavedSessionInfo {
  moves: number;
  savedAt: number;
  playerColor: Color;
  minutes: number;
  finished: boolean;
}

export function SetupScreen({
  onStart,
  onResume,
  onDiscard,
  saved,
  onOpenSettings,
  onOpenAbout,
}: {
  onStart: (config: GameConfig) => void;
  onResume: () => void;
  onDiscard: () => void;
  saved: SavedSessionInfo | null;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}) {
  const [color, setColor] = useState<Color>('w');
  const [minutes, setMinutes] = useState<TimeControlMinutes>(5);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      {saved && (
        <div className="fade-in mb-6 flex flex-col gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/90 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/25 dark:bg-amber-400/10">
          <div className="flex items-start gap-2.5">
            <History className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
            <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
              <div className="text-sm font-semibold">Unfinished game found in this browser</div>
              <div>
                {saved.moves} move{saved.moves === 1 ? '' : 's'} · you played{' '}
                {saved.playerColor === 'w' ? 'White' : 'Black'} · {saved.minutes} min · saved{' '}
                {relativeTime(saved.savedAt)}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={onDiscard}>
              Discard
            </Button>
            <Button size="sm" variant="primary" onClick={onResume}>
              <RotateCcw className="h-3.5 w-3.5" /> Resume game
            </Button>
          </div>
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-10">
        <section className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="emerald">
              <Sparkles className="h-3 w-3" /> Free · no account
            </Badge>
            <Badge tone="sky">
              <WifiOff className="h-3 w-3" /> Runs in your browser
            </Badge>
            <Badge tone="neutral">Stockfish 19 NNUE</Badge>
          </div>

          <h1 className="heading mt-4 text-4xl leading-[1.05] text-balance sm:text-5xl">
            Your live board,
            <span className="bg-gradient-to-r from-emerald-500 to-sky-500 bg-clip-text text-transparent">
              {' '}
              with an engine second.
            </span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">
            Playing a friend on another phone, in an app, or across a real board? Enter their move here and
            Stockfish — running entirely on your device — recommends your next move. You stay in control of
            the real board; the site tracks the position, the clock and the notation.
          </p>

          <div className="relative mt-7 hidden max-w-[420px] pb-10 lg:block">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-emerald-500/20 via-sky-500/10 to-transparent blur-2xl" />
            <Board
              fen={DEMO_FEN}
              orientation="w"
              interactive={false}
              bestMove={{ from: 'b5', to: 'a4' }}
              lastMove={{ from: 'a6', to: 'a6' }}
              theme="classic"
              onMove={() => undefined}
              showCoordinates={false}
            />
            <div className="absolute -bottom-1 -right-3 w-56 rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-900/95">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-wider muted">
                  Recommended
                </span>
                <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                  depth 22
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">Ba4</span>
                <span className="text-xs font-semibold tabular text-emerald-700 dark:text-emerald-300">
                  +0.31
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[54%] bg-slate-100" />
              </div>
            </div>
          </div>

          <ul className="mt-8 grid gap-2.5 text-sm sm:grid-cols-2">
            {[
              { icon: Gauge, text: 'Real Stockfish WebAssembly, not a toy heuristic' },
              { icon: Clock3, text: 'Independent clock with pause and six time controls' },
              { icon: BookOpenCheck, text: 'PGN/FEN sync and full post-game review' },
              { icon: WifiOff, text: 'Positions never leave your browser' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                <span className="text-[13px] leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="surface relative p-4 sm:p-5" aria-label="New game configuration">
          <div className="flex items-center justify-between">
            <h2 className="heading text-base">New game</h2>
            <Badge tone="neutral">step 1 of 2</Badge>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                I play as
              </span>
              <span className="text-[11px] muted">Board flips automatically</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['w', 'b'] as Color[]).map((option) => {
                const active = color === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setColor(option)}
                    className={cx(
                      'group relative overflow-hidden rounded-xl border p-3 text-left transition-all',
                      active
                        ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400/25 dark:border-emerald-400/60 dark:bg-emerald-400/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="h-10 w-10">
                        <Piece piece={option === 'w' ? 'wK' : 'bK'} />
                      </span>
                      {active && <BadgeCheck className="h-4 w-4 text-emerald-500" />}
                    </div>
                    <div className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                      {option === 'w' ? 'White' : 'Black'}
                    </div>
                    <div className="text-[11px] muted">
                      {option === 'w' ? 'You move first' : 'Opponent moves first'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Time control
              </span>
              <span className="text-[11px] muted">training clock</span>
            </div>
            <div role="radiogroup" aria-label="Time control" className="grid grid-cols-3 gap-2">
              {TIME_CONTROLS.map((option) => {
                const active = minutes === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMinutes(option)}
                    className={cx(
                      'rounded-xl border px-2 py-2 text-center transition-colors',
                      active
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/25 dark:border-emerald-400/60 dark:bg-emerald-400/10 dark:text-emerald-200'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-white/20',
                    )}
                  >
                    <div className="text-base font-semibold tabular">{option}</div>
                    <div className="text-[10px] uppercase tracking-wide opacity-70">min</div>
                    <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide opacity-60">
                      {CONTROL_LABEL[option]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-100">
              <Crown className="h-3.5 w-3.5 text-emerald-500" />
              You play {color === 'w' ? 'White' : 'Black'} · {minutes} min · clock starts{' '}
              {color === 'w' ? 'when you do' : 'when White moves'}
            </div>
            <p className="mt-1">
              The clock here is independent from your phone or tournament clock. It is a training aid, not
              the official timer.
            </p>
          </div>

          <Button
            variant="primary"
            size="lg"
            full
            className="mt-4"
            onClick={() => onStart({ playerColor: color, minutes })}
          >
            <Play className="h-4 w-4" />
            Start game
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed muted">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
            <span>
              Fair play: only use live engine help where the platform or event rules allow it. Practising
              against a friend? Agree first. Rated games? Use post-game review instead.
            </span>
          </p>

          <div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-[11px] dark:border-white/10">
            <div className="flex gap-3">
              <button type="button" onClick={onOpenSettings} className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Settings
              </button>
              <button type="button" onClick={onOpenAbout} className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Fair play & privacy
              </button>
            </div>
            <span className="inline-flex items-center gap-1 muted">
              <GitBranch className="h-3 w-3" /> Open source
            </span>
          </div>
        </section>
      </div>

      <section className="mt-14">
        <h2 className="heading text-lg">How a game flows</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '01',
              title: 'Their move happens',
              body: 'Your opponent plays on their own board or phone — completely separately from this site.',
            },
            {
              step: '02',
              title: 'You enter it',
              body: 'Click the piece on the board or type the move. Illegal or ambiguous input is rejected with a clear message.',
            },
            {
              step: '03',
              title: 'Stockfish answers',
              body: 'The position is analysed locally. You get the best move, an evaluation, the main line and alternatives.',
            },
            {
              step: '04',
              title: 'You play and confirm',
              body: 'Play the move on the real board, then confirm it here. Played something else? Record that instead.',
            },
          ].map((item) => (
            <div key={item.step} className="surface p-3.5">
              <div className="font-mono text-[11px] font-semibold text-emerald-500">{item.step}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
              <p className="mt-1 text-[12px] leading-relaxed muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

