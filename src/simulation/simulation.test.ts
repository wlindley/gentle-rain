import { describe, expect, it } from 'vitest';
import { BotRegistry, GreedyBloomBot, RandomBot } from '../bots';
import { GameResult } from '../game';
import {
  GameRunner,
  InMemoryScoreStore,
  LocalStorageScoreStore,
  SimulationSession,
  SimulationStats,
  TournamentRunner,
} from './index';
import type { BotRunRecord } from './index';

describe('src/simulation', () => {
  it('SIM-01: GameRunner steps turn-by-turn and matches runToCompletion for the same (bot, seed)', () => {
    const bot = new RandomBot();
    const stepped = new GameRunner(bot, 77);
    expect(stepped.bot).toBe(bot);
    expect(stepped.seed).toBe(77);
    expect(stepped.isComplete).toBe(false);

    let sawPlaced = false;
    while (!stepped.isComplete) {
      const outcome = stepped.step();
      expect(outcome).not.toBeNull();
      if (outcome?.kind === 'placed') sawPlaced = true;
    }
    expect(sawPlaced).toBe(true);
    expect(stepped.step()).toBeNull();
    expect(stepped.toSnapshot().isComplete).toBe(true);

    const direct = new GameRunner(bot, 77).runToCompletion();
    expect(stepped.game.result).toEqual(direct);

    // Also verify a game that includes a discard steps cleanly to completion
    const greedy = new GreedyBloomBot();
    let sawDiscard = false;
    for (let s = 1; s <= 30 && !sawDiscard; s += 1) {
      const runner = new GameRunner(greedy, s);
      while (!runner.isComplete) {
        if (runner.step()?.kind === 'discarded') sawDiscard = true;
      }
    }
    expect(sawDiscard).toBe(true);
  });

  it('SIM-02: SimulationStats handles empty state and computes exact rates, medians, percentiles, stdDev, and histograms', () => {
    const empty = new SimulationStats();
    expect(empty.totalGames).toBe(0);
    expect(empty.winCount).toBe(0);
    expect(empty.winRate).toBe(0);
    expect(empty.meanScore).toBe(0);
    expect(empty.medianScore).toBe(0);
    expect(empty.p95Score).toBe(0);
    expect(empty.p99Score).toBe(0);
    expect(empty.stdDevScore).toBe(0);
    expect(empty.minScore).toBe(0);
    expect(empty.maxScore).toBe(0);
    expect(empty.meanBlooms).toBe(0);
    expect(empty.meanDiscards).toBe(0);
    expect(empty.scoreHistogram.size).toBe(0);
    expect(empty.bloomHistogram).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const mk = (flowers: number, rem: number, discards = 0) =>
      new GameResult({
        placedFlowers: flowers,
        remainingDrawCount: rem,
        placedTilesCount: 28 - rem - discards,
        discardedTilesCount: discards,
        turnsPlayed: 27 - rem,
      });

    // Odd count (3): scores [4, 10, 12] -> median 10, mean 26/3
    const odd = new SimulationStats([mk(4, 0, 2), mk(8, 2, 1), mk(8, 4, 0)]);
    expect(odd.totalGames).toBe(3);
    expect([odd.scores, odd.bloomCounts, odd.totalDiscards]).toEqual([[4, 10, 12], [4, 8, 8], 3]);
    expect(odd.winCount).toBe(2);
    expect(odd.winRate).toBeCloseTo(2 / 3);
    expect(odd.meanScore).toBeCloseTo(26 / 3);
    expect(odd.medianScore).toBe(10);
    expect(odd.minScore).toBe(4);
    expect(odd.maxScore).toBe(12);
    expect(odd.meanBlooms).toBeCloseTo(20 / 3);
    expect(odd.meanDiscards).toBeCloseTo(1);
    expect(odd.scoreHistogram.get(10)).toBe(1);
    expect(odd.bloomHistogram[4]).toBe(1);
    expect(odd.bloomHistogram[8]).toBe(2);

    // Even count (4): scores [4, 6, 10, 12] -> median 8, stdDev sqrt(((16+4+4+16)/4)) = sqrt(10)
    odd.record(mk(6, 0, 1));
    expect(odd.medianScore).toBe(8);
    expect(odd.stdDevScore).toBeCloseTo(Math.sqrt(10));

    // Nearest-rank p95 / p99 on n = 100: 94x5, 4x12, 1x15, 1x18
    const dist = new SimulationStats();
    for (let i = 0; i < 94; i += 1) dist.record(mk(5, 0));
    for (let i = 0; i < 4; i += 1) dist.record(mk(8, 4));
    dist.record(mk(8, 7));
    dist.record(mk(8, 10));
    expect(dist.medianScore).toBe(5);
    expect(dist.p95Score).toBe(12);
    expect(dist.p99Score).toBe(15);
    expect(dist.maxScore).toBe(18);
  });

  const makeRecord = (id: string, meanScore: number): BotRunRecord => ({
    id,
    botId: 'heuristic',
    botName: 'Heuristic Bot',
    timestampIso: '2026-01-01T00:00:00.000Z',
    baseSeed: 42,
    totalGames: 100,
    winCount: 80,
    winRate: 0.8,
    meanScore,
    medianScore: 10,
    p95Score: 15,
    p99Score: 17,
    minScore: 4,
    maxScore: 18,
    meanBlooms: 7.6,
    scoreHistogram: { '10': 50, '15': 50 },
  });

  it('SIM-03: InMemoryScoreStore saves in order, returns defensive copies, and clears', () => {
    const store = new InMemoryScoreStore();
    expect(store.loadAll()).toEqual([]);

    const r1 = makeRecord('r1', 10.5);
    const r2 = makeRecord('r2', 11.2);
    store.save(r1);
    store.save(r2);

    const loaded = store.loadAll();
    expect(loaded).toEqual([r1, r2]);
    expect(loaded[0]!.p95Score).toBe(15);
    expect(loaded[0]!.p99Score).toBe(17);

    (loaded as BotRunRecord[]).push(makeRecord('mutated', 0));
    expect(store.loadAll()).toHaveLength(2);

    store.clear();
    expect(store.loadAll()).toEqual([]);
  });

  it('SIM-04: LocalStorageScoreStore persists JSON via injected storage, recovers from malformed JSON, and clears', () => {
    const backing = new Map<string, string>();
    const fakeStorage = {
      getItem: (key: string): string | null => backing.get(key) ?? null,
      setItem: (key: string, value: string): void => { backing.set(key, value); },
      removeItem: (key: string): void => { backing.delete(key); },
    };

    const store = new LocalStorageScoreStore('gr.test.runs', fakeStorage);
    expect(store.loadAll()).toEqual([]);

    const r1 = makeRecord('r1', 9.8);
    const r2 = makeRecord('r2', 12.1);
    store.save(r1);
    store.save(r2);
    expect(store.loadAll()).toEqual([r1, r2]);
    expect(backing.has('gr.test.runs')).toBe(true);

    backing.set('gr.test.runs', '{not-valid-json');
    expect(store.loadAll()).toEqual([]);

    backing.set('gr.test.runs', JSON.stringify({ notAnArray: true }));
    expect(store.loadAll()).toEqual([]);

    store.save(r1);
    store.clear();
    expect(backing.has('gr.test.runs')).toBe(false);
    expect(store.loadAll()).toEqual([]);
  });

  it('SIM-05: SimulationSession recycles slots, tracks best/worst snapshots, and yields identical stats via stepTurns vs stepGames', () => {
    const bot = new GreedyBloomBot();
    const small = new SimulationSession({ bot, targetGames: 2, parallelSlots: 5, baseSeed: 100 });
    expect(small.slotViews).toHaveLength(2);
    expect(small.completedGames).toBe(0);
    expect(small.remainingGames).toBe(2);
    expect(small.isComplete).toBe(false);
    expect(small.bestSnapshot).toBeNull();
    expect(small.worstSnapshot).toBeNull();

    expect(() => new SimulationSession({ bot, targetGames: 0, parallelSlots: 2, baseSeed: 1 })).toThrow();
    expect(() => new SimulationSession({ bot, targetGames: 2, parallelSlots: 0, baseSeed: 1 })).toThrow();
    expect(() => new SimulationSession({ bot, targetGames: 1.5, parallelSlots: 2, baseSeed: 1 })).toThrow();

    const byTurns = new SimulationSession({ bot, targetGames: 10, parallelSlots: 3, baseSeed: 500 });
    expect(byTurns.slotViews).toHaveLength(3);
    while (!byTurns.isComplete) byTurns.stepTurns(1);
    expect(byTurns.completedGames).toBe(10);
    expect(byTurns.remainingGames).toBe(0);
    expect(byTurns.stepTurns(1)).toBe(0);
    expect(byTurns.stepGames(5)).toBe(0);
    expect(byTurns.bestSnapshot?.score).toBe(byTurns.stats.maxScore);
    expect(byTurns.worstSnapshot?.score).toBe(byTurns.stats.minScore);

    const byGames = new SimulationSession({ bot, targetGames: 10, parallelSlots: 3, baseSeed: 500 });
    expect(byGames.stepGames(4)).toBe(4);
    expect(byGames.completedGames).toBe(4);
    expect(byGames.stepGames(10)).toBe(6);
    expect(byGames.isComplete).toBe(true);

    expect(byTurns.stats.winCount).toBe(byGames.stats.winCount);
    expect(byTurns.stats.meanScore).toBe(byGames.stats.meanScore);
    expect(byTurns.stats.medianScore).toBe(byGames.stats.medianScore);
    expect(byTurns.stats.p95Score).toBe(byGames.stats.p95Score);
    expect(byTurns.stats.p99Score).toBe(byGames.stats.p99Score);
    expect([...byTurns.stats.scores].sort((a, b) => a - b)).toEqual(
      [...byGames.stats.scores].sort((a, b) => a - b),
    );
  });

  it('SIM-06: SimulationSession.toRunRecord exports accurate BotRunRecord that round-trips through ScoreStore', () => {
    const session = new SimulationSession({ bot: new RandomBot(), targetGames: 6, parallelSlots: 2, baseSeed: 321 });
    session.stepGames(6);

    const explicit = session.toRunRecord('run-1', '2026-01-01T12:00:00.000Z', true);
    expect(explicit.id).toBe('run-1');
    expect(explicit.botId).toBe('random');
    expect(explicit.baseSeed).toBe(321);
    expect(explicit.totalGames).toBe(6);
    expect(explicit.p95Score).toBe(session.stats.p95Score);
    expect(explicit.p99Score).toBe(session.stats.p99Score);
    expect(explicit.meanScore).toBe(session.stats.meanScore);
    expect(Object.values(explicit.scoreHistogram).reduce((a, b) => a + b, 0)).toBe(6);

    const implicit = session.toRunRecord('run-2', '2026-01-01T12:01:00.000Z', false);
    expect(implicit.baseSeed).toBeNull();

    const store = new InMemoryScoreStore();
    store.save(explicit);
    expect(store.loadAll()).toEqual([explicit]);
  });

  it('SIM-07: TournamentRunner runs all bots on identical seeds and ranks summaries by meanScore descending', () => {
    const bots = BotRegistry.createDefault().bots;
    const tournament = new TournamentRunner({ bots, targetGames: 20, parallelSlots: 4, baseSeed: 2026 });
    expect(() => new TournamentRunner({ bots: [], targetGames: 10, parallelSlots: 2, baseSeed: 1 })).toThrow();
    expect(tournament.sessions).toHaveLength(3);
    expect(tournament.isComplete).toBe(false);

    while (!tournament.isComplete) {
      tournament.stepGamesAll(5);
    }
    expect(tournament.isComplete).toBe(true);
    for (const session of tournament.sessions) {
      expect(session.completedGames).toBe(20);
      expect(session.config.baseSeed).toBe(2026);
    }

    const ranked = tournament.rankedSummaries;
    expect(ranked).toHaveLength(3);
    expect(ranked[0]!.stats.meanScore).toBeGreaterThanOrEqual(ranked[1]!.stats.meanScore);
    expect(ranked[1]!.stats.meanScore).toBeGreaterThanOrEqual(ranked[2]!.stats.meanScore);
    expect(ranked[2]!.bot.id).toBe('random');
    expect(ranked[0]!.stats.meanScore).toBeGreaterThan(ranked[2]!.stats.meanScore);
  });
});
