import { Info, Moon, Settings2, Sun } from 'lucide-react';
import type { EngineStatus } from '../engine/client';
import { APP_NAME, APP_VERSION } from '../lib/appInfo';
import { Badge, cx } from './ui';

const STATUS_TEXT: Record<EngineStatus, { label: string; tone: 'emerald' | 'amber' | 'rose' | 'neutral'; dot: string }> = {
  idle: { label: 'Engine idle', tone: 'neutral', dot: 'bg-slate-400' },
  starting: { label: 'Loading engine', tone: 'amber', dot: 'bg-amber-500 pulse-dot' },
  ready: { label: 'Stockfish ready', tone: 'emerald', dot: 'bg-emerald-500' },
  thinking: { label: 'Analysing', tone: 'amber', dot: 'bg-amber-500 pulse-dot' },
  error: { label: 'Engine error', tone: 'rose', dot: 'bg-rose-500' },
};

export function Header({
  engineStatus,
  showEngine,
  theme,
  onToggleTheme,
  onOpenSettings,
  onOpenAbout,
}: {
  engineStatus: EngineStatus;
  showEngine: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
}) {
  const status = STATUS_TEXT[engineStatus];
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-arena-950/85">
      <div className="mx-auto flex h-14 w-full max-w-[1420px] items-center justify-between gap-1.5 px-2.5 sm:gap-2 sm:px-5">
        <a href="./" className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M14.5 3.5a2.5 2.5 0 0 0-2.5 2.5c0 .4.1.8.3 1.1A5 5 0 0 0 9 11.5L5.6 16.6A1.6 1.6 0 0 0 6.9 19h8.2a1.6 1.6 0 0 0 1.3-2.4L13.5 12a5 5 0 0 0 1.9-4.6A2.5 2.5 0 0 0 14.5 3.5Z"
                fill="#06251c"
              />
              <circle cx="13.4" cy="6.4" r="0.8" fill="#d1fae5" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold tracking-tight text-slate-900 xs:text-sm dark:text-white">
                {APP_NAME}
              </span>
              <span className="hidden rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 sm:inline dark:bg-white/10 dark:text-slate-300">
                v{APP_VERSION}
              </span>
            </span>
            <span className="hidden text-[10px] leading-tight muted sm:block">
              Live Stockfish analysis · entirely in your browser
            </span>
          </span>
        </a>

        <div className="flex shrink-0 items-center gap-0.5 xs:gap-1">
          {showEngine && (
            <span className="hidden xs:inline-flex">
              <Badge tone={status.tone}>
                <span className={cx('h-1.5 w-1.5 rounded-full', status.dot)} aria-hidden="true" />
                {status.label}
              </Badge>
            </span>
          )}
          {showEngine && (
            <span
              className={cx('h-2 w-2 rounded-full xs:hidden', status.dot)}
              aria-label={status.label}
              role="status"
            />
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Toggle theme"
            className="rounded-lg p-1.5 text-slate-600 xs:p-2 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            className="rounded-lg p-1.5 text-slate-600 xs:p-2 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenAbout}
            aria-label="About, fair play and privacy"
            title="About"
            className="rounded-lg p-1.5 text-slate-600 xs:p-2 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
