import type { GameSnapshot } from '../game';
import type { SimulationStats } from '../simulation';

export interface StatsPanelProps {
  readonly botName: string;
  readonly completedGames: number;
  readonly targetGames: number;
  readonly gamesPerSec: number;
  readonly stats: SimulationStats;
  readonly bestSnapshot: GameSnapshot | null;
  readonly worstSnapshot: GameSnapshot | null;
  readonly onInspectSnapshot: (title: string, snapshot: GameSnapshot) => void;
}

const fmt = (n: number, digits = 2): string => (Number.isFinite(n) ? n.toFixed(digits) : '0.00');

export function StatsPanel({
  botName,
  completedGames,
  targetGames,
  gamesPerSec,
  stats,
  bestSnapshot,
  worstSnapshot,
  onInspectSnapshot,
}: StatsPanelProps) {
  const pct = targetGames > 0 ? Math.min(100, (completedGames / targetGames) * 100) : 0;
  const histEntries = Array.from(stats.scoreHistogram.entries()).sort((a, b) => a[0] - b[0]);
  const maxScoreCount = histEntries.reduce((m, [, c]) => Math.max(m, c), 1);
  const bloomHist = stats.bloomHistogram;
  const maxBloomCount = bloomHist.reduce((m, c) => Math.max(m, c), 1);

  return (
    <aside className="panel" aria-label="Live simulation statistics">
      <h2>{botName} — Live Telemetry</h2>
      <div className="progress-track" role="progressbar" aria-valuenow={completedGames} aria-valuemax={targetGames}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Progress</div>
          <div className="kpi-value">{completedGames.toLocaleString()} / {targetGames.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Speed</div>
          <div className="kpi-value">{Math.round(gamesPerSec).toLocaleString()} /s</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Win Rate</div>
          <div className="kpi-value">{fmt(stats.winRate * 100, 1)}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Mean Score</div>
          <div className="kpi-value">{fmt(stats.meanScore)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Median</div>
          <div className="kpi-value">{fmt(stats.medianScore, 1)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">p95 / p99</div>
          <div className="kpi-value">{stats.p95Score} / {stats.p99Score}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Min / Max</div>
          <div className="kpi-value">{stats.minScore} / {stats.maxScore}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Blooms</div>
          <div className="kpi-value">{fmt(stats.meanBlooms)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Avg Discards</div>
          <div className="kpi-value">{fmt(stats.meanDiscards)}</div>
        </div>
      </div>

      <h2>Score Distribution</h2>
      <div className="hist-chart" aria-label="Score distribution histogram">
        {histEntries.length === 0 ? (
          <span className="hist-lbl" style={{ margin: 'auto' }}>Run simulation to populate scores</span>
        ) : (
          histEntries.map(([score, count]) => (
            <div className="hist-col" key={score} title={`Score ${score}: ${count} games`}>
              <div
                className={`hist-bar${score >= 8 ? ' win' : ''}`}
                style={{ height: `${Math.max(4, (count / maxScoreCount) * 100)}%` }}
              />
              <span className="hist-lbl">{score}</span>
            </div>
          ))
        )}
      </div>

      <h2 style={{ marginTop: '0.85rem' }}>Blooms Placed (0–8)</h2>
      <div className="hist-chart" aria-label="Blooms placed histogram">
        {bloomHist.map((count, blooms) => (
          <div className="hist-col" key={blooms} title={`${blooms} blooms: ${count} games`}>
            <div
              className={`hist-bar${blooms === 8 ? ' win' : ''}`}
              style={{ height: `${count === 0 ? 2 : Math.max(5, (count / maxBloomCount) * 100)}%` }}
            />
            <span className="hist-lbl">{blooms}</span>
          </div>
        ))}
      </div>

      <div className="btn-group" style={{ marginTop: '0.85rem', marginLeft: 0 }}>
        <button
          type="button"
          className="gold"
          disabled={!bestSnapshot}
          onClick={() => bestSnapshot && onInspectSnapshot(`Best Game (${botName})`, bestSnapshot)}
        >
          Inspect Best ({bestSnapshot ? bestSnapshot.score : '—'})
        </button>
        <button
          type="button"
          disabled={!worstSnapshot}
          onClick={() => worstSnapshot && onInspectSnapshot(`Worst Game (${botName})`, worstSnapshot)}
        >
          Inspect Worst ({worstSnapshot ? worstSnapshot.score : '—'})
        </button>
      </div>
    </aside>
  );
}
