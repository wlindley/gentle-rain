import type { Genome, GenomeEvaluation } from '../evolution';
import { ChampionCard } from './ChampionCard';
import { FitnessChart } from './FitnessChart';
import { useEvolutionController } from './useEvolutionController';

export interface EvolutionPanelProps {
  readonly onSendToSimulator: (genome: Genome, evaluation: GenomeEvaluation | null) => void;
}

const POP_SIZES = [12, 24, 40] as const;
const GAME_COUNTS = [500, 1000, 5000] as const;

export function EvolutionPanel({ onSendToSimulator }: EvolutionPanelProps) {
  const evo = useEvolutionController();
  const pct = evo.progress.total > 0 ? Math.min(100, (evo.progress.done / evo.progress.total) * 100) : 0;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel control-bar" aria-label="Genetic algorithm controls">
        <label className="field">
          Population
          <select value={evo.populationSize} disabled={evo.isRunning} onChange={(e) => evo.setPopulationSize(Number(e.target.value))}>
            {POP_SIZES.map((n) => <option key={n} value={n}>{n} genomes</option>)}
          </select>
        </label>
        <label className="field">
          Games / Genome
          <select value={evo.gamesPerGenome} disabled={evo.isRunning} onChange={(e) => evo.setGamesPerGenome(Number(e.target.value))}>
            {GAME_COUNTS.map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
          </select>
        </label>
        <label className="field">
          CPU Workers
          <select value={evo.workerCount} disabled={evo.isRunning} onChange={(e) => evo.setWorkerCount(Number(e.target.value))}>
            {Array.from({ length: evo.maxCores }, (_, i) => i + 1).map((c) => <option key={c} value={c}>{c} cores</option>)}
          </select>
        </label>
        <div className="field">
          <label>
            <input type="checkbox" checked={evo.warmStart} disabled={evo.isRunning} onChange={(e) => evo.setWarmStart(e.target.checked)} /> Warm Start
          </label>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Gen {evo.generation} · Seed {evo.generation}</span>
        </div>
        <div className="btn-group">
          <button type="button" className="primary" onClick={evo.isRunning ? evo.pause : evo.start}>
            {evo.isRunning ? 'Pause Evolution' : evo.history.length > 0 ? 'Resume Evolution' : 'Start Evolution'}
          </button>
          <button type="button" disabled={evo.isRunning} onClick={evo.reset}>Reset GA</button>
        </div>
      </section>

      {evo.error && <div className="panel" style={{ borderColor: '#c43b3b', color: '#a12323' }}>{evo.error}</div>}

      <section className="panel" aria-label="Generation progress and fitness chart">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
          <h2 style={{ margin: 0 }}>Generation {evo.generation} Progress ({evo.progress.done} / {evo.progress.total} genomes · Seed {evo.generation})</h2>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(evo.progress.gamesPerSec).toLocaleString()} games/s · Fitness = 4×mean + median + 0.5×p95
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Generation evaluation progress" aria-valuemin={0} aria-valuenow={evo.progress.done} aria-valuemax={evo.progress.total}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <FitnessChart history={evo.history} />
      </section>

      <ChampionCard champion={evo.bestEver} onSendToSimulator={onSendToSimulator} />

      {evo.history.length > 0 && (
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
                {[...evo.history].reverse().map((g) => (
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
