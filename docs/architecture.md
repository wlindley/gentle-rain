# A Gentle Rain — Architecture

## 1. Overview

**A Gentle Rain** is a client-only TypeScript implementation and Monte Carlo bot simulator for the solo tile-laying board game described in [`../rules/rules.md`](../rules/rules.md). Everything runs locally in the browser and deploys cleanly as static files on GitHub Pages.

## 2. Strict One-Way Module DAG

Cross-module imports MUST go exclusively through each module's `index.ts` entrypoint:

1. `src/rng` — imports nothing from `src/*`
2. `src/game` — imports only from `src/rng` (and `rules/pond-tiles.json`)
3. `src/bots` — imports only from `src/rng` and `src/game`
4. `src/simulation` — imports only from `src/rng`, `src/game`, and `src/bots`
5. `src/ui` — imports from `src/rng`, `src/game`, `src/bots`, and `src/simulation`

## 3. OOP, SOLID & Performance Design

- **Immutable Value Objects + Encapsulated Mutable Engine**: `PondTile`, `GridCoord`, `CornerCoord`, `GameResult`, `GameSnapshot`, and `BotRunRecord` are immutable value objects. `Board` and `Game` encapsulate forward-only mutation behind read-only interfaces (`ReadonlyBoardView`, `GameView`).
- **Incremental Frontier Cache**: `Board` maintains a frontier map of empty cells orthogonally adjacent to placed tiles along with each cell's 4-edge constraints `[W, N, E, S]` and `neighborCount`. Valid placements are queried strictly against the frontier in O(|frontier|).
- **Packed Integer Keys**: Internally, `Board` packs integer coordinates via `(x + 32768) * 65536 + (y + 32768)` to avoid `"x,y"` string allocations in hot simulation loops while preserving OOP `GridCoord`/`CornerCoord` objects at public boundaries.
- **Zero-Clone 1-Ply Preview**: `ReadonlyBoardView.previewPlacement(tile, placement)` computes newly completed 2×2 corners and the ≤4 affected neighbor frontier constraints in O(1) without cloning or mutating `Board`.
- **Properties Over `get*()`/`set*()`**: All zero-argument accessors and derived metrics (`score`, `isWin`, `winRate`, `meanScore`, `medianScore`, `p95Score`, `p99Score`, `placedTiles`, `bounds`, `result`, etc.) are exposed as `readonly` properties / computed getters (DRY single source of truth).
- **Fair Card-Counting Bot View**: `GameView` exposes `unseenTiles` (unordered remaining tiles) without ever exposing hidden draw order.
- **Time-Sliced Parallel Simulation**: `SimulationSession` runs N active `GameRunner` slots simultaneously with zero DOM dependencies, supporting both smooth turn-by-turn animation (`stepTurns`) and high-speed batch stepping (`stepGames`) inside `requestAnimationFrame` budgets.
- **Seeded Parity**: Game `k` uses `SeededRandomSource(baseSeed).derive(k)` so competing bots face identical deck shuffles.

## 4. Future Multi-Ply Search / Cloning Note

v1 bots (`RandomBot`, `GreedyBloomBot`, `HeuristicBot`) perform **zero board clones** thanks to O(1) `previewPlacement`.

If future work introduces multi-ply tree search (2-ply lookahead, beam search, rollouts, or MCTS):
- **Preferred first option**: Add `Board.clone()` (copying the small integer-keyed maps/arrays cleanly) and `GameView.cloneBoard()` so each search bot gets an isolated scratchpad without risking invariant bugs.
- **Secondary optimization (only if profiling proves `clone()` is a bottleneck)**: Add paired O(1) make/unmake (`undoPlacement` / `removeBloom`) on cloned boards.

## 5. Testing & Fake Policy

- ~100% line and branch coverage across `src/rng`, `src/game`, `src/bots`, and `src/simulation`.
- Zero auto-generated mocks (`vi.mock`, `vi.fn`, `vi.spyOn` forbidden).
- Hand-written fakes ONLY for external boundaries: `StubRandomSource` (RNG) and `InMemoryScoreStore` (plus a minimal `{getItem, setItem, removeItem}` object in `simulation.test.ts` for `LocalStorageScoreStore`).
- `src/ui` is thin, delegates all rules/stats to domain modules, and is verified via `tsc`, `vite build`, and live browser inspection.
