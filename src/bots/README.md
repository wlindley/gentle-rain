# `src/bots` — Pluggable AI Bots & Bloom Assignment Solver

## User / Consumer Guide

`src/bots` provides a polymorphic `Bot` strategy interface, three built-in bots of increasing strength, a `BotRegistry` for discovery/extensibility, and `BloomAssignmentSolver` for computing valid maximal flower bloom assignments.

### Built-In Bots

| ID | Class | Strategy |
| --- | --- | --- |
| `'random'` | `RandomBot` | Uniformly random valid placement and random maximal bloom assignment. |
| `'greedy-bloom'` | `GreedyBloomBot` | Maximizes immediate blooms, breaking ties by higher adjacent `neighborCount`. |
| `'heuristic'` | `HeuristicBot` | Scores immediate blooms, board compactness, unseen-tile fillability of multi-edge pockets (penalizing dead pockets), and blooms scarcer unplayed colors first. |

### Using `BotRegistry` & Adding a Custom Bot

```ts
import { BotRegistry, BloomAssignmentSolver, type Bot } from '../bots';

const registry = BotRegistry.createDefault();
const heuristic = registry.require('heuristic');

const firstMoveBot: Bot = {
  id: 'first-move',
  name: 'First Move Bot',
  description: 'Always picks the first valid placement.',
  choosePlacement: (view) => view.validPlacements[0]!,
  chooseBlooms: (_view, _placement, pendingCorners) =>
    BloomAssignmentSolver.solve(pendingCorners),
};

registry.register(firstMoveBot);
console.log(registry.bots.map((b) => b.id));
// ['random', 'greedy-bloom', 'heuristic', 'first-move']
```

---

## Developer / Maintainer Guide

### Internal Architecture

- **`BloomAssignmentSolver`** (`src/bots/BloomAssignmentSolver.ts`): Because a single tile placement completes at most 4 corners (each with at most 4 seam colors), exact backtracking DFS over `pendingCorners` (including the skip branch per corner) guarantees the exact maximum-cardinality distinct-color bloom assignment in microseconds, breaking ties by maximizing the sum of `colorPriority(color)`.
- **Shared Board Analysis Helpers (`BoardAnalysis.ts`)**: `countUnseenColors`, `countFrontierColors`, `tileFitsConstraint`, `countMatchingUnseen`, and `selectBestPlacement` (argmax with uniform tie-breaking) are shared across `GreedyBloomBot`, `HeuristicBot`, and `src/evolution`'s `EvolvedBot`.
- **Zero-Clone 1-Ply Heuristic Evaluation (`GreedyBloomBot`, `HeuristicBot`)**: Bots receive a narrowed `ActiveGameView` (guaranteeing non-null `currentTile`) and evaluate candidates via `view.board.previewPlacement` and `view.eligibleBloomsFor` without cloning `Board`.
- **Open/Closed Extensibility (`BotRegistry`)**: Provides `bots`, `has(id)`, `find(id)`, `require(id)`, and `register(bot)` so new strategies can be added without modifying simulation or UI code.

### Module DAG Constraint

- `src/bots` may import **only** from `../rng` and `../game`.
- It must never import from `src/simulation`, `src/ui`, or `react`.

### Running Tests & Coverage

```bash
npm run typecheck
npm run test:coverage
```
