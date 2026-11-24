# `src/evolution` — Genetic Algorithm & Interpretable 20-Gene Strategy Evolution

## User / Consumer Guide

`src/evolution` discovers high-performing *A Gentle Rain* strategies using an evolutionary Genetic Algorithm over an interpretable 20-gene `Genome`. Every evolved genome can be instantiated directly as a standard `Bot` (`EvolvedBot`), evaluated against seeded game suites, translated into plain English (`describeGenome`), persisted across browser reloads (`LocalStorageEvolutionStore`), and exported/imported as JSON.

### The 20-Gene Interpretable `Genome`

Each `Genome` holds 20 bounded numeric weights across 5 strategic categories:

- **Blooms**: `immediateBloomWeight`, `multiBloomBonus`, `bloomUrgencyLateSlope`
- **Pockets**: `fillablePocket2Weight`, `fillablePocket3Weight`, `fillablePocket4Weight`, `pocketMatchDiversityWeight`, `deadPocket2Penalty`, `deadPocket3Penalty`, `deadPocket4Penalty`, `unplayedCornerSetupWeight`, `alreadyBloomedCornerWeight`
- **Geometry**: `neighborCountWeight`, `compactnessLateSlope`, `boundingBoxGrowthWeight`, `centerDistanceWeight`
- **Open Edge Exposure**: `exposedUnplayedColorWeight`, `exposedAbundanceWeight`
- **Bloom Choice**: `bloomScarcityPriority`, `bloomFrontierScarcityPriority`

### Fitness Function

```text
fitness = 4 * meanScore + 1 * medianScore + 0.5 * p95Score
```

This composite objective rewards both high average performance (`meanScore`), consistent typical games (`medianScore`), and strong upper-tail upside (`p95Score`).

### Quick-Start Example

```ts
import { SeededRandomSource } from '../rng';
import {
  EvolvedBot,
  GeneticAlgorithm,
  Genome,
  LocalStorageEvolutionStore,
  describeGenome,
  evaluateGenome,
} from '../evolution';

const ga = new GeneticAlgorithm({ populationSize: 12, gamesPerGenome: 200 });
const rng = new SeededRandomSource(2026);
let population = ga.createInitialPopulation(rng);

const evaluations = population.map((genome) =>
  evaluateGenome(genome, ga.config.gamesPerGenome, 1001),
);
const { nextPopulation, summary } = ga.evolveGeneration(evaluations, rng);
population = nextPopulation;

// Instantiate champion as a Bot and describe its strategy in English
const championBot = new EvolvedBot(summary.champion.genome, 'Gen 1 Champion');
const story = describeGenome(summary.champion.genome);
console.log(championBot.id, story.headline, story.bullets);

// Export / import JSON or persist via LocalStorageEvolutionStore
const json = JSON.stringify(summary.champion.genome.toJSON());
const restored = Genome.fromJSON(json);
const store = new LocalStorageEvolutionStore();
store.saveChampion({
  id: 'champ-1',
  name: championBot.name,
  savedAtIso: new Date().toISOString(),
  evaluation: summary.champion,
});
```

---

## Developer / Maintainer Guide

### Internal Architecture

- **Zero-Clone 20-Gene Evaluation (`EvolvedBot.ts`)**: Evaluates every candidate placement via `Board.previewPlacement()` and fair public `GameView` data (`unseenTiles`, `board.frontierConstraints`, `board.bounds`) with zero board cloning. Color counts (`unseenCounts`, `frontierCounts`) and the `bloomPriority` closure are precomputed once per turn.
- **BLX-α Crossover & Decayed Gaussian Mutation (`GeneticAlgorithm.ts`)**:
  - Supports warm-starting generation 1 with `Genome.heuristicSeed()` and `Genome.greedySeed()`.
  - Preserves top `eliteCount` genomes verbatim, injects `immigrantCount` fresh random genomes each generation, and breeds remaining children via tournament selection, BLX-α (`alpha = 0.25`) blend crossover, and Box-Muller Gaussian mutation with generation-decayed step size `sigma * (max - min) / (1 + 0.05 * (gen - 1))`.
  - All offspring pass through `new Genome(...)`, guaranteeing strict `[min, max]` clamping.
- **Generation-Seeded Fairness & Pluggable Fitness (`Fitness.ts`)**: `evaluateGenome` delegates to `SimulationSession` with a shared `generationSeed` and accepts an optional `FitnessFunction` (defaulting to `computeFitness`), plus exports `SerializedGenomeEvaluation` for worker/storage transport.
- **Store Rehydration & Interface Segregation (`EvolutionStore.ts`)**: `EvolutionStore` composes narrow `CheckpointStore` and `ChampionStore` interfaces. `Genome.fromSerialized(raw)` validates and revives unknown JSON/worker payloads, and `LocalStorageEvolutionStore` delegates persistence to `JsonKeyStore` from `../simulation`.

### Module DAG Constraint

- `src/evolution` may import **only** from `../rng`, `../game`, `../bots`, and `../simulation`.
- It is completely DOM-free and Web Worker-ready (never imports `src/ui`, `react`, or `window`).

### Running Tests & Coverage

```bash
npm run typecheck
npm run test:coverage
```
