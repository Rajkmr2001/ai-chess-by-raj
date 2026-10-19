import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `base` must match the GitHub Pages project path:
 *   https://rajkmr2001.github.io/ai-chess-by-raj/
 * Set VITE_BASE at build time when deploying under a different path.
 */
const base = process.env.VITE_BASE ?? '/ai-chess-by-raj/';

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
