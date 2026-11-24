import { describe, expect, it } from 'vitest';
import { BotRegistry, RandomBot } from '../bots';
import { CornerCoord, FLOWER_COLORS, Game, GameResult } from '../game';
import type { FlowerColor } from '../game';
import { SeededRandomSource } from '../rng';
import { GameRunner, SimulationStats } from '../simulation';
import type { StorageLike } from '../simulation';
import {
  computeFitness,
  DEFAULT_GA_CONFIG,
  describeGenome,
  evaluateGenome,
  EvolvedBot,
  GENE_SPECS,
  GeneticAlgorithm,
  Genome,
  InMemoryEvolutionStore,
  LocalStorageEvolutionStore,
} from './index';
import type { EvolutionCheckpoint, FitnessFunction, GenomeEvaluation, GeneWeights, SavedChampion } from './index';

describe('Genome', () => {
  it('defines 20 unique GENE_SPECS and valid heuristic and greedy seeds', () => {
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
  });

  it('clamps out-of-range weights and rejects invalid ids, generations, or non-finite weights', () => {
    const base = Genome.heuristicSeed('base').weights;
    const clamped = new Genome('clamped', { ...base, immediateBloomWeight: 9999, deadPocket4Penalty: -9999 }, 2);
    expect(clamped.generation).toBe(2);
    expect(clamped.weights.immediateBloomWeight).toBe(200);
    expect(clamped.weights.deadPocket4Penalty).toBe(-180);

    expect(() => new Genome('', base)).toThrow();
    expect(() => new Genome('bad-gen', base, -1)).toThrow();
    expect(() => new Genome('bad-gen2', base, 1.5)).toThrow();
    expect(() => new Genome('nan-w', { ...base, immediateBloomWeight: Number.NaN })).toThrow();
    expect(() => new Genome('inf-w', { ...base, multiBloomBonus: Number.POSITIVE_INFINITY })).toThrow();
  });

  it('generates deterministic random genomes within gene bounds', () => {
    const r1 = Genome.random('r', new SeededRandomSource(42), 1);
    const r2 = Genome.random('r', new SeededRandomSource(42), 1);
    expect(r1.weights).toEqual(r2.weights);
    for (const spec of GENE_SPECS) {
      expect(r1.weights[spec.key]).toBeGreaterThanOrEqual(spec.min);
      expect(r1.weights[spec.key]).toBeLessThanOrEqual(spec.max);
    }
  });

  it('round-trips via toJSON, fromJSON, and fromSerialized and rejects malformed inputs', () => {
    const original = Genome.random('r', new SeededRandomSource(42), 1);
    const serialized = original.toJSON();
    const fromObj = Genome.fromSerialized(serialized);
    expect(fromObj).toBeInstanceOf(Genome);
    expect([fromObj.id, fromObj.generation, fromObj.weights]).toEqual([original.id, 1, original.weights]);

    const parsed = Genome.fromJSON(JSON.stringify(serialized));
    expect([parsed.id, parsed.generation, parsed.weights]).toEqual([original.id, 1, original.weights]);

    expect(() => Genome.fromSerialized(null)).toThrow();
    expect(() => Genome.fromSerialized('nope')).toThrow();
    expect(() => Genome.fromSerialized([])).toThrow();
    expect(() => Genome.fromSerialized({ id: 'x', generation: 0 })).toThrow();
    expect(() => Genome.fromJSON('{bad')).toThrow();
    expect(() => Genome.fromJSON(JSON.stringify({ id: 'x', generation: 0, weights: {} }))).toThrow();
    const badWeights: Record<string, unknown> = { ...(original.weights as GeneWeights), immediateBloomWeight: 'nope' };
    expect(() => Genome.fromJSON(JSON.stringify({ id: 'x', generation: 0, weights: badWeights }))).toThrow();
  });
});

