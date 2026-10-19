import { expect, test } from '@playwright/test';
import {
  clickSquares,
  enterOpponentMove,
  loadFen,
  seedSettings,
  startGame,
  waitForEngine,
  waitForRecommendation,
} from './helpers';

test.describe('setup screen', () => {
  test('shows colour choices, all six time controls and legal notice', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('engine second');
    await expect(page.getByRole('button', { name: /^White/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Black/ })).toBeVisible();
    for (const minutes of [1, 3, 5, 10, 20, 30]) {
      await expect(page.getByRole('radio', { name: new RegExp(`^${minutes} min`) })).toBeVisible();
    }
    await expect(page.getByText(/Fair play: only use live engine help/i)).toBeVisible();
    await expect(page.getByText(/not the official timer/i)).toBeVisible();
  });

  test('switching colour updates the summary line', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await page.getByRole('button', { name: /^Black/ }).click();
    await expect(page.getByText(/You play Black · 5 min/)).toBeVisible();
    await page.getByRole('radio', { name: /^10 min/ }).click();
    await expect(page.getByText(/You play Black · 10 min/)).toBeVisible();
  });
});

test.describe('game as White', () => {
  test('records my move, the opponent reply and a confirmed engine suggestion', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await waitForEngine(page);
    await waitForRecommendation(page);

    // 1. My first move, played by clicking the board.
    await clickSquares(page, 'e2', 'e4');
    await expect(page.getByRole('button', { name: /e4, white pawn/ })).toHaveCount(1);
    await expect(page.getByText('1.', { exact: true })).toBeVisible();

    // The opponent input appears because it is now Black's turn.
    const opponentField = page.getByLabel("Opponent's Black move");
    await expect(opponentField).toBeVisible();

    // 2. Illegal opponent move is rejected and does not change the position.
    await opponentField.fill('Ke7');
    await page.getByRole('button', { name: /Enter move/i }).click();
    await expect(page.getByRole('alert')).toContainText(/not a legal Black move/i);
    await expect(page.getByRole('button', { name: /e7, black pawn/ })).toHaveCount(1);

    // 3. Legal opponent move is accepted.
    await opponentField.fill('e5');
    await page.getByRole('button', { name: /Enter move/i }).click();
    await expect(page.getByRole('button', { name: /e5, black pawn/ })).toHaveCount(1);
    // Both plies are listed in the move history.
    const moveList = page.getByRole('region', { name: 'Move history' });
    await expect(moveList.getByRole('button', { name: /e4 .*view position/ })).toBeVisible();
    await expect(moveList.getByRole('button', { name: /e5 .*view position/ })).toBeVisible();

    // 4. Engine recommendation for White, then confirm it.
    await waitForRecommendation(page);
    const confirm = page.getByRole('button', { name: /Confirm .* played/i });
    await expect(confirm).toBeVisible();
    const label = (await confirm.textContent()) ?? '';
    const san = label.replace(/Confirm\s+/i, '').replace(/\s+played/i, '').trim();
    expect(san.length).toBeGreaterThan(0);
    await confirm.click();

    // A third ply is recorded and it is Black's turn again.
    await expect(moveList.getByRole('button', { name: /view position/i })).toHaveCount(3);
    await expect(page.getByLabel("Opponent's Black move")).toBeVisible();
  });

  test('records a different move than the suggestion', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await waitForRecommendation(page);
    await page.getByRole('button', { name: /I played another move/i }).click();
    const alt = page.getByLabel('Your actual move');
    await alt.fill('d4');
    await page.getByRole('button', { name: /^Record$/ }).click();
    await expect(page.getByRole('button', { name: /d4, white pawn/ })).toHaveCount(1);
    await expect(page.getByLabel("Opponent's Black move")).toBeVisible();
  });

  test('undoing a mis-entered opponent move restores the position', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await waitForRecommendation(page);
    await clickSquares(page, 'e2', 'e4');
    await enterOpponentMove(page, 'c5');
    await expect(page.getByRole('button', { name: /c5, black pawn/ })).toHaveCount(1);
    await page.getByRole('button', { name: /Undo last move/i }).click();
    await expect(page.getByRole('button', { name: /c5, black pawn/ })).toHaveCount(0);
    await expect(page.getByLabel("Opponent's Black move")).toBeVisible();
    await expect(page.getByText(/Undid c5/)).toBeVisible();
  });

  test('promotes a pawn through the promotion dialog', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await loadFen(page, '8/P6k/8/8/8/8/8/7K w - - 0 1');
    await clickSquares(page, 'a7', 'a8');
    const dialog = page.getByRole('dialog', { name: /Promote your pawn/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /queen/i }).click();
    await expect(page.getByRole('button', { name: /a8, white queen/ })).toHaveCount(1);
    await expect(page.getByText('a8=Q')).toBeVisible();
  });

  test('finishes a game by checkmate and shows the summary', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await loadFen(page, '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    await waitForRecommendation(page);
    await page.getByRole('button', { name: /Confirm .* played/i }).click();
    await expect(page.getByRole('dialog', { name: /Game summary/i })).toBeVisible({ timeout: 30_000 });
    const summary = page.getByRole('dialog', { name: /Game summary/i });
    await expect(summary.getByText('You win', { exact: true })).toBeVisible();
    await expect(summary.getByText(/checkmate/i).first()).toBeVisible();
  });
});

