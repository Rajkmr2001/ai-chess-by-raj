# Third-party notices

Chess AI Arena is MIT-licensed application code that distributes third-party
components under their own licences. This file lists every runtime component,
its version, licence and where to obtain the corresponding source.

Last reviewed: 2026-10-19, against the versions pinned in `package.json`.

---

## 1. Chess engine — Stockfish (GNU GPL v3)

| Item | Value |
| --- | --- |
| npm package | `stockfish@19.0.1` |
| WebAssembly build | `stockfish-19-lite-single.js` + `stockfish-19-lite-single.wasm` |
| Engine generation | Stockfish 19, NNUE "lite" network, **single-threaded** |
| Distributed files | `public/engine/stockfish-19-lite-single.js`, `public/engine/stockfish-19-lite-single.wasm` |
| Modifications | **None** — byte-for-byte copies from the npm package |
| Size | ≈ 28 KB JS + ≈ 1.85 MB WASM |
| Checksums | see `public/engine/ENGINE-MANIFEST.txt` |
| Licence text shipped in the site | `public/engine/LICENSE-stockfish.txt` (GNU GPL v3) |

Copyright notices (from the engine file header):

```
Stockfish.js 19 (c) 2026, Chess.com, LLC
https://github.com/nmrugg/stockfish.js
License: GPLv3

Based on Stockfish (c) T. Romstad, M. Costalba, J. Kiiski, G. Linscott and other contributors.
https://github.com/official-stockfish/Stockfish

Nets by Chris Bao (sscg13)
```

**Why this build:** GitHub Pages serves project sites without custom HTTP
response headers, so `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy`
cannot be set and `SharedArrayBuffer` is unavailable. The multithreaded builds
would not run there. The lite single-threaded NNUE build needs no special
headers, is ~2 MB (instead of ~94 MB for the full network) and still plays far
above human level. `scripts/sync-engine.mjs --flavor=...` can swap flavours if
you host somewhere that can send COOP/COEP headers.

**GPL v3 source-distribution compliance.** The engine is conveyed as a separate,
unmodified binary. The corresponding source code, build scripts and the network
file are publicly available from:

- https://github.com/nmrugg/stockfish.js (tag/build `v19.0.1`)
- https://github.com/official-stockfish/Stockfish (upstream engine)

The complete GPL v3 licence text travels with the site at
`/engine/LICENSE-stockfish.txt` and in this repository at
`public/engine/LICENSE-stockfish.txt`. If you redistribute this project, keep
those files and this notice in place, and make the source locations above
available to your recipients. The application code talks to the engine only
through the UCI postMessage protocol in a Web Worker; it does not link to the
engine's code.

## 2. Chesspiece artwork — Cburnett (CC BY-SA 3.0)

| Item | Value |
| --- | --- |
| Set | "Cburnett" SVG chess pieces |
| Author | Cburnett (Wikimedia Commons) |
| Source | https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces |
| Licence | Creative Commons Attribution-ShareAlike 3.0 Unported |
| Licence URL | https://creativecommons.org/licenses/by-sa/3.0/ |
| Distributed as | inlined SVG markup in `src/pieces/pieceArt.ts`; original files in `public/licenses/pieces/` |
| Modifications | XML prolog / doctype / metadata removed; outer `<svg>` wrapper replaced by a React-controlled `viewBox="0 0 45 45"` |

The artwork is provided under CC BY-SA 3.0 and remains so. The rest of this
repository is MIT; the artwork is the ShareAlike component. Attribution is
displayed in the site's About dialog and footer.

## 3. Runtime JavaScript libraries

| Package | Version | Licence | Project |
| --- | --- | --- | --- |
| react | 19.3.1 | MIT | https://github.com/facebook/react |
| react-dom | 19.3.1 | MIT | https://github.com/facebook/react |
| chess.js | 1.4.0 | BSD-2-Clause | https://github.com/jhlywa/chess.js |
| lucide-react | 1.59.0 | ISC | https://github.com/lucide-icons/lucide |

## 4. Build, test and tooling dependencies (not shipped to users)

| Package | Version | Licence |
| --- | --- | --- |
| vite | 7.3.7 | MIT |
| @vitejs/plugin-react | 5.2.0 | MIT |
| typescript | 5.9.3 | Apache-2.0 |
| tailwindcss | 4.3.3 | MIT |
| @tailwindcss/vite | 4.3.3 | MIT |
| vitest | 5.0.5 | MIT |
| jsdom | 26.1.0 | MIT |
| @testing-library/react | 16.3.3 | MIT |
| @testing-library/dom | 10.4.1 | MIT |
| @testing-library/jest-dom | 7.0.1 | MIT |
| @testing-library/user-event | 14.6.8 | MIT |
| @playwright/test | 1.64.1 | Apache-2.0 |
| @types/react, @types/react-dom, @types/node | 19.3.0 / 19.3.0 / 26.6.5 | MIT |
| stockfish (npm wrapper for the engine files) | 19.0.1 | GPL-3.0 |

Every transitive dependency keeps its own licence; run `npm ls --all` or a
licence scanner (for example `license-checker`) before redistributing.

## 5. Fonts

The UI uses the operating system's UI font stack (Inter when installed locally,
otherwise the platform default). No web fonts are downloaded at runtime, which
keeps the site fast, private and usable offline.