describe('EvolvedBot', () => {
  it('exposes metadata, registers in BotRegistry, and outperforms RandomBot across 20 games', () => {
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
  });

  it('respects positive and negative bloomScarcityPriority in chooseBlooms', () => {
    const base = Genome.heuristicSeed('h0').weights;
    const game = Game.create(new SeededRandomSource(1));
    const unseenCounts = new Map<FlowerColor, number>(FLOWER_COLORS.map((c) => [c, 0]));
    for (const t of game.unseenTiles) for (const c of t.baseEdges) unseenCounts.set(c, (unseenCounts.get(c) ?? 0) + 1);
    const sorted = [...FLOWER_COLORS].sort((a, b) => (unseenCounts.get(a) ?? 0) - (unseenCounts.get(b) ?? 0));
    const scarce = sorted[0]!;
    const common = sorted[sorted.length - 1]!;
    expect(unseenCounts.get(scarce)!).toBeLessThan(unseenCounts.get(common)!);

    const pending = [{ corner: new CornerCoord(0, 0), eligibleColors: [common, scarce] as readonly FlowerColor[] }];
    const posBot = new EvolvedBot(new Genome('pos', { ...base, bloomScarcityPriority: 100, bloomFrontierScarcityPriority: 0 }));
    const negBot = new EvolvedBot(new Genome('neg', { ...base, bloomScarcityPriority: -50, bloomFrontierScarcityPriority: 0 }));
    const move = game.validPlacements[0]!;
    expect(posBot.chooseBlooms(game.activeView!, move, pending, new SeededRandomSource(1))[0]!.color).toBe(scarce);
    expect(negBot.chooseBlooms(game.activeView!, move, pending, new SeededRandomSource(1))[0]!.color).toBe(common);
  });
});

describe('Fitness', () => {
  it('computes 4*mean + median + 0.5*p95 with 0 on empty stats', () => {
    expect(computeFitness(new SimulationStats())).toBe(0);
    const stats = new SimulationStats([
      new GameResult({ placedFlowers: 4, remainingDrawCount: 0, placedTilesCount: 26, discardedTilesCount: 2, turnsPlayed: 27 }),
      new GameResult({ placedFlowers: 8, remainingDrawCount: 4, placedTilesCount: 24, discardedTilesCount: 0, turnsPlayed: 23 }),
      new GameResult({ placedFlowers: 8, remainingDrawCount: 8, placedTilesCount: 20, discardedTilesCount: 0, turnsPlayed: 19 }),
    ]);
    expect(computeFitness(stats)).toBeCloseTo(4 * stats.meanScore + stats.medianScore + 0.5 * stats.p95Score);
  });

  it('evaluates deterministically per seed, validates gamesPerGenome, and supports custom FitnessFunction', () => {
    const g = Genome.heuristicSeed('eval');
    expect(() => evaluateGenome(g, 0, 1)).toThrow();
    expect(() => evaluateGenome(g, 1.5, 1)).toThrow();

    const e1 = evaluateGenome(g, 10, 101);
    const e2 = evaluateGenome(g, 10, 101);
    const eOther = evaluateGenome(g, 10, 202);
    expect(e1).toEqual(e2);
    expect(e1.gamesPlayed).toBe(10);
    expect(e1.fitness).toBeCloseTo(4 * e1.meanScore + e1.medianScore + 0.5 * e1.p95Score);
    expect(e1.meanScore).not.toBe(eOther.meanScore);

    const winRateOnly: FitnessFunction = (stats) => stats.winRate * 100;
    const customEval = evaluateGenome(g, 10, 101, undefined, winRateOnly);
    expect(customEval.fitness).toBeCloseTo(e1.winRate * 100);
    expect(customEval.meanScore).toBe(e1.meanScore);
  });
});

describe('StrategyDescriber', () => {
  it('translates contrasting genomes into distinct English summaries and ranked topDrivers', () => {
    const h = Genome.heuristicSeed('h');
    const summaryH = describeGenome(h);
    expect(summaryH.headline.length).toBeGreaterThan(0);
    expect(summaryH.bullets.length).toBeGreaterThanOrEqual(4);
    expect(summaryH.topDrivers.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < summaryH.topDrivers.length; i += 1) {
      expect(Math.abs(summaryH.topDrivers[i - 1]!.normalizedWeight)).toBeGreaterThanOrEqual(
        Math.abs(summaryH.topDrivers[i]!.normalizedWeight),
      );
    }

    const contrast = new Genome('contrast', {
      ...h.weights,
      immediateBloomWeight: -20,
      bloomUrgencyLateSlope: -80,
      deadPocket2Penalty: 15,
      deadPocket3Penalty: 15,
      deadPocket4Penalty: 15,
      boundingBoxGrowthWeight: 18,
      neighborCountWeight: -20,
      bloomScarcityPriority: -40,
      bloomFrontierScarcityPriority: -40,
    });
    const summaryC = describeGenome(contrast);
    expect(summaryC.headline).not.toBe(summaryH.headline);
    expect(summaryC.bullets).not.toEqual(summaryH.bullets);
  });
});

