import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_GA_CONFIG, GeneticAlgorithm, LocalStorageEvolutionStore } from '../evolution';
import type { EvolutionCheckpoint, GenerationSummary, Genome, GenomeEvaluation } from '../evolution';
import { SeededRandomSource } from '../rng';
import { EvolutionWorkerPool } from './evolutionPool';

const detectCores = (): number =>
  Math.max(1, Math.min(typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4, 12));

export function useEvolutionController() {
  const store = useMemo(() => new LocalStorageEvolutionStore(), []);
  const initial = useMemo(() => store.loadCheckpoint(), [store]);
  const maxCores = useMemo(() => detectCores(), []);

  const [populationSize, setPopulationSize] = useState(initial?.config.populationSize ?? DEFAULT_GA_CONFIG.populationSize);
  const [gamesPerGenome, setGamesPerGenome] = useState(initial?.config.gamesPerGenome ?? DEFAULT_GA_CONFIG.gamesPerGenome);
  const [warmStart, setWarmStart] = useState(initial?.config.warmStart ?? DEFAULT_GA_CONFIG.warmStart);
  const [workerCount, setWorkerCount] = useState(maxCores);
  const [generation, setGeneration] = useState(initial?.generation ?? 1);
  const [history, setHistory] = useState<readonly GenerationSummary[]>(initial?.history ?? []);
  const [bestEver, setBestEver] = useState<GenomeEvaluation | null>(initial?.bestEver ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: populationSize, gamesPerSec: 0 });
  const [error, setError] = useState<string | null>(null);

  const populationRef = useRef<readonly Genome[] | null>(initial?.population ?? null);
  const runningRef = useRef(false);
  const poolRef = useRef<EvolutionWorkerPool | null>(null);

  useEffect(() => () => { runningRef.current = false; poolRef.current?.terminate(); }, []);

  const pause = () => {
    runningRef.current = false;
    poolRef.current?.terminate();
    poolRef.current = null;
    setIsRunning(false);
  };

  const reset = () => {
    pause();
    store.clearCheckpoint();
    populationRef.current = null;
    setGeneration(1);
    setHistory([]);
    setBestEver(null);
    setProgress({ done: 0, total: populationSize, gamesPerSec: 0 });
    setError(null);
  };

  const start = async () => {
    if (runningRef.current) return;
    setError(null);
    runningRef.current = true;
    setIsRunning(true);

    const ga = new GeneticAlgorithm({ populationSize, gamesPerGenome, warmStart });
    let pop = populationRef.current;
    let gen = generation;
    let hist = [...history];
    let champ = bestEver;

    if (!pop || pop.length !== populationSize) {
      pop = ga.createInitialPopulation(new SeededRandomSource(1));
      populationRef.current = pop;
      gen = 1; hist = []; champ = null;
      setGeneration(1); setHistory([]); setBestEver(null);
    }

    const pool = new EvolutionWorkerPool(workerCount);
    poolRef.current = pool;

    try {
      while (runningRef.current) {
        const genStart = performance.now();
        setProgress({ done: 0, total: pop.length, gamesPerSec: 0 });
        const evals = await pool.evaluateGeneration(pop, gamesPerGenome, gen, (done, total) => {
          const dt = (performance.now() - genStart) / 1000;
          setProgress({ done, total, gamesPerSec: dt > 0 ? (done * gamesPerGenome) / dt : 0 });
        });
        if (!runningRef.current) break;

        const { nextPopulation, summary } = ga.evolveGeneration(evals, new SeededRandomSource(gen * 10007 + 13));
        hist = [...hist, summary];
        if (!champ || summary.champion.fitness > champ.fitness) champ = summary.champion;
        pop = nextPopulation;
        populationRef.current = pop;
        gen += 1;

        const checkpoint: EvolutionCheckpoint = { config: ga.config, generation: gen, population: pop, history: hist, bestEver: champ };
        store.saveCheckpoint(checkpoint);
        setHistory(hist);
        setBestEver(champ);
        setGeneration(gen);
      }
    } catch (err) {
      pool.terminate();
      if (poolRef.current === pool) poolRef.current = null;
      if (runningRef.current) {
        setError(err instanceof Error ? err.message : 'Evolution failed');
        setIsRunning(false);
        runningRef.current = false;
      }
    }
  };

  return {
    maxCores, populationSize, gamesPerGenome, warmStart, workerCount,
    generation, history, bestEver, isRunning, progress, error,
    setPopulationSize, setGamesPerGenome, setWarmStart, setWorkerCount,
    start, pause, reset,
  };
}
