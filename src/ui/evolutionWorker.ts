import { evaluateGenome, Genome } from '../evolution';
import type { SerializedGenome, SerializedGenomeEvaluation } from '../evolution';

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
  readonly evaluation: SerializedGenomeEvaluation;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { jobId, index, genome: raw, gamesPerGenome, generationSeed } = event.data;
  const result = evaluateGenome(Genome.fromSerialized(raw), gamesPerGenome, generationSeed);
  const response: WorkerResponse = {
    jobId,
    index,
    evaluation: { ...result, genome: result.genome.toJSON() },
  };
  self.postMessage(response);
};
