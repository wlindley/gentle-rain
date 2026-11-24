import { useState } from 'react';
import { describeGenome, Genome } from '../evolution';
import type { GenomeEvaluation } from '../evolution';

export interface ChampionCardProps {
  readonly champion: GenomeEvaluation | null;
  readonly onSendToSimulator: (genome: Genome, evaluation: GenomeEvaluation | null) => void;
}

type InspectedState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'champion'; readonly evaluation: GenomeEvaluation }
  | { readonly kind: 'imported'; readonly genome: Genome };

export function ChampionCard({ champion, onSendToSimulator }: ChampionCardProps) {
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importedGenome, setImportedGenome] = useState<Genome | null>(null);

  const inspected: InspectedState = importedGenome
    ? { kind: 'imported', genome: importedGenome }
    : champion
      ? { kind: 'champion', evaluation: champion }
      : { kind: 'empty' };
  const activeGenome = inspected.kind === 'imported' ? inspected.genome : inspected.kind === 'champion' ? inspected.evaluation.genome : null;
  const summary = activeGenome ? describeGenome(activeGenome) : null;

  const handleCopy = async () => {
    if (!activeGenome) return;
    try {
      await navigator.clipboard?.writeText(JSON.stringify(activeGenome.toJSON(), null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setImportError('Clipboard access unavailable in this browser context.');
    }
  };

  const handleImport = () => {
    try {
      setImportedGenome(Genome.fromJSON(importText));
      setImportError(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid genome JSON');
    }
  };

  return (
    <section className="panel" aria-label="Champion strategy inspector">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>
          {inspected.kind === 'imported' ? `Imported Genome (${inspected.genome.id})` : 'Best Evolved Champion'}
        </h2>
        <div className="btn-group" style={{ marginLeft: 0 }}>
          {inspected.kind === 'imported' && (
            <button type="button" onClick={() => setImportedGenome(null)}>Back to Champion</button>
          )}
          <button type="button" disabled={inspected.kind === 'empty'} onClick={handleCopy}>
            {copied ? 'Copied JSON!' : 'Copy Genome JSON'}
          </button>
          <button
            type="button"
            className="gold"
            disabled={inspected.kind === 'empty'}
            onClick={() => {
              if (inspected.kind === 'imported') onSendToSimulator(inspected.genome, null);
              else if (inspected.kind === 'champion') onSendToSimulator(inspected.evaluation.genome, inspected.evaluation);
            }}
          >
            Send to Simulator
          </button>
        </div>
      </div>

      {inspected.kind === 'champion' && (
        <div className="kpi-grid">
          <div className="kpi"><div className="kpi-label">Fitness</div><div className="kpi-value">{inspected.evaluation.fitness.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">Win Rate</div><div className="kpi-value">{(inspected.evaluation.winRate * 100).toFixed(1)}%</div></div>
          <div className="kpi"><div className="kpi-label">Mean</div><div className="kpi-value">{inspected.evaluation.meanScore.toFixed(2)}</div></div>
          <div className="kpi"><div className="kpi-label">Median</div><div className="kpi-value">{inspected.evaluation.medianScore.toFixed(1)}</div></div>
          <div className="kpi"><div className="kpi-label">p95 / p99</div><div className="kpi-value">{inspected.evaluation.p95Score} / {inspected.evaluation.p99Score}</div></div>
          <div className="kpi"><div className="kpi-label">Max</div><div className="kpi-value">{inspected.evaluation.maxScore}</div></div>
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
