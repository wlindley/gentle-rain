import { evaluateGenome, Genome } from '../evolution';
import type { GenomeEvaluation, SerializedGenome } from '../evolution';

export interface WorkerRequest {
  readonly jobId: number;
  readonly index: number;
  readonly genome: SerializedGenome;
  readonly gamesPerGenome: number;
  readonly generationSeed: number;
}

export interface WorkerResponse {
  readonly jobId: number;
  readonly index: number;
  readonly evaluation: Omit<GenomeEvaluation, 'genome'> & { readonly genome: SerializedGenome };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { jobId, index, genome: raw, gamesPerGenome, generationSeed } = event.data;
  const genome = new Genome(raw.id, raw.weights, raw.generation);
  const result = evaluateGenome(genome, gamesPerGenome, generationSeed);
  const response: WorkerResponse = {
    jobId,
    index,
    evaluation: { ...result, genome: result.genome.toJSON() },
  };
  self.postMessage(response);
};
