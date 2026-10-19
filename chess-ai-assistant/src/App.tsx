import { useEffect, useReducer, useRef, useState } from 'react';
import { Header } from './components/Header';
import { SetupScreen } from './components/SetupScreen';
import { GameScreen } from './components/GameScreen';
import { Toaster, type ToastItem } from './components/Toaster';
import { SettingsDialog } from './components/dialogs/SettingsDialog';
import { AboutDialog } from './components/dialogs/AboutDialog';
import { ConfirmDialog } from './components/dialogs/ConfirmDialog';
import { freshGameState, gameReducer } from './game/state';
import { useStockfish } from './hooks/useStockfish';
import {
  clearSession,
  loadSession,
  loadSettings,
  saveSession,
  saveSettings,
  type StoredSession,
} from './lib/persistence';
import { APP_NAME, APP_VERSION, ENGINE_LABEL } from './lib/appInfo';
import type { GameConfig, Settings } from './types';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => freshGameState());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [saved, setSaved] = useState<StoredSession | null>(() => {
    const session = loadSession();
    if (!session) return null;
    return session.state.history.length || session.state.result ? session : null;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<GameConfig | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const engine = useStockfish();
  const hadGame = useRef(state.phase !== 'setup');
  const stateRef = useRef(state);
  stateRef.current = state;

  /* Theme ------------------------------------------------------------ */

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.style.colorScheme = settings.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', settings.theme === 'dark' ? '#060a12' : '#f1f5f9');
    saveSettings(settings);
  }, [settings]);

  /* Start of a game --------------------------------------------------- */

  useEffect(() => {
    if (state.phase === 'setup') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [state.phase]);

  /* Session recovery -------------------------------------------------- */

  const signature = [
    state.phase,
    state.baseFen,
    state.history.length,
    state.viewPly,
    state.paused,
    state.result?.reason ?? '',
    state.config.playerColor,
    state.config.minutes,
  ].join('|');

  useEffect(() => {
    if (state.phase === 'setup') {
      if (hadGame.current) {
        clearSession();
        setSaved(null);
        hadGame.current = false;
      }
      return;
    }
    hadGame.current = true;
    const timer = window.setTimeout(() => saveSession(stateRef.current), 350);
    return () => window.clearTimeout(timer);
  }, [signature, state.phase]);

  /* Toasts ------------------------------------------------------------ */

  const seenNotice = useRef(0);
  useEffect(() => {
    const notice = state.notice;
    if (!notice || notice.id === seenNotice.current) return;
    seenNotice.current = notice.id;
    setToasts((previous) => [...previous, notice].slice(-3));
  }, [state.notice]);

  /* Handlers ---------------------------------------------------------- */

  const beginGame = (config: GameConfig) => {
    clearSession();
    setSaved(null);
    dispatch({
      type: 'start',
      config,
      now: Date.now(),
      pauseWhileAnalyzing: settings.pauseWhileAnalyzing,
    });
  };

  const handleStart = (config: GameConfig) => {
    if (saved) setPendingStart(config);
    else beginGame(config);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-emerald-500 focus:px-3 focus:py-1.5 focus:text-sm focus:font-semibold focus:text-emerald-950"
      >
        Skip to content
      </a>

      <Header
        engineStatus={engine.status}
        showEngine={state.phase !== 'setup'}
        theme={settings.theme}
        onToggleTheme={() =>
          setSettings((previous) => ({ ...previous, theme: previous.theme === 'dark' ? 'light' : 'dark' }))
        }
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
      />

      <main id="main" className="flex-1">
        {state.phase === 'setup' ? (
          <SetupScreen
            onStart={handleStart}
            saved={
              saved
                ? {
                    moves: saved.state.history.length,
                    savedAt: saved.savedAt,
                    playerColor: saved.state.config.playerColor,
                    minutes: saved.state.config.minutes,
                    finished: Boolean(saved.state.result),
                  }
                : null
            }
            onResume={() => {
              if (!saved) return;
              dispatch({ type: 'restore', state: saved.state });
            }}
            onDiscard={() => {
              clearSession();
              setSaved(null);
              dispatch({ type: 'notify', kind: 'info', text: 'Unfinished game discarded.' });
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAbout={() => setAboutOpen(true)}
          />
        ) : (
          <GameScreen
            state={state}
            dispatch={dispatch}
            settings={settings}
            engine={engine}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenAbout={() => setAboutOpen(true)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200/70 py-4 dark:border-white/10">
        <div className="mx-auto flex max-w-[1420px] flex-col gap-1 px-3 text-[10px] leading-relaxed text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:text-slate-400">
          <p>
            {APP_NAME} v{APP_VERSION} · {ENGINE_LABEL} (GPLv3) · pieces by Cburnett (CC BY-SA 3.0) · app code
            MIT.
          </p>
          <p className="sm:text-right">
            Free training tool. Not affiliated with any chess platform. Use live engine help only where the
            rules allow it.
          </p>
        </div>
        <p className="mt-2 flex items-center justify-center gap-2 px-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Made by Raj Kumar</span>
          <a
            href="https://github.com/Rajkmr2001"
            aria-label="Raj Kumar on GitHub"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-slate-900 dark:hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-3.5 fill-current"
            >
              <path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.08c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15 1 .1.77 2.26 3.35 1.6.1-.72.4-1.21.72-1.49-2.48-.28-5.08-1.24-5.08-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.44 3.04-1.15 3.04-1.15.61 1.54.23 2.68.12 2.96.71.78 1.14 1.78 1.14 3.01 0 4.29-2.6 5.23-5.09 5.5.4.35.76 1.03.76 2.08V22c0 .3.2.64.77.53A11.1 11.1 0 0 0 12 .9Z" />
            </svg>
          </a>
          <span aria-label="with love">♥️</span>
          <a
            href="https://www.instagram.com/iam_rajkumarpandit?mdxt=MTN5bWM4eDFsNTNpcw=="
            aria-label="Raj Kumar on Instagram"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-slate-900 dark:hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-3.5 fill-current"
            >
              <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
            </svg>
          </a>
        </p>
      </footer>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={(patch) => setSettings((previous) => ({ ...previous, ...patch }))}
        engineName={engine.name}
        engineStatus={engine.status}
        threadsSupported={Boolean(
          engine.client?.supportedOptions.some((option) => option.name === 'Threads'),
        )}
      />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <ConfirmDialog
        open={Boolean(pendingStart)}
        title="A saved game is waiting"
        description="Starting a new game discards the unfinished session stored in this browser."
        confirmLabel="Discard and start"
        destructive
        onCancel={() => setPendingStart(null)}
        onConfirm={() => {
          if (pendingStart) beginGame(pendingStart);
          setPendingStart(null);
        }}
      />

      <Toaster toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
