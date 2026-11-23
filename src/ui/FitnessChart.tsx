import type { GenerationSummary } from '../evolution';

export interface FitnessChartProps {
  readonly history: readonly GenerationSummary[];
}

export function FitnessChart({ history }: FitnessChartProps) {
  if (history.length === 0) {
    return (
      <div className="hist-chart" style={{ height: '140px', alignItems: 'center', justifyContent: 'center' }}>
        <span className="hist-lbl">Complete Generation 1 to plot fitness over generations</span>
      </div>
    );
  }

  const w = 520;
  const h = 140;
  const pad = 22;
  const values = history.flatMap((g) => [g.bestFitness, g.meanFitness]);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const rangeY = Math.max(1, maxY - minY);
  const toX = (i: number) =>
    history.length === 1 ? w / 2 : pad + (i / (history.length - 1)) * (w - pad * 2);
  const toY = (v: number) => h - pad - ((v - minY) / rangeY) * (h - pad * 2);

  const bestPts = history.map((g, i) => `${toX(i).toFixed(1)},${toY(g.bestFitness).toFixed(1)}`).join(' ');
  const meanPts = history.map((g, i) => `${toX(i).toFixed(1)},${toY(g.meanFitness).toFixed(1)}`).join(' ');

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem' }}>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '140px', display: 'block' }} role="img" aria-label="Fitness over generations chart">
        <polyline fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 3" points={meanPts} />
        <polyline fill="none" stroke="var(--gold)" strokeWidth="2.5" points={bestPts} />
        {history.map((g, i) => (
          <circle key={g.generation} cx={toX(i)} cy={toY(g.bestFitness)} r="3.5" fill="var(--gold)">
            <title>{`Gen ${g.generation}: Best ${g.bestFitness.toFixed(2)}, Mean ${g.meanFitness.toFixed(2)}`}</title>
          </circle>
        ))}
        <text x={pad} y={14} fill="var(--muted)" fontSize="10">{`Max ${maxY.toFixed(1)}`}</text>
        <text x={pad} y={h - 6} fill="var(--muted)" fontSize="10">{`Min ${minY.toFixed(1)}`}</text>
        <text x={w - pad} y={14} textAnchor="end" fill="var(--gold)" fontSize="10">● Best</text>
        <text x={w - pad - 48} y={14} textAnchor="end" fill="var(--accent)" fontSize="10">--- Mean</text>
      </svg>
    </div>
  );
}
