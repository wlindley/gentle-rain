import type { RandomSource } from '../rng';

export type GeneCategory = 'blooms' | 'pockets' | 'geometry' | 'exposure' | 'bloomChoice';

export interface GeneSpec<K extends string = string> {
  readonly key: K;
  readonly label: string;
  readonly category: GeneCategory;
  readonly min: number;
  readonly max: number;
}

export const GENE_SPECS = [
  { key: 'immediateBloomWeight', label: 'Immediate Bloom', category: 'blooms', min: -50, max: 200 },
  { key: 'multiBloomBonus', label: 'Multi-Bloom Bonus', category: 'blooms', min: -50, max: 150 },
  { key: 'bloomUrgencyLateSlope', label: 'Late Bloom Urgency', category: 'blooms', min: -100, max: 200 },
  { key: 'fillablePocket2Weight', label: 'Fillable 2-Edge Pocket', category: 'pockets', min: -40, max: 80 },
  { key: 'fillablePocket3Weight', label: 'Fillable 3-Edge Pocket', category: 'pockets', min: -40, max: 120 },
  { key: 'fillablePocket4Weight', label: 'Fillable 4-Edge Pocket', category: 'pockets', min: -40, max: 150 },
  { key: 'pocketMatchDiversityWeight', label: 'Pocket Match Diversity', category: 'pockets', min: -20, max: 40 },
  { key: 'deadPocket2Penalty', label: 'Dead 2-Edge Penalty', category: 'pockets', min: -120, max: 20 },
  { key: 'deadPocket3Penalty', label: 'Dead 3-Edge Penalty', category: 'pockets', min: -150, max: 20 },
  { key: 'deadPocket4Penalty', label: 'Dead 4-Edge Penalty', category: 'pockets', min: -180, max: 20 },
  { key: 'unplayedCornerSetupWeight', label: 'Unplayed Corner Setup', category: 'pockets', min: -40, max: 100 },
  { key: 'alreadyBloomedCornerWeight', label: 'Already-Bloomed Corner', category: 'pockets', min: -60, max: 40 },
  { key: 'neighborCountWeight', label: 'Neighbor Count', category: 'geometry', min: -30, max: 50 },
  { key: 'compactnessLateSlope', label: 'Late Compactness', category: 'geometry', min: -40, max: 40 },
  { key: 'boundingBoxGrowthWeight', label: 'Bounding Box Growth', category: 'geometry', min: -50, max: 20 },
  { key: 'centerDistanceWeight', label: 'Center Distance', category: 'geometry', min: -20, max: 15 },
  { key: 'exposedUnplayedColorWeight', label: 'Exposed Unplayed Color', category: 'exposure', min: -30, max: 50 },
  { key: 'exposedAbundanceWeight', label: 'Exposed Abundance', category: 'exposure', min: -30, max: 50 },
  { key: 'bloomScarcityPriority', label: 'Bloom Scarcity Priority', category: 'bloomChoice', min: -50, max: 100 },
  { key: 'bloomFrontierScarcityPriority', label: 'Bloom Frontier Scarcity', category: 'bloomChoice', min: -50, max: 100 },
] as const satisfies readonly GeneSpec[];

export type GeneKey = (typeof GENE_SPECS)[number]['key'];
export type GeneWeights = { readonly [K in GeneKey]: number };

export interface SerializedGenome {
  readonly id: string;
  readonly generation: number;
  readonly weights: GeneWeights;
}

const HEURISTIC_WEIGHTS: Partial<Record<GeneKey, number>> = {
  immediateBloomWeight: 100,
  multiBloomBonus: 20,
  fillablePocket2Weight: 16,
  fillablePocket3Weight: 24,
  fillablePocket4Weight: 32,
  pocketMatchDiversityWeight: 2,
  deadPocket2Penalty: -36,
  deadPocket3Penalty: -54,
  deadPocket4Penalty: -72,
  unplayedCornerSetupWeight: 12,
  alreadyBloomedCornerWeight: -8,
  neighborCountWeight: 6,
  exposedUnplayedColorWeight: 4,
  exposedAbundanceWeight: 2,
  bloomScarcityPriority: 20,
};

function buildWeights(fn: (spec: (typeof GENE_SPECS)[number]) => number): GeneWeights {
  const out: Record<string, number> = {};
  for (const spec of GENE_SPECS) out[spec.key] = fn(spec);
  return out as GeneWeights;
}

export class Genome {
  readonly id: string;
  readonly weights: GeneWeights;
  readonly generation: number;

  constructor(id: string, weights: GeneWeights, generation = 0) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new RangeError('Genome id must be a non-empty string');
    }
    if (!Number.isInteger(generation) || generation < 0) {
      throw new RangeError(`Genome generation must be a non-negative integer, received ${generation}`);
    }
    const clamped: Record<string, number> = {};
    for (const spec of GENE_SPECS) {
      const value = weights[spec.key];
      if (!Number.isFinite(value)) {
        throw new RangeError(`Gene "${spec.key}" must be a finite number, received ${value}`);
      }
      clamped[spec.key] = Math.min(spec.max, Math.max(spec.min, value));
    }
    this.id = id;
    this.generation = generation;
    this.weights = Object.freeze(clamped as GeneWeights);
  }

  static random(id: string, rng: RandomSource, generation?: number): Genome {
    return new Genome(id, buildWeights((s) => s.min + rng.nextFloat() * (s.max - s.min)), generation);
  }

  static heuristicSeed(id = 'seed-heuristic'): Genome {
    return new Genome(id, buildWeights((s) => HEURISTIC_WEIGHTS[s.key] ?? 0));
  }

  static greedySeed(id = 'seed-greedy'): Genome {
    return new Genome(
      id,
      buildWeights((s) => (s.key === 'immediateBloomWeight' ? 100 : s.key === 'neighborCountWeight' ? 10 : 0)),
    );
  }

  static fromJSON(raw: string): Genome {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new RangeError('Invalid serialized genome');
    }
    const obj = data as Partial<SerializedGenome>;
    if (!obj.weights || typeof obj.weights !== 'object') {
      throw new RangeError('Invalid serialized genome weights');
    }
    return new Genome(obj.id as string, obj.weights, obj.generation);
  }

  toJSON(): SerializedGenome {
    return { id: this.id, generation: this.generation, weights: { ...this.weights } };
  }
}
