import { useState } from 'react';
import { describeGenome, Genome } from '../evolution';
import type { GenomeEvaluation } from '../evolution';

export interface ChampionCardProps {
  readonly champion: GenomeEvaluation | null;
  readonly onSendToSimulator: (genome: Genome, evaluation: GenomeEvaluation | null) => void;
}

export function ChampionCard({ champion, onSendToSimulator }: ChampionCardProps) {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importedGenome, setImportedGenome] = useState<Genome | null>(null);

  const activeGenome = importedGenome ?? champion?.genome ?? null;
  const summary = activeGenome ? describeGenome(activeGenome) : null;

  const handleCopy = async () => {
    if (!activeGenome) return;
    await navigator.clipboard?.writeText(JSON.stringify(activeGenome.toJSON(), null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const handleImport = () => {
    try {
      const parsed = Genome.fromJSON(importText);
      setImportedGenome(parsed);
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid genome JSON');
    }
  };

  return (
    <section className="panel" aria-label="Champion strategy inspector">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>
          {importedGenome ? `Imported Genome (${importedGenome.id})` : 'Best Evolved Champion'}
        </h2>
        <div className="btn-group" style={{ marginLeft: 0 }}>
          {importedGenome && (
            <button type="button" onClick={() => setImportedGenome(null)}>Back to Champion</button>
          )}
          <button type="button" disabled={!activeGenome} onClick={handleCopy}>
            {copied ? 'Copied JSON!' : 'Copy Genome JSON'}
          </button>
          <button
            type="button"
            className="gold"
            disabled={!activeGenome}
            onClick={() => activeGenome && onSendToSimulator(activeGenome, importedGenome ? null : champion)}
          >
            Send to Simulator
          </button>
        </div>
      </div>

      {champion && !importedGenome && (
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Fitness</div><div className="kpi-value">{champion.fitness.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">Win Rate</div><div className="kpi-value">{(champion.winRate * 100).toFixed(1)}%</div></div>
          <div className="kpi"><div className="kpi-label">Mean</div><div className="kpi-value">{champion.meanScore.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">Median</div><div className="kpi-value">{champion.medianScore.toFixed(1)}</div></div>
          <div className="kpi"><div className="kpi-label">p95 / p99</div><div className="kpi-value">{champion.p95Score} / {champion.p99Score}</div></div>
          <div className="kpi"><div className="kpi-label">Max</div><div className="kpi-value">{champion.maxScore}</div></div>
        </div>
      )}

      {summary ? (
        <div>
          <p style={{ margin: '0 0 0.45rem', fontWeight: 700 }}>{summary.headline}</p>
          <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1.15rem', fontSize: '0.88rem', lineHeight: 1.45 }}>
            {summary.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            <strong>Top Drivers:</strong>{' '}
            {summary.topDrivers.map((d) => `${d.label} (${d.normalizedWeight >= 0 ? '+' : ''}${Math.round(d.normalizedWeight * 100)}%)`).join(' · ')}
          </div>
        </div>
      ) : (
        <p style={{ margin: '0 0 0.75rem', color: 'var(--muted)', fontSize: '0.88rem' }}>
          Start evolution or paste a genome JSON below to inspect its English strategy description.
        </p>
      )}

      <details style={{ marginTop: '0.75rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.84rem', color: 'var(--muted)', fontWeight: 600 }}>
          Import / Analyze Genome JSON
        </summary>
        <div style={{ display: 'grid', gap: '0.45rem', marginTop: '0.5rem' }}>
          <textarea
            rows={4}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='Paste Genome JSON here (e.g. from "Copy Genome JSON")'
            aria-label="Genome JSON input"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.78rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
          />
          {importError && <span style={{ color: '#c43b3b', fontSize: '0.8rem' }}>{importError}</span>}
          <div>
            <button type="button" onClick={handleImport} disabled={!importText.trim()}>Load & Describe Genome</button>
          </div>
        </div>
      </details>
    </section>
  );
}
