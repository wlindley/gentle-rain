import { Genome } from '../evolution';
import type { GenomeEvaluation } from '../evolution';
import type { WorkerRequest, WorkerResponse } from './evolutionWorker';

export class EvolutionWorkerPool {
  private workers: Worker[] = [];
  private activeJobId = 0;

  constructor(private readonly workerCount: number) {}

  evaluateGeneration(
    population: readonly Genome[],
    gamesPerGenome: number,
    generationSeed: number,
    onProgress?: (completed: number, total: number, latest: GenomeEvaluation) => void,
  ): Promise<readonly GenomeEvaluation[]> {
    this.ensureWorkers();
    const jobId = ++this.activeJobId;
    const total = population.length;
    const results = new Array<GenomeEvaluation>(total);
    let nextIndex = 0;
    let completed = 0;

    return new Promise((resolve, reject) => {
      const dispatch = (worker: Worker) => {
        if (nextIndex >= total) return;
        const index = nextIndex++;
        const req: WorkerRequest = {
          jobId,
          index,
          genome: population[index]!.toJSON(),
          gamesPerGenome,
          generationSeed,
        };
        worker.postMessage(req);
      };

      for (const worker of this.workers) {
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const msg = event.data;
          if (msg.jobId !== jobId) return;
          const revived: GenomeEvaluation = {
            ...msg.evaluation,
            genome: new Genome(msg.evaluation.genome.id, msg.evaluation.genome.weights, msg.evaluation.genome.generation),
          };
          results[msg.index] = revived;
          completed += 1;
          onProgress?.(completed, total, revived);
          if (completed === total) {
            resolve(results);
          } else {
            dispatch(worker);
          }
        };
        worker.onerror = (err) => reject(new Error(err.message || 'Evolution worker failed'));
        dispatch(worker);
      }
    });
  }

  terminate(): void {
    this.activeJobId += 1;
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }

  private ensureWorkers(): void {
    if (this.workers.length === this.workerCount) return;
    this.terminate();
    for (let i = 0; i < this.workerCount; i += 1) {
      this.workers.push(new Worker(new URL('./evolutionWorker.ts', import.meta.url), { type: 'module' }));
    }
  }
}
