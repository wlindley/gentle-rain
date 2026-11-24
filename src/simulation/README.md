# `src/simulation` — Batch Runner, Statistics, Tournament & Score Persistence

## User / Consumer Guide

`src/simulation` orchestrates single-game bot execution, multi-slot batch simulation sessions, side-by-side bot tournaments on identical seeds, live summary statistics, and pluggable run-history persistence — completely decoupled from React and the DOM.

### Quick-Start Examples

#### Single-game execution (`GameRunner`)

```ts
import { HeuristicBot } from '../bots';
import { GameRunner } from '../simulation';

const runner = new GameRunner(new HeuristicBot(), 42);
const result = runner.runToCompletion();
console.log(result.score, result.isWin, result.placedFlowers);
```

#### Multi-slot batch simulation (`SimulationSession`)

```ts
import { GreedyBloomBot } from '../bots';
import { InMemoryScoreStore, SimulationSession } from '../simulation';

const session = new SimulationSession({
  bot: new GreedyBloomBot(),
  targetGames: 100,
  parallelSlots: 6,
  baseSeed: 2026,
});

// Frame-budgeted turn stepping (for animated UI) or fast batch stepping:
while (!session.isComplete) {
  session.stepGames(10);
}

const store = new InMemoryScoreStore();
store.save(session.toRunRecord('run-1', new Date().toISOString(), true));
console.log(session.stats.meanScore, session.stats.p95Score, session.stats.p99Score);
```

#### Head-to-head comparison (`TournamentRunner`)

```ts
import { BotRegistry } from '../bots';
import { TournamentRunner } from '../simulation';

const tournament = new TournamentRunner({
  bots: BotRegistry.createDefault().bots,
  targetGames: 50,
  parallelSlots: 4,
  baseSeed: 2026,
});
while (!tournament.isComplete) {
  tournament.stepGamesAll(10);
}

for (const { bot, stats } of tournament.rankedSummaries) {
  console.log(bot.name, stats.winRate, stats.meanScore, stats.p95Score);
}
```

#### Browser persistence (`LocalStorageScoreStore`)

```ts
import { LocalStorageScoreStore } from '../simulation';

const store = new LocalStorageScoreStore(); // defaults to 'gentle-rain:bot-runs:v1'
const history = store.loadAll();
```

### Metric Definitions (`SimulationStats`)

- `winCount` / `winRate`: Count and fraction of games with all 8 flowers placed.
- `meanScore` / `medianScore` / `stdDevScore`: Arithmetic mean, exact median (average of middle two for even `n`), and population standard deviation.
- `p95Score` / `p99Score`: **Nearest-rank** percentiles computed on sorted scores: `sorted[min(n - 1, ceil(p * n) - 1)]` (returns `0` when `n === 0`).
- `scoreHistogram`: `ReadonlyMap<number, number>` of score frequencies.
- `bloomHistogram`: 9-element array indexed `0..8` of placed flower counts.

---

## Developer / Maintainer Guide

### Internal Architecture

- **Seed Derivation & Deck/Bot RNG Isolation**:
  - `SimulationSession` creates `baseRng = new SeededRandomSource(config.baseSeed)` and derives each game `k`'s seed via `baseRng.derive(k).seed`.
  - `GameRunner` creates `deckRng = new SeededRandomSource(seed)` for `Game.create(deckRng, catalog)` and derives `botRng = deckRng.derive(1)` for bot tie-breaking, guaranteeing that bot RNG consumption never perturbs deck shuffles and every bot in a `TournamentRunner` sees the exact same deck sequence.
- **Slot Recycling & Frame-Budget Time Slicing**:
  - `SimulationSession` maintains `min(parallelSlots, targetGames)` active `GameRunner` slots. When a slot finishes, its result is recorded into `SimulationStats`, `bestSnapshot` / `worstSnapshot` are updated, and the slot is recycled for `nextGameIndex++` until `targetGames` have been scheduled.
  - `stepTurns(turnsPerSlot)` enables smooth animated UI playback; `stepGames(maxGames)` cycles round-robin across active slots for high-speed Turbo runs.
- **Storage Serialization & Recovery (`JsonKeyStore<T>`, `StorageLike`)**:
  - `JsonKeyStore<T>` encapsulates `JSON.parse`/`JSON.stringify` and safe error recovery over any `StorageLike` backend (defaulting to `globalThis.localStorage`), reused by both `LocalStorageScoreStore` and `src/evolution`'s `LocalStorageEvolutionStore`.
  - `InMemoryScoreStore` defensively copies records and `scoreHistogram` on both `save()` and `loadAll()`.
  - `GameRunner.result` exposes `game.result` directly, and `SimulationStats` lazily caches sorted scores (invalidated on `record()`).

### Module DAG Constraint

- `src/simulation` may import **only** from `../rng`, `../game`, and `../bots`.
- It must never import from `src/ui`, `react`, or DOM globals (other than the default `globalThis.localStorage` parameter in `LocalStorageScoreStore`).

### Running Tests & Coverage

```bash
npm run typecheck
npm run test:coverage
```
