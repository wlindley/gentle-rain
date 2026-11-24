# `src/game` — Core Rules Engine for *A Gentle Rain*

## User / Consumer Guide

`src/game` implements the complete, authoritative rules of *A Gentle Rain* as a pure, UI-agnostic TypeScript domain module. Bots, simulations, and the React UI all interact with it exclusively through its public entrypoint (`../game`).

### Core Concepts

- **`PondTile` & Edge Convention**: Each of the 28 unique pond tiles has 4 distinct `FlowerColor` edges ordered `[West, North, East, South]` (`ALL_DIRECTIONS`, `Direction.West = 0`, `North = 1`, `East = 2`, `South = 3`). `Rotation` (`ALL_ROTATIONS`, `0 | 1 | 2 | 3`) rotates edges clockwise in 90° steps: `edgeAt(dir, rot) = baseEdges[(dir - rot + 4) % 4]`.
- **`TileCatalog`**: Loads and validates the 28 rotationally unique tiles from `rules/pond-tiles.json` (14 edges per color). Cached via `TileCatalog.defaultCatalog()`.
- **`Board` & `ReadonlyBoardView`**: Manages placed tiles, orthogonal edge matching, `NeighborCount` (`1 | 2 | 3 | 4`) frontier constraints, 2×2 corner completion, flower blooms (`CornerCoord(cx, cy)` sits at the intersection of `(cx, cy)`, `(cx+1, cy)`, `(cx, cy+1)`, `(cx+1, cy+1)`), incremental bounding box `bounds`, and zero-mutation `previewPlacement(tile, placement)`.
- **`Game`, `GameView` & `ActiveGameView`**: Orchestrates deck shuffling, initial `(0, 0)` placement, turn progression (`eligibleBloomsFor`, `applyMove` -> `PlacedTurnOutcome`, `discardCurrentTile` -> `DiscardedTurnOutcome`), win/loss detection, and scoring (`score = isWin ? placedFlowers + remainingDrawCount : placedFlowers`). `game.activeView` returns a narrowed `ActiveGameView` (`currentTile: PondTile`, `isComplete: false`) while active, or `null` once complete.
- **`GameResult` & `GameSnapshot`**: `game.result` returns a `GameResult` once `game.isComplete` is true (or `null` mid-game). `game.toSnapshot()` returns a discriminated union `ActiveGameSnapshot | CompletedGameSnapshot`.

### Quick-Start Example

```ts
import { SeededRandomSource } from '../rng';
import { Game } from '../game';

const game = Game.create(new SeededRandomSource(42));

while (!game.isComplete) {
  const placements = game.validPlacements;
  if (placements.length === 0) {
    game.discardCurrentTile();
    continue;
  }

  const chosen = placements[0]!;
  const pending = game.eligibleBloomsFor(chosen);
  const usedColors = new Set<string>();
  const blooms = [];

  for (const { corner, eligibleColors } of pending) {
    const color = eligibleColors.find((c) => !usedColors.has(c));
    if (color) {
      usedColors.add(color);
      blooms.push({ corner, color });
    }
  }

  game.applyMove(chosen, blooms);
}

console.log(game.result?.score, game.result?.isWin);
```

---

## Developer / Maintainer Guide

### Internal Architecture

- **Packed Integer-Indexed `FrontierCache` (`Board.ts`)**: `Board` packs `(x, y)` coordinates into a single safe integer `(x + 32768) * 65536 + (y + 32768)` for its `tiles`, `frontier`, and `blooms` `Map`s, eliminating `"x,y"` string allocations in hot bot/simulation loops.
  - Each frontier entry stores its 4 `requiredEdges` and `neighborCount`, updated incrementally on `commitTile`.
  - `validPlacementsFor(tile)` scans only the frontier entries across rotations `0..3`.
- **O(1) Zero-Clone `previewPlacement`**: Uses `completedCornersFor(coord, override)` and non-mutating neighbor lookups so v1 bots evaluate candidate placements with zero board cloning.
- **Atomic Pre-Mutation Bloom Validation (`Game.ts`)**: `applyMove` validates placement legality, corner completion, color eligibility, distinctness across simultaneous blooms, and maximality *before* mutating `Board`, ensuring failed calls never leave `Game` half-mutated.
- **DRY Computed Properties**: `score`, `isWin`, `isComplete`, `remainingDrawCount`, and `unseenTiles` are computed getters; derived state is never duplicated alongside source fields.

### Module DAG Constraint

- `src/game` may import **only** from `../rng` and `../../rules/pond-tiles.json`.
- It must never import from `src/bots`, `src/simulation`, `src/ui`, or `react`.

### Future Multi-Ply Search / Cloning Note

Current v1 bots evaluate 1-ply moves via `Board.previewPlacement()` with zero board copies. If multi-ply lookahead, rollout, or MCTS bots are added in the future, prefer adding an explicit **`Board.clone()`** (and `Game.clone()`) method first for simplicity and invariant safety, rather than introducing stateful make/unmake (`undoPlacement` / `removeBloom`) mutations.

### Running Tests & Coverage

```bash
npm run typecheck
npm run test:coverage
```
