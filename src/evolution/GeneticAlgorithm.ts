import type { RandomSource } from '../rng';
import type { GenomeEvaluation } from './Fitness';
import { GENE_SPECS, Genome } from './Genome';
import type { GeneWeights } from './Genome';

export interface GaConfig {
  readonly populationSize: number;
  readonly gamesPerGenome: number;
  readonly eliteCount: number;
  readonly tournamentSize: number;
  readonly crossoverRate: number;
  readonly mutationRate: number;
  readonly mutationSigma: number;
  readonly immigrantCount: number;
  readonly warmStart: boolean;
}

export const DEFAULT_GA_CONFIG: GaConfig = {
  populationSize: 24, gamesPerGenome: 5000, eliteCount: 2, tournamentSize: 3,
  crossoverRate: 0.8, mutationRate: 0.25, mutationSigma: 0.15, immigrantCount: 2, warmStart: true,
};

export interface GenerationSummary {
  readonly generation: number;
  readonly bestFitness: number;
  readonly meanFitness: number;
  readonly champion: GenomeEvaluation;
}

export interface EvolutionStep {
  readonly nextPopulation: readonly Genome[];
  readonly summary: GenerationSummary;
}

function validateConfig(c: GaConfig): void {
  const okInt = (n: number, min: number): boolean => Number.isInteger(n) && n >= min;
  const okRate = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 1;
  if (
    !okInt(c.populationSize, 4) || !okInt(c.gamesPerGenome, 1) || !okInt(c.eliteCount, 1) ||
    !okInt(c.immigrantCount, 0) || c.eliteCount + c.immigrantCount > c.populationSize ||
    !okInt(c.tournamentSize, 2) || !okRate(c.crossoverRate) || !okRate(c.mutationRate) ||
    !Number.isFinite(c.mutationSigma) || c.mutationSigma <= 0
  ) throw new RangeError('Invalid GaConfig parameters');
}

function nextGaussian(rng: RandomSource): number {
  return Math.sqrt(-2 * Math.log(Math.max(1e-9, rng.nextFloat()))) * Math.cos(2 * Math.PI * rng.nextFloat());
}

export class GeneticAlgorithm {
  readonly config: GaConfig;

  constructor(config?: Partial<GaConfig>) {
    this.config = { ...DEFAULT_GA_CONFIG, ...config };
    validateConfig(this.config);
  }

  createInitialPopulation(rng: RandomSource): readonly Genome[] {
    const pop: Genome[] = [];
    if (this.config.warmStart) {
      pop.push(new Genome('g1-heuristic', Genome.heuristicSeed().weights, 1));
      pop.push(new Genome('g1-greedy', Genome.greedySeed().weights, 1));
    }
    while (pop.length < this.config.populationSize) pop.push(Genome.random(`g1-${pop.length}`, rng, 1));
    return pop;
  }

  evolveGeneration(evaluations: readonly GenomeEvaluation[], rng: RandomSource): EvolutionStep {
    if (evaluations.length === 0) throw new RangeError('Cannot evolve from empty evaluations');
    const sorted = [...evaluations].sort((a, b) => b.fitness - a.fitness);
    const currentGen = sorted[0]!.generation, nextGen = currentGen + 1;
    const meanFitness = sorted.reduce((sum, e) => sum + e.fitness, 0) / sorted.length;
    const summary: GenerationSummary = {
      generation: currentGen, bestFitness: sorted[0]!.fitness, meanFitness, champion: sorted[0]!,
    };
    const nextPopulation: Genome[] = [];
    const elites = Math.min(this.config.eliteCount, sorted.length);
    for (let i = 0; i < elites; i += 1) nextPopulation.push(new Genome(`g${nextGen}-e${i}`, sorted[i]!.genome.weights, nextGen));
    for (let i = 0; i < this.config.immigrantCount; i += 1) nextPopulation.push(Genome.random(`g${nextGen}-im${i}`, rng, nextGen));
    for (let idx = 0; nextPopulation.length < this.config.populationSize; idx += 1) {
      nextPopulation.push(this.makeChild(this.tournamentSelect(sorted, rng), this.tournamentSelect(sorted, rng), nextGen, idx, rng));
    }
    return { nextPopulation, summary };
  }

  private tournamentSelect(sorted: readonly GenomeEvaluation[], rng: RandomSource): Genome {
    let best = sorted[rng.nextInt(sorted.length)]!;
    for (let i = 1; i < this.config.tournamentSize; i += 1) {
      const cand = sorted[rng.nextInt(sorted.length)]!;
      if (cand.fitness > best.fitness) best = cand;
    }
    return best.genome;
  }

  private makeChild(p1: Genome, p2: Genome, nextGen: number, idx: number, rng: RandomSource): Genome {
    const doCross = rng.nextFloat() < this.config.crossoverRate;
    const decay = 1 + 0.05 * (nextGen - 2);
    const weights: Record<string, number> = {};
    for (const spec of GENE_SPECS) {
      const a = p1.weights[spec.key];
      let val = a;
      if (doCross) {
        const b = p2.weights[spec.key];
        const lo = Math.min(a, b), hi = Math.max(a, b), pad = 0.25 * (hi - lo);
        val = lo - pad + rng.nextFloat() * (hi - lo + 2 * pad);
      }
      if (rng.nextFloat() < this.config.mutationRate) {
        val += nextGaussian(rng) * ((this.config.mutationSigma * (spec.max - spec.min)) / decay);
      }
      weights[spec.key] = val;
    }
    return new Genome(`g${nextGen}-c${idx}`, weights as GeneWeights, nextGen);
  }
}
