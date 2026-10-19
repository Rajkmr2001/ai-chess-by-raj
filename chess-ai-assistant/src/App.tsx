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
