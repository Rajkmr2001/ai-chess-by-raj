import { expect, type Page } from '@playwright/test';

export interface InitOptions {
  analysisMs?: number;
  autoAnalyze?: boolean;
  theme?: 'dark' | 'light';
}

/** Seed settings before the app boots, so the engine searches are short in CI. */
export async function seedSettings(page: Page, options: InitOptions = {}) {
  const settings = {
    theme: options.theme ?? 'dark',
    boardTheme: 'classic',
    analysisMs: options.analysisMs ?? 350,
    multiPv: 1,
    hashMb: 16,
    autoAnalyze: options.autoAnalyze ?? true,
    showArrow: true,
    pauseWhileAnalyzing: false,
    showCoordinates: true,
  };
  await page.addInitScript((value) => {
    try {
      // Seed once per browser context: reloads must keep the saved session.
      if (!window.localStorage.getItem('chess-ai-arena:seeded')) {
        window.localStorage.setItem('chess-ai-arena:settings:v1', JSON.stringify(value));
        window.localStorage.removeItem('chess-ai-arena:session:v1');
        window.localStorage.setItem('chess-ai-arena:seeded', '1');
      }
    } catch {
      /* ignore */
    }
  }, settings);
}

export async function startGame(page: Page, color: 'White' | 'Black' = 'White', minutes = 5) {
  if (color === 'Black') {
    await page.getByRole('button', { name: /^Black/ }).first().click();
  }
  await page.getByRole('radio', { name: new RegExp(`^${minutes} min`) }).click();
  await page.getByRole('button', { name: /Start game/i }).click();
  await expect(page.locator('#sq-e2')).toBeVisible();
}

export async function waitForEngine(page: Page) {
  await expect(
    page.getByText('Stockfish ready').or(page.locator('[aria-label="Stockfish ready"]')).first(),
  ).toBeVisible({ timeout: 60_000 });
}

export async function waitForRecommendation(page: Page) {
  await expect(page.getByText('RECOMMENDED MOVE')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('completed').first()).toBeVisible({ timeout: 90_000 });
}

export async function clickSquares(page: Page, from: string, to: string) {
  await page.locator(`#sq-${from}`).click();
  await page.locator(`#sq-${to}`).click();
}

export async function enterOpponentMove(page: Page, move: string) {
  const field = page.getByLabel(/Opponent's (White|Black) move/i);
  await field.fill(move);
  await page.getByRole('button', { name: /Enter move/i }).click();
}

export async function loadFen(page: Page, fen: string) {
  await page.getByRole('button', { name: /Import or export FEN or PGN/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: /FEN/i }).click().catch(() => undefined);
  const textarea = dialog.getByRole('textbox');
  await textarea.fill(fen);
  await dialog.getByRole('button', { name: /Load FEN/i }).click();
  await expect(dialog).toBeHidden();
}

export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}
