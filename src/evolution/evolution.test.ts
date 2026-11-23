import { describe, expect, it } from 'vitest';
import { SeededRandomSource } from '../rng';
import { GENE_SPECS, Genome } from './index';
import type { GeneWeights } from './index';

describe('src/evolution', () => {
  it('EVO-01: Genome validates/clamps 20 gene weights, seeds deterministically, and round-trips JSON', () => {
    expect(GENE_SPECS).toHaveLength(20);
    expect(new Set(GENE_SPECS.map((s) => s.key)).size).toBe(20);
    for (const spec of GENE_SPECS) expect(spec.min).toBeLessThan(spec.max);

    const heuristic = Genome.heuristicSeed('heur');
    const greedy = Genome.greedySeed('greed');
    expect(heuristic.id).toBe('heur');
    expect(greedy.id).toBe('greed');
    expect(heuristic.weights.immediateBloomWeight).toBeGreaterThan(0);
    expect(heuristic.weights.deadPocket2Penalty).toBeLessThan(0);
    expect(greedy.weights.immediateBloomWeight).toBeGreaterThan(0);

    // Clamping out-of-range values
    const clamped = new Genome(
      'clamped',
      { ...heuristic.weights, immediateBloomWeight: 9999, deadPocket4Penalty: -9999 },
      2,
    );
    expect(clamped.generation).toBe(2);
    expect(clamped.weights.immediateBloomWeight).toBe(200);
    expect(clamped.weights.deadPocket4Penalty).toBe(-180);

    // Validation rejections
    expect(() => new Genome('', heuristic.weights)).toThrow();
    expect(() => new Genome('bad-gen', heuristic.weights, -1)).toThrow();
    expect(() => new Genome('bad-gen2', heuristic.weights, 1.5)).toThrow();
    expect(
      () => new Genome('nan-w', { ...heuristic.weights, immediateBloomWeight: Number.NaN }),
    ).toThrow();
    expect(
      () => new Genome('inf-w', { ...heuristic.weights, multiBloomBonus: Number.POSITIVE_INFINITY }),
    ).toThrow();

    // Deterministic random generation within bounds
    const r1 = Genome.random('r', new SeededRandomSource(42), 1);
    const r2 = Genome.random('r', new SeededRandomSource(42), 1);
    expect(r1.weights).toEqual(r2.weights);
    for (const spec of GENE_SPECS) {
      expect(r1.weights[spec.key]).toBeGreaterThanOrEqual(spec.min);
      expect(r1.weights[spec.key]).toBeLessThanOrEqual(spec.max);
    }

    // JSON round-trip & invalid JSON rejection
    const json = JSON.stringify(r1.toJSON());
    const parsed = Genome.fromJSON(json);
    expect(parsed.id).toBe(r1.id);
    expect(parsed.generation).toBe(1);
    expect(parsed.weights).toEqual(r1.weights);

    expect(() => Genome.fromJSON('{bad')).toThrow();
    expect(() => Genome.fromJSON('[]')).toThrow();
    expect(() => Genome.fromJSON(JSON.stringify({ id: 'x', generation: 0, weights: {} }))).toThrow();
    const badWeights: Record<string, unknown> = { ...(r1.weights as GeneWeights), immediateBloomWeight: 'nope' };
    expect(() => Genome.fromJSON(JSON.stringify({ id: 'x', generation: 0, weights: badWeights }))).toThrow();
  });
});
