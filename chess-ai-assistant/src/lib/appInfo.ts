export const APP_NAME = 'Chess AI Arena';
export const APP_VERSION = '1.0.0';
export const ENGINE_LABEL = 'Stockfish 19 · NNUE lite · WASM';
export const ENGINE_FLAVOR_LABEL = 'single-threaded (no cross-origin isolation required)';

/**
 * Best-effort link back to the source repository, so the deployed site can show
 * where its code lives without hard-coding a username.
 *
 * 1. `VITE_REPO_URL` wins (useful for custom domains).
 * 2. On `<owner>.github.io/<repo>/` the repository is derived from the URL.
 * 3. Otherwise no link is shown.
 */
export function repositoryUrl(): string | null {
  const configured = import.meta.env.VITE_REPO_URL;
  if (typeof configured === 'string' && configured.length > 0) return configured;
  if (typeof window === 'undefined') return null;

  const { hostname, pathname } = window.location;
  if (!hostname.endsWith('.github.io')) return null;

  const owner = hostname.slice(0, -'.github.io'.length);
  if (!owner) return null;
  const repo = pathname.split('/').filter(Boolean)[0] ?? `${owner}.github.io`;
  return `https://github.com/${owner}/${repo}`;
}

