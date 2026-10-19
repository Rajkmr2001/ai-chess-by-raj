import { expect, test } from '@playwright/test';
import { Chess } from 'chess.js';
import {
  enterOpponentMove,
  loadFen,
  seedSettings,
  startGame,
  waitForEngine,
  waitForRecommendation,
} from './helpers';

test.describe('production build on the GitHub Pages sub-path', () => {
  test('serves the app and the engine assets from the repository sub-path', async ({ page, request }) => {
    await seedSettings(page);
    const pageResponse = await page.goto('./');
    expect(pageResponse?.status()).toBe(200);
    expect(page.url()).toContain('/chess-ai-assistant/');

    for (const asset of [
      'engine/stockfish-19-lite-single.js',
      'engine/stockfish-19-lite-single.wasm',
      'engine/LICENSE-stockfish.txt',
      'engine/ENGINE-MANIFEST.txt',
      'favicon.svg',
    ]) {
      const response = await request.get(`/chess-ai-assistant/${asset}`);
      expect(response.status(), asset).toBe(200);
    }
    const wasm = await request.get('/chess-ai-assistant/engine/stockfish-19-lite-single.wasm');
    expect(Number(wasm.headers()['content-length'])).toBeGreaterThan(1_000_000);
  });

  test('engine boots, its recommendation is legal, and no console errors occur', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

    await seedSettings(page);
    await page.goto('./');
    await startGame(page, 'White');
    await waitForEngine(page);
    await waitForRecommendation(page);

    // Play a short opening so the engine works on a non-trivial position.
    // Leave the engine to move for White, so a recommendation is available.
    for (const [san, who] of [
      ['e4', 'me'],
      ['e5', 'opponent'],
    ] as const) {
      if (who === 'me') {
        await page.getByRole('button', { name: /I played another move/i }).click();
        await page.getByLabel('Your actual move').fill(san);
        await page.getByRole('button', { name: /^Record$/ }).click();
      } else {
        await enterOpponentMove(page, san);
      }
    }
    await waitForRecommendation(page);

    // Read the FEN from the export dialog and verify the recommendation is legal.
    await page.getByRole('button', { name: /Import or export FEN or PGN/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('textbox')).not.toHaveValue('');
    const fen = await dialog.getByRole('textbox').inputValue();
    await dialog.getByRole('button', { name: /Close dialog/i }).click();
    expect(fen.split(' ')).toHaveLength(6);

    const confirm = page.getByRole('button', { name: /Confirm .* played/i });
    const label = (await confirm.textContent()) ?? '';
    const san = label.replace(/Confirm\s+/i, '').replace(/\s+played.*$/i, '').trim();
    const game = new Chess(fen);
    const legalSans = game.moves();
    expect(legalSans, `engine suggested ${san} in ${fen}`).toContain(san);

    // Depth and thinking time are displayed.
    await expect(page.getByText('DEPTH')).toBeVisible();
    await expect(page.getByText('TIME')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('finds a forced mate in one and wins the game', async ({ page }) => {
    await seedSettings(page, { analysisMs: 700 });
    await page.goto('./');
    await startGame(page, 'White');
    await loadFen(page, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    await waitForRecommendation(page);
    const confirm = page.getByRole('button', { name: /Confirm .* played/i });
    await expect(confirm).toHaveText(/Ra8#/);
    await confirm.click();
    const summary = page.getByRole('dialog', { name: /Game summary/i });
    await expect(summary).toBeVisible();
    await expect(summary.getByText('You win', { exact: true })).toBeVisible();
  });

  test('undo, redo and position review keep the board in sync', async ({ page }) => {
    await seedSettings(page);
    await page.goto('./');
    await startGame(page, 'White');
    await loadFen(page, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    await waitForRecommendation(page);
    await page.getByRole('button', { name: /Confirm .* played/i }).click();
    await page.getByRole('dialog', { name: /Game summary/i }).getByRole('button', { name: /Close dialog/i }).click();
    // Undo the mating move: the rook returns to a1.
    await page.getByRole('button', { name: /Undo last move/i }).click();
    await expect(page.getByRole('button', { name: /a1, white rook/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /a8, white rook/ })).toHaveCount(0);
    // Redo restores the mate.
    await page.getByRole('button', { name: /Redo move/i }).click();
    await expect(page.getByRole('button', { name: /a8, white rook/ })).toHaveCount(1);
    // Jump back to the start position in review mode.
    await page.getByRole('button', { name: /First move/i }).click();
    await expect(page.getByRole('button', { name: /a1, white rook/ })).toHaveCount(1);
    await expect(page.getByText(/Reviewing position after move 0/i)).toBeVisible();
    await page.getByRole('button', { name: /Back to live/i }).click();
    await expect(page.getByRole('button', { name: /a8, white rook/ })).toHaveCount(1);
  });

  test('PGN export and re-import restores the same game', async ({ page }) => {
    await seedSettings(page);
    await page.goto('./');
    await startGame(page, 'White');
    await page.getByRole('button', { name: /I played another move/i }).click();
    await page.getByLabel('Your actual move').fill('e4');
    await page.getByRole('button', { name: /^Record$/ }).click();
    await enterOpponentMove(page, 'e5');
    await page.getByRole('button', { name: /I played another move/i }).click();
    await page.getByLabel('Your actual move').fill('Nf3');
    await page.getByRole('button', { name: /^Record$/ }).click();

    await page.getByRole('button', { name: /Import or export FEN or PGN/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /PGN/i }).click();
    const pgn = await dialog.getByRole('textbox').inputValue();
    expect(pgn).toContain('1. e4 e5 2. Nf3');
    await dialog.getByRole('button', { name: /Close dialog/i }).click();

    // Start a fresh game and import the PGN.
    await page.getByRole('button', { name: /^New game$/i }).click();
    await page.getByRole('dialog', { name: /Start a new game/i }).getByRole('button', { name: /Discard and start new/i }).click();
    await startGame(page, 'White');
    await page.getByRole('button', { name: /Import or export FEN or PGN/i }).click();
    const dialog2 = page.getByRole('dialog');
    await dialog2.getByRole('radio', { name: /PGN/i }).click();
    await dialog2.getByRole('textbox').fill(pgn);
    await dialog2.getByRole('button', { name: /Load PGN/i }).click();
    await expect(page.getByRole('button', { name: /f3, white knight/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: /e5, black pawn/ })).toHaveCount(1);
  });

  test('all interactive elements expose accessible names', async ({ page }) => {
    await seedSettings(page);
    await page.goto('./');
    await startGame(page, 'White');
    const nameless = await page.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>('button, [role="button"], a[href], input, textarea'),
      );
      return elements
        .filter((element) => {
          if (element.hasAttribute('aria-hidden')) return false;
          const label =
            element.getAttribute('aria-label') ||
            element.getAttribute('title') ||
            element.textContent?.trim() ||
            (element.tagName === 'INPUT' ? (element as HTMLInputElement).placeholder : '');
          return !label;
        })
        .map((element) => element.outerHTML.slice(0, 120));
    });
    expect(nameless).toEqual([]);
    // The skip link is keyboard focusable and becomes visible when focused.
    const skip = page.getByRole('link', { name: /Skip to content/i });
    await skip.focus();
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});

test.describe('mobile layout', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile project only');

  test('stacks the board and the engine panel without horizontal overflow', async ({ page }) => {
    await seedSettings(page);
    await page.goto('./');
    await expect(page.getByRole('button', { name: /Start game/i })).toBeVisible();
    const setupOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(setupOverflow).toBeLessThanOrEqual(1);

    await startGame(page, 'White');
    await waitForRecommendation(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);

    const board = await page.locator('[role="group"][aria-label^="Chessboard"]').boundingBox();
    expect(board?.width ?? 0).toBeGreaterThan(300);

    // Touch-style tap to move works.
    await page.locator('#sq-e2').tap();
    await page.locator('#sq-e4').tap();
    await expect(page.getByRole('button', { name: /e4, white pawn/ })).toHaveCount(1);
    await expect(page.getByLabel("Opponent's Black move")).toBeVisible();
  });
});

test.describe('offline capability', () => {
  test('works without a connection after the first visit', async ({ page, context }) => {
    await seedSettings(page, { analysisMs: 500 });
    await page.goto('./');
    await startGame(page, 'White');
    await waitForRecommendation(page);
    // Wait until the service worker controls the page (assets are cached by then).
    await page.waitForFunction(
      () => Boolean(navigator.serviceWorker?.controller),
      undefined,
      { timeout: 20_000 },
    );

    await context.setOffline(true);
    // The app shell is served from the service-worker cache with no network.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Start game/i })).toBeVisible({ timeout: 20_000 });

    // A brand-new game still gets engine analysis: the WASM build is cached.
    await startGame(page, 'White');
    await waitForRecommendation(page);
    const confirm = page.getByRole('button', { name: /Confirm .* played/i });
    await expect(confirm).toBeVisible();
    await context.setOffline(false);
  });
});
