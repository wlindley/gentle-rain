# `src/ui` — Browser Visualization & Dashboard Module

Thin React 19 + HTML5 Canvas 2D front-end for watching parallel Monte Carlo simulations of **A Gentle Rain** and comparing competing bots.

---

## User / Consumer Guide

### Running the Dashboard
```bash
npm run dev      # Local dev server (Vite)
npm run build    # Typecheck + static production bundle in dist/
npm run preview  # Preview the production bundle locally
```

### Dashboard Features
- **Live Parallel Pond Grid**: Displays 16, 36, 64, or 100 active boards playing simultaneously on a high-DPI HTML5 Canvas, recycling finished boards until the target game count completes.
- **Speed Controls**: Switch seamlessly between `0.1×` (slow ~6 turns/sec to follow individual tile placements and blooms), `1×`, `4×`, `20×`, and `Turbo` (time-sliced batch execution completing thousands of games per second without freezing the UI).
- **Seed Parity**: Enable **Fixed Seed** so different bots face the exact same sequence of shuffled 28-tile decks.
- **Live Telemetry & Histograms**: Tracks Win Rate (8/8 blooms), Mean, Median, `p95`, `p99`, Min/Max score, Avg Blooms, Avg Discards, Score Distribution, and Blooms Placed (0–8).
- **Board Inspector**: Click any live mini-board—or **Inspect Best** / **Inspect Worst**—to open a zoomed high-detail `<dialog>` view of that board.
- **Compare All Bots & Persistent Leaderboard**: Runs all registered bots on identical seeded decks via `TournamentRunner` and persists completed runs in `localStorage` via `LocalStorageScoreStore`.
- **Evolve Bot (GA) Tab**: Runs a multi-core Web Worker Genetic Algorithm (`EvolutionWorkerPool`) optimizing `4×mean + median + 0.5×p95` across 5,000 games/genome per generation (using the generation number as seed), plots fitness over generations, translates any genome into an English strategy summary (`describeGenome`), supports JSON copy/import, saves checkpoints/champions to `localStorage`, and sends evolved champions directly into the Simulator & Compare All Bots.

---

## Developer / Maintainer Guide

### Component Architecture
| File | Responsibility |
| :--- | :--- |
| `palette.ts` | Exhaustive `Record<FlowerColor, FlowerStyle>` lotus color palette and pond theme tokens. |
| `boardRenderer.ts` | Pure Canvas 2D renderer (`renderBoardSnapshot`) drawing tiles, edge petals, quarter-circle cutouts, and glowing blooms. |
| `SimulationGridCanvas.tsx` | Responsive HiDPI `<canvas>` rendering `readonly SlotView[]` with click-to-slot hit-testing. |
| `ControlBar.tsx` | Controlled inputs for bot, game count, grid density, speed, fixed seed, Run/Pause/Reset, and Compare All Bots. |
| `StatsPanel.tsx` | Live KPI cards, Score Distribution & Blooms Placed histograms, and Best/Worst inspect buttons. |
| `LeaderboardPanel.tsx` | Head-to-head tournament comparison table and persistent `localStorage` saved runs table. |
| `BoardInspectorDialog.tsx` | Native `<dialog>` modal (`showModal()`/`close()`) rendering a detailed zoomed Canvas view. |
| `useSimulationController.ts` | Custom React hook owning `RunMode` (`'idle' \| 'simulating' \| 'tournament'`), RAF loop, `SimulationSession`/`TournamentRunner`, and score store. |
| `useEvolutionController.ts` | Custom React hook owning GA `EvolutionWorkerPool`, checkpoint persistence, progress/throughput state, and start/pause/reset controls. |
| `EvolutionPanel.tsx` / `ChampionCard.tsx` / `FitnessChart.tsx` | Declarative GA dashboard views consuming `useEvolutionController` and a discriminated `InspectedState` union for champion/imported inspection. |
| `App.tsx` | Thin top-level layout & tab shell consuming `useSimulationController`. |

### Guardrails & DAG
- Imports only through public `index.ts` entrypoints (`../game`, `../bots`, `../simulation`).
- **Never re-implements game rules or statistics**—delegates all placement geometry, scoring, percentile calculations, and persistence to domain modules.
- Excluded from automated Vitest unit tests (`AGENTS.md` §4); verified via `npm run typecheck`, `npm run build`, and live browser inspection.
