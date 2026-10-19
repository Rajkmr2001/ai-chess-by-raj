import { ExternalLink, Scale, ShieldCheck, Trophy } from 'lucide-react';
import { Button, Modal } from '../ui';
import { APP_VERSION, ENGINE_LABEL, repositoryUrl } from '../../lib/appInfo';

const linkClass =
  'inline-flex items-center gap-1 font-medium text-emerald-700 underline decoration-emerald-500/40 underline-offset-2 hover:decoration-emerald-500 dark:text-emerald-300';

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const source = repositoryUrl();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="About Chess AI Arena"
      description={`Version ${APP_VERSION} · free, browser-only chess assistance`}
      width="lg"
      icon={<Trophy className="h-5 w-5" />}
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <section>
          <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">How it works</h3>
          <ol className="list-decimal space-y-1 pl-4 text-[13px]">
            <li>Choose your colour and time control, then start the game.</li>
            <li>
              When your opponent moves on their own board, enter that move here — by clicking on the board
              or by typing it.
            </li>
            <li>Stockfish analyses the new position and recommends a move for you.</li>
            <li>Play the move on your real board, then press “Confirm move played”.</li>
            <li>If you played something else, record that instead — the site follows your real game.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-100">
          <h3 className="mb-1 flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="h-4 w-4" /> Fair play first
          </h3>
          <p>
            Live engine assistance is <strong>not allowed</strong> in most online rated games, tournaments
            and club events. Use this tool only where the rules of your platform or event permit it — for
            example in unrated practice against a friend who agrees to it, or in a
            computer-assisted-training context. For every other game, use the post-game review mode, which is
            always safe.
          </p>
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">What it cannot do</h3>
          <ul className="list-disc space-y-1 pl-4 text-[13px]">
            <li>It does not promise you a win. It shows the best move the engine found in the time allowed.</li>
            <li>
              It cannot see your opponent's board. Every external move has to be entered by you, so
              synchronisation is only as accurate as your input — use FEN/PGN if you drift.
            </li>
            <li>
              The website clock is independent. It is not connected to your phone, app or tournament clock.
            </li>
          </ul>
        </section>

        <section>
          <h3 className="mb-1 font-semibold text-slate-900 dark:text-white">Privacy</h3>
          <p className="text-[13px]">
            No account, no cookie banner, no analytics. Games, settings and the optional recovery snapshot
            live in this browser's <code className="font-mono text-xs">localStorage</code>. Positions are
            never uploaded — the engine runs locally as WebAssembly. After the app and the engine file are
            cached, the game keeps working without a connection. The one external request is the initial
            download of the app itself.
          </p>
        </section>

        <section>
          <h3 className="mb-1 flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
            <Scale className="h-4 w-4" /> Licensing
          </h3>
          <p className="text-[13px]">
            {ENGINE_LABEL} — build of{' '}
            <a
              className={linkClass}
              href="https://github.com/nmrugg/stockfish.js"
              target="_blank"
              rel="noreferrer noopener"
            >
              stockfish.js <ExternalLink className="h-3 w-3" />
            </a>{' '}
            by Nathan Rugg, based on{' '}
            <a
              className={linkClass}
              href="https://github.com/official-stockfish/Stockfish"
              target="_blank"
              rel="noreferrer noopener"
            >
              Stockfish <ExternalLink className="h-3 w-3" />
            </a>
            . Licensed under the GNU GPL v3; the licence text is shipped at{' '}
            <code className="font-mono text-xs">engine/LICENSE-stockfish.txt</code>, and the engine source is
            available from the upstream projects linked above. Piece artwork: Cburnett set (CC BY-SA 3.0).
            Application code: MIT. See <code className="font-mono text-xs">THIRD-PARTY-NOTICES.md</code>.
          </p>
        </section>

        <p className="text-[11px] muted">
          Not affiliated with Stockfish, Chess.com, Lichess or FIDE. Built as a free training tool.
          {source && (
            <>
              {' '}
              <a
                className={linkClass}
                href={source}
                target="_blank"
                rel="noreferrer noopener"
              >
                Source code <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </p>
      </div>
    </Modal>
  );
}