describe('GeneticAlgorithm', () => {
  it('validates config and builds warm-start or cold-start initial populations', () => {
    expect(DEFAULT_GA_CONFIG.populationSize).toBe(24);
    expect(DEFAULT_GA_CONFIG.gamesPerGenome).toBe(5000);

    const gaWarm = new GeneticAlgorithm({ populationSize: 6, gamesPerGenome: 10, eliteCount: 2, immigrantCount: 1 });
    const popWarm = gaWarm.createInitialPopulation(new SeededRandomSource(11));
    expect(popWarm).toHaveLength(6);
    expect(popWarm.every((g) => g.generation === 1)).toBe(true);
    expect(popWarm[0]!.weights).toEqual(Genome.heuristicSeed().weights);
    expect(popWarm[1]!.weights).toEqual(Genome.greedySeed().weights);

    const gaCold = new GeneticAlgorithm({ populationSize: 6, gamesPerGenome: 10, warmStart: false });
    const popCold = gaCold.createInitialPopulation(new SeededRandomSource(11));
    expect(popCold).toHaveLength(6);
    expect(popCold[0]!.weights).not.toEqual(Genome.heuristicSeed().weights);

    expect(() => new GeneticAlgorithm({ populationSize: 3 })).toThrow();
    expect(() => new GeneticAlgorithm({ gamesPerGenome: 0 })).toThrow();
    expect(() => new GeneticAlgorithm({ eliteCount: 0 })).toThrow();
    expect(() => new GeneticAlgorithm({ populationSize: 4, eliteCount: 3, immigrantCount: 2 })).toThrow();
    expect(() => new GeneticAlgorithm({ tournamentSize: 1 })).toThrow();
    expect(() => new GeneticAlgorithm({ crossoverRate: 1.2 })).toThrow();
    expect(() => new GeneticAlgorithm({ mutationRate: -0.1 })).toThrow();
    expect(() => new GeneticAlgorithm({ mutationSigma: 0 })).toThrow();
  });

  it('preserves elites, clamps genes, summarizes fitness, and evolves deterministically', () => {
    const ga = new GeneticAlgorithm({ populationSize: 6, gamesPerGenome: 5, eliteCount: 2, immigrantCount: 1 });
    expect(() => ga.evolveGeneration([], new SeededRandomSource(1))).toThrow();

    const pop = ga.createInitialPopulation(new SeededRandomSource(5));
    const evals: GenomeEvaluation[] = pop.map((genome, idx) => ({
      genome,
      generation: 1,
      gamesPlayed: 5,
      fitness: (idx + 1) * 10,
      winRate: 0.5,
      meanScore: idx + 5,
      medianScore: idx + 5,
      p95Score: idx + 8,
      p99Score: idx + 9,
      maxScore: idx + 10,
      meanBlooms: 7,
    }));

    const step1 = ga.evolveGeneration(evals, new SeededRandomSource(77));
    const step2 = ga.evolveGeneration(evals, new SeededRandomSource(77));
    expect(step1.nextPopulation).toEqual(step2.nextPopulation);
    expect(step1.nextPopulation).toHaveLength(6);
    expect(step1.nextPopulation.every((g) => g.generation === 2)).toBe(true);
    expect(step1.nextPopulation[0]!.weights).toEqual(pop[5]!.weights);
    expect(step1.nextPopulation[1]!.weights).toEqual(pop[4]!.weights);

    expect(step1.summary.generation).toBe(1);
    expect(step1.summary.bestFitness).toBe(60);
    expect(step1.summary.meanFitness).toBeCloseTo(35);
    expect(step1.summary.champion.genome.id).toBe(pop[5]!.id);

    for (const child of step1.nextPopulation) {
      for (const spec of GENE_SPECS) {
        expect(child.weights[spec.key]).toBeGreaterThanOrEqual(spec.min);
        expect(child.weights[spec.key]).toBeLessThanOrEqual(spec.max);
      }
    }

    const gaNoCross = new GeneticAlgorithm({ populationSize: 6, gamesPerGenome: 5, crossoverRate: 0, mutationRate: 1 });
    expect(gaNoCross.evolveGeneration(evals, new SeededRandomSource(77)).nextPopulation).toHaveLength(6);
  });
});

