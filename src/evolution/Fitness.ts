import type { TileCatalog } from '../game';
import { SimulationSession } from '../simulation';
import type { SimulationStats } from '../simulation';
import { EvolvedBot } from './EvolvedBot';
import { Genome } from './Genome';

export interface GenomeEvaluation {
  readonly genome: Genome;
  readonly generation: number;
  readonly gamesPlayed: number;
  readonly fitness: number;
  readonly winRate: number;
  readonly meanScore: number;
  readonly medianScore: number;
  readonly p95Score: number;
  readonly p99Score: number;
  readonly maxScore: number;
  readonly meanBlooms: number;
}

export function computeFitness(stats: SimulationStats): number {
  return 4 * stats.meanScore + stats.medianScore + 0.5 * stats.p95Score;
}

export function evaluateGenome(
  genome: Genome,
  gamesPerGenome: number,
  generationSeed: number,
  catalog?: TileCatalog,
): GenomeEvaluation {
  if (!Number.isInteger(gamesPerGenome) || gamesPerGenome <= 0) {
    throw new RangeError(`gamesPerGenome must be a positive integer, received ${gamesPerGenome}`);
  }
  const session = new SimulationSession({
    bot: new EvolvedBot(genome),
    targetGames: gamesPerGenome,
    parallelSlots: 1,
    baseSeed: generationSeed,
    catalog,
  });
  session.stepGames(gamesPerGenome);
  const { stats } = session;
  return {
    genome,
    generation: genome.generation,
    gamesPlayed: stats.totalGames,
    fitness: computeFitness(stats),
    winRate: stats.winRate,
    meanScore: stats.meanScore,
    medianScore: stats.medianScore,
    p95Score: stats.p95Score,
    p99Score: stats.p99Score,
    maxScore: stats.maxScore,
    meanBlooms: stats.meanBlooms,
  };
}