test.describe('game as Black', () => {
  test('expects the opponent (White) to move first and recommends for Black', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'Black');
    await expect(page.locator('#sq-e2')).toBeVisible();
    const field = page.getByLabel("Opponent's White move");
    await expect(field).toBeVisible();
    await expect(page.getByText(/Waiting for your opponent's move/i)).toBeVisible();

    // The engine recommends for the side to move only after White's move.
    await field.fill('d4');
    await page.getByRole('button', { name: /Enter move/i }).click();
    await expect(page.getByRole('button', { name: /d4, white pawn/ })).toHaveCount(1);
    await waitForRecommendation(page);
    const confirm = page.getByRole('button', { name: /Confirm .* played/i });
    await expect(confirm).toBeVisible();
    // Record a different (legal) Black move and check the board updated.
    await page.getByRole('button', { name: /I played another move/i }).click();
    await page.getByLabel('Your actual move').fill('Nf6');
    await page.getByRole('button', { name: /^Record$/ }).click();
    await expect(page.getByRole('button', { name: /f6, black knight/ })).toHaveCount(1);
    await expect(page.getByLabel("Opponent's White move")).toBeVisible();
  });
});

test.describe('clock', () => {
  test('pause freezes the clock and resume continues it', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White', 1);
    await page.waitForTimeout(1800);
    const readClock = async () =>
      (await page.locator('[aria-label^="Your clock"]').first().getAttribute('aria-label')) ?? '';
    const running = await readClock();
    await page.getByRole('button', { name: /Pause clock/i }).click();
    await expect(page.getByText('paused', { exact: true }).first()).toBeVisible();
    const paused = await readClock();
    await page.waitForTimeout(1500);
    expect(await readClock()).toBe(paused);
    await page.getByRole('button', { name: /Resume clock/i }).click();
    await page.waitForTimeout(1200);
    expect(await readClock()).not.toBe(paused);
    expect(running).not.toBe('');
  });

  test('reset restores the full clock and pauses it', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White', 1);
    await page.waitForTimeout(1500);
    const clock = page.locator('[aria-label^="Your clock"]').first();
    await expect(clock).toBeVisible();
    await expect(page.getByText('1 min', { exact: true })).toBeVisible();
    const before = (await clock.getAttribute('aria-label')) ?? '';
    await page.getByRole('button', { name: /Reset clock/i }).click();
    await expect(clock).toHaveAttribute('aria-label', 'Your clock: 60 seconds');
    await expect(page.getByText('paused', { exact: true }).first()).toBeVisible();
    expect(before).not.toBe('Your clock: 60 seconds');
  });

  test('states clearly that the clock is independent', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await expect(page.getByText(/It is not synced with your phone/i)).toBeVisible();
  });
});

test.describe('session recovery and preferences', () => {
  test('offers to resume a saved session after a reload', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await startGame(page, 'White');
    await clickSquares(page, 'e2', 'e4');
    await page.waitForTimeout(900); // debounced save
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByText(/Unfinished game found/i)).toBeVisible();
    await page.getByRole('button', { name: /Resume game/i }).click();
    await expect(page.getByRole('button', { name: /e4, white pawn/ })).toBeVisible();
    await expect(page.getByText('paused', { exact: true }).first()).toBeVisible();
  });

  test('theme toggle switches and persists across reloads', async ({ page }) => {
    await seedSettings(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: /Switch to light theme/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expect(page.getByRole('button', { name: /Switch to dark theme/i })).toBeVisible();
  });

});
