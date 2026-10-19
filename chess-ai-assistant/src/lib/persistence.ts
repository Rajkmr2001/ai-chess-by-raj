import type { GameState, Settings, TimeControlMinutes } from '../types';
import { DEFAULT_SETTINGS, START_FEN } from '../types';
import { freshGameState } from '../game/state';

const SESSION_KEY = 'chess-ai-arena:session:v1';
const SETTINGS_KEY = 'chess-ai-arena:settings:v1';

function storage(): Storage | null {
  try {
    const test = '__caa_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(): Settings {
  const store = storage();
  if (!store) return { ...DEFAULT_SETTINGS };
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings) {
  storage()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export interface StoredSession {
  version: 1;
  savedAt: number;
  state: GameState;
}

export function saveSession(state: GameState) {
  const store = storage();
  if (!store) return;
  if (state.phase === 'setup') {
    store.removeItem(SESSION_KEY);
    return;
  }
  try {
    const payload: StoredSession = { version: 1, savedAt: Date.now(), state };
    store.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded: keep playing, recovery is best-effort only.
  }
}

export function clearSession() {
  storage()?.removeItem(SESSION_KEY);
}

export function loadSession(): StoredSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed.version !== 1 || !parsed.state) return null;
    const state = sanitise(parsed.state);
    if (!state) return null;
    return { version: 1, savedAt: parsed.savedAt ?? Date.now(), state };
  } catch {
    return null;
  }
}

function sanitise(candidate: GameState): GameState | null {
  try {
    if (!candidate || (candidate.phase !== 'live' && candidate.phase !== 'finished')) return null;
    if (typeof candidate.baseFen !== 'string') return null;
    if (!Array.isArray(candidate.history)) return null;
    const base = freshGameState();
    const config = candidate.config;
    const minutes = Number(config?.minutes);
    const playerColor = config?.playerColor === 'b' ? 'b' : 'w';
    const history = candidate.history.filter(
      (record) =>
        record &&
        typeof record.san === 'string' &&
        typeof record.fenAfter === 'string' &&
        typeof record.ply === 'number',
    );
    return {
      ...base,
      ...candidate,
      baseFen: candidate.baseFen || START_FEN,
      config: {
        playerColor,
        minutes: (([1, 3, 5, 10, 20, 30] as number[]).includes(minutes)
          ? minutes
          : 5) as TimeControlMinutes,
      },
      history,
      redoStack: Array.isArray(candidate.redoStack) ? candidate.redoStack : [],
      viewPly: Math.min(Number(candidate.viewPly ?? history.length), history.length),
      clocks: {
        w: Math.max(0, Number(candidate.clocks?.w ?? 0)),
        b: Math.max(0, Number(candidate.clocks?.b ?? 0)),
      },
      paused: true,
      lastTickAt: null,
      analysisHold: false,
    };
  } catch {
    return null;
  }
}

const SCHEMA_NOTE =
  'Recovery is best-effort: it stores the game in this browser only. Clear it any time with "New game".';

export const PERSISTENCE_NOTE = SCHEMA_NOTE;
