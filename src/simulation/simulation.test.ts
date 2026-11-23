import { describe, expect, it } from 'vitest';
import { GreedyBloomBot, RandomBot } from '../bots';
import { GameResult } from '../game';
import { GameRunner, SimulationStats } from './index';

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
});
