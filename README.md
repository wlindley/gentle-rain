# A Gentle Rain — TypeScript Engine & Monte Carlo Bot Simulator

A client-only TypeScript implementation of the solo tile-laying board game **A Gentle Rain** ([`rules/rules.md`](rules/rules.md)) featuring pluggable AI bots, a high-speed parallel Monte Carlo simulator, persistent `localStorage` leaderboards, and a live HTML5 Canvas visualization dashboard deployable to GitHub Pages.

## Quick Start

```bash
npm install
npm run dev            # Start local Vite dev server
npm run test:coverage  # Run Vitest boundary suite with v8 coverage (~100% domain coverage)
npm run build          # Typecheck and build static GitHub Pages bundle into dist/
```

## Architecture (Strict One-Way Module DAG)

| Module | Guide | Imports | Responsibility |
| :--- | :--- | :--- | :--- |
| **`src/rng`** | [`src/rng/README.md`](src/rng/README.md) | *(none)* | `RandomSource`, `MathRandomSource`, deterministic `SeededRandomSource` (Mulberry32), and `StubRandomSource` test fake. |
| **`src/game`** | [`src/game/README.md`](src/game/README.md) | `src/rng`, `rules/pond-tiles.json` | Headless rules engine: `PondTile`, `TileCatalog`, integer-indexed `Board` + incremental `FrontierCache`, O(1) `previewPlacement`, `Game`, `GameResult`, `GameSnapshot`. |
| **`src/bots`** | [`src/bots/README.md`](src/bots/README.md) | `src/rng`, `src/game` | Pluggable `Bot` interface, `BloomAssignmentSolver`, `RandomBot`, `GreedyBloomBot`, `HeuristicBot`, and `BotRegistry`. |
| **`src/simulation`** | [`src/simulation/README.md`](src/simulation/README.md) | `src/rng`, `src/game`, `src/bots` | `GameRunner`, `SimulationStats` (mean/median/p95/p99/histograms), `SimulationSession`, `TournamentRunner`, `LocalStorageScoreStore`, and `InMemoryScoreStore`. |
| **`src/ui`** | [`src/ui/README.md`](src/ui/README.md) | `src/rng`, `src/game`, `src/bots`, `src/simulation` | React 19 + HTML5 Canvas 2D dashboard for parallel simulations, live stats, click-to-inspect modal, and bot comparison. |

## Project Specifications

- **Game Rules**: [`rules/rules.md`](rules/rules.md) & [`rules/pond-tiles.json`](rules/pond-tiles.json)
- **Architecture**: [`docs/architecture.md`](docs/architecture.md)
- **Module Interfaces**: [`docs/interfaces.md`](docs/interfaces.md)
- **Boundary Test Cases**: [`docs/test-cases.md`](docs/test-cases.md)
- **Commit Plan & Subagents**: [`docs/implementation-plan.md`](docs/implementation-plan.md) & [`docs/subagents.md`](docs/subagents.md)

## Deploying to GitHub Pages

`vite.config.ts` sets `base: './'`, so running `npm run build` produces a self-contained static site in `dist/` ready to publish directly to GitHub Pages.
