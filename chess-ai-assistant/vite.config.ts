import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `base` must match the GitHub Pages project path:
 *   https://<user>.github.io/chess-ai-assistant/
 * If you rename the repository, either change the default below or set the
 * VITE_BASE environment variable at build time.
 */
const base = process.env.VITE_BASE ?? '/chess-ai-assistant/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // The Arena preview proxy serves the app from a *.e2b.app host.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
});