describe('EvolutionStore', () => {
  const makeFixtures = (): { g: Genome; checkpoint: EvolutionCheckpoint; champion: SavedChampion } => {
    const g = Genome.heuristicSeed('champ-1');
    const evaluation: GenomeEvaluation = {
      genome: g, generation: 2, gamesPlayed: 50, fitness: 75, winRate: 0.9,
      meanScore: 14, medianScore: 14, p95Score: 18, p99Score: 19, maxScore: 20, meanBlooms: 7.9,
    };
    const checkpoint: EvolutionCheckpoint = {
      config: DEFAULT_GA_CONFIG,
      generation: 2,
      population: [g],
      history: [{ generation: 1, bestFitness: 75, meanFitness: 60, champion: evaluation }],
      bestEver: evaluation,
    };
    const champion: SavedChampion = { id: 'c1', name: 'Gen2 Champ', savedAtIso: '2026-01-01T00:00:00.000Z', evaluation };
    return { g, checkpoint, champion };
  };

  it('InMemoryEvolutionStore saves, returns defensive copies, and clears checkpoints and champions', () => {
    const { checkpoint, champion } = makeFixtures();
    const mem = new InMemoryEvolutionStore();
    expect(mem.loadCheckpoint()).toBeNull();
    expect(mem.loadChampions()).toEqual([]);
    mem.saveCheckpoint(checkpoint);
    mem.saveChampion(champion);
    expect(mem.loadCheckpoint()?.bestEver?.genome).toBeInstanceOf(Genome);
    const loadedChamps = mem.loadChampions();
    expect(loadedChamps).toHaveLength(1);
    (loadedChamps as SavedChampion[]).push(champion);
    expect(mem.loadChampions()).toHaveLength(1);
    mem.clearCheckpoint();
    mem.clearChampions();
    expect(mem.loadCheckpoint()).toBeNull();
    expect(mem.loadChampions()).toEqual([]);
  });

  it('LocalStorageEvolutionStore persists, rehydrates Genomes, recovers from bad JSON, and clears', () => {
    const { g, checkpoint, champion } = makeFixtures();
    const backing = new Map<string, string>();
    const fakeStorage: StorageLike = {
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => { backing.set(k, v); },
      removeItem: (k) => { backing.delete(k); },
    };
    const ls = new LocalStorageEvolutionStore('gr.evo.test', fakeStorage);
    expect(ls.loadCheckpoint()).toBeNull();
    expect(ls.loadChampions()).toEqual([]);

    ls.saveCheckpoint(checkpoint);
    const rehydrated = ls.loadCheckpoint()!;
    expect(rehydrated.population[0]).toBeInstanceOf(Genome);
    expect(rehydrated.bestEver?.genome).toBeInstanceOf(Genome);
    expect(rehydrated.history[0]!.champion.genome).toBeInstanceOf(Genome);
    expect(rehydrated.bestEver?.genome.weights).toEqual(g.weights);

    ls.saveCheckpoint({ ...checkpoint, bestEver: null });
    expect(ls.loadCheckpoint()?.bestEver).toBeNull();

    ls.saveChampion(champion);
    expect(ls.loadChampions()[0]!.evaluation.genome).toBeInstanceOf(Genome);

    for (const key of backing.keys()) backing.set(key, '{bad-json');
    expect(ls.loadCheckpoint()).toBeNull();
    expect(ls.loadChampions()).toEqual([]);

    for (const key of backing.keys()) backing.set(key, JSON.stringify(123));
    expect(ls.loadCheckpoint()).toBeNull();
    expect(ls.loadChampions()).toEqual([]);

    ls.saveCheckpoint(checkpoint);
    ls.saveChampion(champion);
    ls.clearCheckpoint();
    ls.clearChampions();
    expect(ls.loadCheckpoint()).toBeNull();
    expect(ls.loadChampions()).toEqual([]);
  });
});
