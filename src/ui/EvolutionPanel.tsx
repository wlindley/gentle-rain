import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_GA_CONFIG, GeneticAlgorithm, LocalStorageEvolutionStore } from '../evolution';
import type { EvolutionCheckpoint, GenerationSummary, Genome, GenomeEvaluation } from '../evolution';
import { SeededRandomSource } from '../rng';
import { ChampionCard } from './ChampionCard';
import { EvolutionWorkerPool } from './evolutionPool';
import { FitnessChart } from './FitnessChart';

export interface EvolutionPanelProps {
  readonly onSendToSimulator: (genome: Genome, evaluation: GenomeEvaluation | null) => void;
}

const POP_SIZES = [12, 24, 40] as const;
const GAME_COUNTS = [500, 1000, 5000] as const;
const detectCores = (): number => Math.max(1, Math.min(typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4, 12));

export function EvolutionPanel({ onSendToSimulator }: EvolutionPanelProps) {
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

  useEffect(() => () => {
    runningRef.current = false;
    poolRef.current?.terminate();
  }, []);

  const stopEvolution = () => {
    runningRef.current = false;
    poolRef.current?.terminate();
    poolRef.current = null;
    setIsRunning(false);
  };

  const handleReset = () => {
    stopEvolution();
    store.clearCheckpoint();
    populationRef.current = null;
    setGeneration(1);
    setHistory([]);
    setBestEver(null);
    setProgress({ done: 0, total: populationSize, gamesPerSec: 0 });
    setError(null);
  };

  const handleStart = async () => {
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
      gen = 1;
      hist = [];
      champ = null;
      setGeneration(1);
      setHistory([]);
      setBestEver(null);
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

  const pct = progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel control-bar" aria-label="Genetic algorithm controls">
        <label className="field">
          Population
          <select value={populationSize} disabled={isRunning} onChange={(e) => setPopulationSize(Number(e.target.value))}>
            {POP_SIZES.map((n) => <option key={n} value={n}>{n} genomes</option>)}
          </select>
        </label>
        <label className="field">
          Games / Genome
          <select value={gamesPerGenome} disabled={isRunning} onChange={(e) => setGamesPerGenome(Number(e.target.value))}>
            {GAME_COUNTS.map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
          </select>
        </label>
        <label className="field">
          CPU Workers
          <select value={workerCount} disabled={isRunning} onChange={(e) => setWorkerCount(Number(e.target.value))}>
            {Array.from({ length: maxCores }, (_, i) => i + 1).map((c) => <option key={c} value={c}>{c} cores</option>)}
          </select>
        </label>
        <div className="field">
          <label>
            <input type="checkbox" checked={warmStart} disabled={isRunning} onChange={(e) => setWarmStart(e.target.checked)} /> Warm Start
          </label>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Gen {generation} · Seed {generation}</span>
        </div>
        <div className="btn-group">
          <button type="button" className="primary" onClick={isRunning ? stopEvolution : handleStart}>
            {isRunning ? 'Pause Evolution' : history.length > 0 ? 'Resume Evolution' : 'Start Evolution'}
          </button>
          <button type="button" disabled={isRunning} onClick={handleReset}>Reset GA</button>
        </div>
      </section>

      {error && <div className="panel" style={{ borderColor: '#c43b3b', color: '#a12323' }}>{error}</div>}

      <section className="panel" aria-label="Generation progress and fitness chart">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
          <h2 style={{ margin: 0 }}>Generation {generation} Progress ({progress.done} / {progress.total} genomes · Seed {generation})</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(progress.gamesPerSec).toLocaleString()} games/s · Fitness = 4×mean + median + 0.5×p95
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Generation evaluation progress" aria-valuemin={0} aria-valuenow={progress.done} aria-valuemax={progress.total}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <FitnessChart history={history} />
      </section>

      <ChampionCard champion={bestEver} onSendToSimulator={onSendToSimulator} />

      {history.length > 0 && (
        <section className="panel" aria-label="Generation history">
          <h2>Generation History</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Gen / Seed</th><th>Best Fitness</th><th>Mean Fitness</th><th>Win %</th><th>Mean</th><th>Median</th><th>p95</th><th>Max</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((g) => (
                  <tr key={g.generation}>
                    <td>Gen {g.generation}</td>
                    <td>{g.bestFitness.toFixed(2)}</td><td>{g.meanFitness.toFixed(2)}</td>
                    <td>{(g.champion.winRate * 100).toFixed(1)}%</td><td>{g.champion.meanScore.toFixed(2)}</td>
                    <td>{g.champion.medianScore.toFixed(1)}</td><td>{g.champion.p95Score}</td><td>{g.champion.maxScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
