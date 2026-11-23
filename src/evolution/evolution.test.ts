import { describe, expect, it } from 'vitest';
import { BotRegistry, RandomBot } from '../bots';
import { CornerCoord, FLOWER_COLORS, Game } from '../game';
import type { FlowerColor } from '../game';
import { SeededRandomSource } from '../rng';
import { GameRunner } from '../simulation';
import { EvolvedBot, GENE_SPECS, Genome } from './index';
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

  it('EVO-02: EvolvedBot plays full games via GameRunner, outperforms RandomBot, and respects bloom scarcity weights', () => {
    const hGenome = Genome.heuristicSeed('h0');
    const hBot = new EvolvedBot(hGenome);
    expect(hBot.id).toBe('evolved-h0');
    expect(hBot.name).toBe('Evolved (h0)');
    expect(hBot.genome).toBe(hGenome);
    expect(hBot.description.length).toBeGreaterThan(0);

    const named = new EvolvedBot(Genome.greedySeed('g0'), 'Custom Greedy');
    expect(named.name).toBe('Custom Greedy');

    const registry = BotRegistry.createDefault();
    registry.register(hBot);
    expect(registry.require(hBot.id)).toBe(hBot);

    const randGenomeBot = new EvolvedBot(Genome.random('rand', new SeededRandomSource(99)));
    const baseline = new RandomBot();
    let hScore = 0;
    let rScore = 0;
    for (let s = 1; s <= 20; s += 1) {
      const hRes = new GameRunner(hBot, s).runToCompletion();
      const gRes = new GameRunner(named, s).runToCompletion();
      const rgRes = new GameRunner(randGenomeBot, s).runToCompletion();
      const bRes = new GameRunner(baseline, s).runToCompletion();
      expect(hRes.score).toBeGreaterThanOrEqual(0);
      expect(gRes.score).toBeGreaterThanOrEqual(0);
      expect(rgRes.score).toBeGreaterThanOrEqual(0);
      hScore += hRes.score;
      rScore += bRes.score;
    }
    expect(hScore / 20).toBeGreaterThan(10);
    expect(hScore / 20).toBeGreaterThan(rScore / 20);

    // bloomScarcityPriority positive prefers scarcer unseen color; negative prefers more common
    const game = Game.create(new SeededRandomSource(1));
    const unseenCounts = new Map<FlowerColor, number>(FLOWER_COLORS.map((c) => [c, 0]));
    for (const t of game.unseenTiles) for (const c of t.baseEdges) unseenCounts.set(c, (unseenCounts.get(c) ?? 0) + 1);
    const sorted = [...FLOWER_COLORS].sort((a, b) => (unseenCounts.get(a) ?? 0) - (unseenCounts.get(b) ?? 0));
    const scarce = sorted[0]!;
    const common = sorted[sorted.length - 1]!;
    expect(unseenCounts.get(scarce)!).toBeLessThan(unseenCounts.get(common)!);

    const pending = [{ corner: new CornerCoord(0, 0), eligibleColors: [common, scarce] as readonly FlowerColor[] }];
    const posBot = new EvolvedBot(new Genome('pos', { ...hGenome.weights, bloomScarcityPriority: 100, bloomFrontierScarcityPriority: 0 }));
    const negBot = new EvolvedBot(new Genome('neg', { ...hGenome.weights, bloomScarcityPriority: -50, bloomFrontierScarcityPriority: 0 }));
    const move = game.validPlacements[0]!;
    expect(posBot.chooseBlooms(game, move, pending, new SeededRandomSource(1))[0]!.color).toBe(scarce);
    expect(negBot.chooseBlooms(game, move, pending, new SeededRandomSource(1))[0]!.color).toBe(common);
  });
});
