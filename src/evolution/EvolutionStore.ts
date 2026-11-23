import type { GenomeEvaluation } from './Fitness';
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

export interface EvolutionStore {
  loadCheckpoint(): EvolutionCheckpoint | null;
  saveCheckpoint(checkpoint: EvolutionCheckpoint): void;
  clearCheckpoint(): void;
  loadChampions(): readonly SavedChampion[];
  saveChampion(champion: SavedChampion): void;
  clearChampions(): void;
}

const reviveGenome = (raw: SerializedGenome): Genome => new Genome(raw.id, raw.weights, raw.generation);
const reviveEvaluation = (e: GenomeEvaluation): GenomeEvaluation => ({ ...e, genome: reviveGenome(e.genome) });
const reviveSummary = (s: GenerationSummary): GenerationSummary => ({ ...s, champion: reviveEvaluation(s.champion) });
const reviveCheckpoint = (cp: EvolutionCheckpoint): EvolutionCheckpoint => ({
  config: { ...cp.config },
  generation: cp.generation,
  population: cp.population.map(reviveGenome),
  history: cp.history.map(reviveSummary),
  bestEver: cp.bestEver ? reviveEvaluation(cp.bestEver) : null,
});
const reviveChampion = (c: SavedChampion): SavedChampion => ({ ...c, evaluation: reviveEvaluation(c.evaluation) });

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
  private readonly checkpointKey: string;
  private readonly championsKey: string;

  constructor(
    prefix = 'gentle-rain:evolution:v1',
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = globalThis.localStorage,
  ) {
    this.checkpointKey = `${prefix}:checkpoint`;
    this.championsKey = `${prefix}:champions`;
  }

  loadCheckpoint(): EvolutionCheckpoint | null {
    const raw = this.storage.getItem(this.checkpointKey);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as EvolutionCheckpoint).population)) {
        return null;
      }
      return reviveCheckpoint(parsed as EvolutionCheckpoint);
    } catch {
      return null;
    }
  }

  saveCheckpoint(checkpoint: EvolutionCheckpoint): void {
    this.storage.setItem(this.checkpointKey, JSON.stringify(reviveCheckpoint(checkpoint)));
  }

  clearCheckpoint(): void {
    this.storage.removeItem(this.checkpointKey);
  }

  loadChampions(): readonly SavedChampion[] {
    const raw = this.storage.getItem(this.championsKey);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SavedChampion[]).map(reviveChampion) : [];
    } catch {
      return [];
    }
  }

  saveChampion(champion: SavedChampion): void {
    const updated = [...this.loadChampions(), reviveChampion(champion)];
    this.storage.setItem(this.championsKey, JSON.stringify(updated));
  }

  clearChampions(): void {
    this.storage.removeItem(this.championsKey);
  }
}
