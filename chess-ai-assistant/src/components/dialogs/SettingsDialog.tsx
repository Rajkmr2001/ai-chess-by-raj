import { Cpu, Palette, SlidersHorizontal } from 'lucide-react';
import type { BoardTheme, Settings } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { Badge, Button, Divider, Modal, Segmented, Toggle, cx } from '../ui';
import { ENGINE_FLAVOR_LABEL, ENGINE_LABEL } from '../../lib/appInfo';

const BOARD_THEMES: { value: BoardTheme; label: string; light: string; dark: string }[] = [
  { value: 'classic', label: 'Classic wood', light: '#f0d9b5', dark: '#b58863' },
  { value: 'green', label: 'Tournament green', light: '#eeeed2', dark: '#769656' },
  { value: 'ocean', label: 'Ocean blue', light: '#dee3e6', dark: '#7890a8' },
];

export function SettingsDialog({
  open,
  onClose,
  settings,
  onChange,
  engineName,
  engineStatus,
  threadsSupported,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  engineName: string;
  engineStatus: string;
  threadsSupported: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settings"
      description="Everything is stored in this browser only. Nothing is sent to a server."
      icon={<SlidersHorizontal className="h-5 w-5" />}
      footer={
        <>
          <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_SETTINGS, theme: settings.theme })}>
            Reset defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Palette className="h-3.5 w-3.5" /> Appearance
          </h3>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-800 dark:text-slate-100">Theme</span>
            <Segmented
              label="Theme"
              size="sm"
              value={settings.theme}
              onChange={(value) => onChange({ theme: value })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </div>
          <div>
            <div className="mb-1.5 text-sm text-slate-800 dark:text-slate-100">Board colours</div>
            <div className="grid grid-cols-3 gap-2">
              {BOARD_THEMES.map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => onChange({ boardTheme: theme.value })}
                  aria-pressed={settings.boardTheme === theme.value}
                  className={cx(
                    'rounded-xl border p-2 text-left transition-colors',
                    settings.boardTheme === theme.value
                      ? 'border-emerald-400 ring-2 ring-emerald-400/30'
                      : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/25',
                  )}
                >
                  <div className="mb-1.5 grid h-7 grid-cols-2 overflow-hidden rounded-md">
                    <span style={{ background: theme.light }} />
                    <span style={{ background: theme.dark }} />
                    <span style={{ background: theme.dark }} />
                    <span style={{ background: theme.light }} />
                  </div>
                  <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                    {theme.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Board coordinates"
            hint="Show file letters and rank numbers on the board edge."
            checked={settings.showCoordinates}
            onChange={(showCoordinates) => onChange({ showCoordinates })}
          />
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Cpu className="h-3.5 w-3.5" /> Engine
          </h3>
          <div className="rounded-xl bg-slate-100/70 p-2.5 text-[11px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={engineStatus === 'ready' || engineStatus === 'thinking' ? 'emerald' : engineStatus === 'error' ? 'rose' : 'neutral'}>
                {engineStatus}
              </Badge>
              <span className="font-medium text-slate-800 dark:text-slate-100">{engineName}</span>
            </div>
            <p className="mt-1">{ENGINE_LABEL}</p>
            <p className="mt-0.5">{ENGINE_FLAVOR_LABEL}.</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-800 dark:text-slate-100">Thinking time</div>
              <div className="text-[11px] muted">Per position for the standard analysis.</div>
            </div>
            <Segmented
              label="Thinking time"
              size="sm"
              value={settings.analysisMs}
              onChange={(analysisMs) => onChange({ analysisMs })}
              options={[
                { value: 500, label: '0.5s' },
                { value: 1000, label: '1s' },
                { value: 1500, label: '1.5s' },
                { value: 3000, label: '3s' },
                { value: 5000, label: '5s' },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-800 dark:text-slate-100">Candidate moves</div>
              <div className="text-[11px] muted">MultiPV: how many lines Stockfish reports.</div>
            </div>
            <Segmented
              label="Candidate moves"
              size="sm"
              value={settings.multiPv}
              onChange={(multiPv) => onChange({ multiPv })}
              options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-slate-800 dark:text-slate-100">Hash memory</div>
              <div className="text-[11px] muted">Larger is faster on long searches. Default is modest.</div>
            </div>
            <Segmented
              label="Hash memory"
              size="sm"
              value={settings.hashMb}
              onChange={(hashMb) => onChange({ hashMb })}
              options={[
                { value: 16, label: '16' },
                { value: 32, label: '32' },
                { value: 64, label: '64' },
                { value: 128, label: '128' },
              ]}
            />
          </div>
          <Toggle
            label="Multi-threaded engine"
            hint={
              threadsSupported
                ? 'Unavailable with this build: the lite single-thread build is used so the app can run on GitHub Pages without special headers.'
                : 'The bundled engine is single-threaded — reliable on GitHub Pages, which cannot send cross-origin isolation headers.'
            }
            checked={false}
            onChange={() => undefined}
            disabled
          />
          <Toggle
            label="Analyse automatically"
            hint="Start a search as soon as it is your turn. Turn off to analyse only on demand."
            checked={settings.autoAnalyze}
            onChange={(autoAnalyze) => onChange({ autoAnalyze })}
          />
          <Toggle
            label="Pause the clock while Stockfish is thinking"
            hint="Optional. Your real opponent's clock keeps running outside the site, so most players leave this off."
            checked={settings.pauseWhileAnalyzing}
            onChange={(pauseWhileAnalyzing) => onChange({ pauseWhileAnalyzing })}
          />
        </section>

        <Divider />

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Board
          </h3>
          <Toggle
            label="Show the suggested move arrow"
            hint="Draws an arrow for the move you are considering."
            checked={settings.showArrow}
            onChange={(showArrow) => onChange({ showArrow })}
          />
        </section>
      </div>
    </Modal>
  );
}
