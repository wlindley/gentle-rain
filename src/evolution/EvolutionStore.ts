import { JsonKeyStore, type StorageLike } from '../simulation';
import type { GenomeEvaluation, SerializedGenomeEvaluation } from './Fitness';
import type { GaConfig, GenerationSummary } from './GeneticAlgorithm';
import { Genome } from './Genome';
import type { SerializedGenome } from './Genome';

export interface SavedChampion {
  readonly id: string;
  readonly name: string;
  readonly savedAtIso: string;
  readonly evaluation: GenomeEvaluation;
}

export interface EvolutionCheckpoint {
  readonly config: GaConfig;
  readonly generation: number;
  readonly population: readonly Genome[];
  readonly history: readonly GenerationSummary[];
  readonly bestEver: GenomeEvaluation | null;
}

export interface CheckpointStore {
  loadCheckpoint(): EvolutionCheckpoint | null;
  saveCheckpoint(checkpoint: EvolutionCheckpoint): void;
  clearCheckpoint(): void;
}

export interface ChampionStore {
  loadChampions(): readonly SavedChampion[];
  saveChampion(champion: SavedChampion): void;
  clearChampions(): void;
}

export interface EvolutionStore extends CheckpointStore, ChampionStore {}

type SerializedSummary = Omit<GenerationSummary, 'champion'> & { readonly champion: SerializedGenomeEvaluation };
type SerializedCheckpoint = Omit<EvolutionCheckpoint, 'population' | 'history' | 'bestEver'> & {
  readonly population: readonly SerializedGenome[];
  readonly history: readonly SerializedSummary[];
  readonly bestEver: SerializedGenomeEvaluation | null;
};
type SerializedChampion = Omit<SavedChampion, 'evaluation'> & { readonly evaluation: SerializedGenomeEvaluation };

const reviveEvaluation = (e: GenomeEvaluation | SerializedGenomeEvaluation): GenomeEvaluation => ({
  ...e,
  genome: Genome.fromSerialized(e.genome),
});
const reviveSummary = (s: GenerationSummary | SerializedSummary): GenerationSummary => ({
  ...s,
  champion: reviveEvaluation(s.champion),
});
const reviveCheckpoint = (cp: EvolutionCheckpoint | SerializedCheckpoint): EvolutionCheckpoint => ({
  config: { ...cp.config },
  generation: cp.generation,
  population: cp.population.map((g) => Genome.fromSerialized(g)),
  history: cp.history.map(reviveSummary),
  bestEver: cp.bestEver ? reviveEvaluation(cp.bestEver) : null,
});
const reviveChampion = (c: SavedChampion | SerializedChampion): SavedChampion => ({
  ...c,
  evaluation: reviveEvaluation(c.evaluation),
});

export class InMemoryEvolutionStore implements EvolutionStore {
  private checkpoint: EvolutionCheckpoint | null = null;
  private champions: SavedChampion[] = [];

  loadCheckpoint(): EvolutionCheckpoint | null { return this.checkpoint ? reviveCheckpoint(this.checkpoint) : null; }
  saveCheckpoint(checkpoint: EvolutionCheckpoint): void { this.checkpoint = reviveCheckpoint(checkpoint); }
  clearCheckpoint(): void { this.checkpoint = null; }
  loadChampions(): readonly SavedChampion[] { return this.champions.map(reviveChampion); }
  saveChampion(champion: SavedChampion): void { this.champions.push(reviveChampion(champion)); }
  clearChampions(): void { this.champions = []; }
}

export class LocalStorageEvolutionStore implements EvolutionStore {
  private readonly checkpointStore: JsonKeyStore<EvolutionCheckpoint>;
  private readonly championsStore: JsonKeyStore<SavedChampion[]>;

  constructor(prefix = 'gentle-rain:evolution:v1', storage?: StorageLike) {
    this.checkpointStore = new JsonKeyStore<EvolutionCheckpoint>(`${prefix}:checkpoint`, storage);
    this.championsStore = new JsonKeyStore<SavedChampion[]>(`${prefix}:champions`, storage);
  }

  loadCheckpoint(): EvolutionCheckpoint | null {
    return this.checkpointStore.read((parsed) =>
      parsed && typeof parsed === 'object' && Array.isArray((parsed as Partial<SerializedCheckpoint>).population)
        ? reviveCheckpoint(parsed as SerializedCheckpoint)
        : null,
    );
  }

  saveCheckpoint(checkpoint: EvolutionCheckpoint): void {
    this.checkpointStore.write(reviveCheckpoint(checkpoint));
  }

  clearCheckpoint(): void {
    this.checkpointStore.clear();
  }

  loadChampions(): readonly SavedChampion[] {
    return (
      this.championsStore.read((parsed) =>
        Array.isArray(parsed) ? (parsed as SerializedChampion[]).map(reviveChampion) : null,
      ) ?? []
    );
  }

  saveChampion(champion: SavedChampion): void {
    this.championsStore.write([...this.loadChampions(), reviveChampion(champion)]);
  }

  clearChampions(): void {
    this.championsStore.clear();
  }
}
