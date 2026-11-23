import { describe, expect, it } from 'vitest';
import { CornerCoord, Game, GridCoord, TileCatalog } from '../game';
import type { FlowerColor } from '../game';
import { SeededRandomSource, StubRandomSource } from '../rng';
import { BloomAssignmentSolver, GreedyBloomBot, RandomBot } from './index';
import type { Bot } from './index';

describe('src/bots', () => {
  it('BOT-01: BloomAssignmentSolver.solve finds maximal distinct-color bloom assignments across 0 to 3 corners', () => {
    expect(BloomAssignmentSolver.solve([])).toEqual([]);
    expect(
      BloomAssignmentSolver.solve([{ corner: new CornerCoord(0, 0), eligibleColors: [] }]),
    ).toEqual([]);

    const single = BloomAssignmentSolver.solve([
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] },
    ]);
    expect(single).toHaveLength(1);
    expect(['red', 'blue']).toContain(single[0]!.color);

    const scarce = BloomAssignmentSolver.solve([
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] },
      { corner: new CornerCoord(1, 0), eligibleColors: ['red'] },
    ]);
    expect(scarce).toHaveLength(2);
    expect(scarce.find((b) => b.corner.key === '0,0')?.color).toBe('blue');
    expect(scarce.find((b) => b.corner.key === '1,0')?.color).toBe('red');

    const capped = BloomAssignmentSolver.solve([
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] },
      { corner: new CornerCoord(1, 0), eligibleColors: ['red'] },
      { corner: new CornerCoord(0, 1), eligibleColors: ['blue'] },
    ]);
    expect(capped).toHaveLength(2);
    expect(new Set(capped.map((b) => b.color)).size).toBe(2);
  });

  it('BOT-02: BloomAssignmentSolver.solve maximizes total colorPriority among maximal assignments', () => {
    const priority = (c: FlowerColor): number =>
      ({ red: 1, blue: 5, yellow: 10, green: 0 } as Record<string, number>)[c] ?? 0;

    const single = BloomAssignmentSolver.solve(
      [{ corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] }],
      priority,
    );
    expect(single).toEqual([{ corner: new CornerCoord(0, 0), color: 'blue' }]);

    const pair = BloomAssignmentSolver.solve(
      [
        { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'yellow'] },
        { corner: new CornerCoord(1, 0), eligibleColors: ['blue', 'yellow'] },
      ],
      priority,
    );
    expect(pair).toHaveLength(2);
    expect(pair.find((b) => b.corner.key === '0,0')?.color).toBe('yellow');
    expect(pair.find((b) => b.corner.key === '1,0')?.color).toBe('blue');
  });

  const makeOrderedGame = (frontIds: readonly number[]): Game => {
    const all = TileCatalog.defaultCatalog().tiles;
    const front = new Set(frontIds);
    const ordered = [...frontIds.map((id) => all[id]!), ...all.filter((t) => !front.has(t.id))];
    return Game.create(
      new StubRandomSource(Array.from({ length: 27 }, () => 0.9999)),
      new TileCatalog(ordered.map((t) => t.baseEdges)),
    );
  };

  const playBotGame = (bot: Bot, seed: number): Game => {
    const rng = new SeededRandomSource(seed);
    const game = Game.create(rng.derive(0));
    const botRng = rng.derive(1);
    while (!game.isComplete) {
      if (game.validPlacements.length === 0) { game.discardCurrentTile(); continue; }
      const p = bot.choosePlacement(game, botRng);
      const blooms = bot.chooseBlooms(game, p, game.eligibleBloomsFor(p), botRng);
      game.applyMove(p, blooms);
    }
    return game;
  };

  it('BOT-03: RandomBot selects legal moves deterministically and completes full games cleanly', () => {
    const bot = new RandomBot();
    expect(bot.id).toBe('random');
    const game = makeOrderedGame([0, 1]);
    const moves = game.validPlacements;
    expect(moves.length).toBeGreaterThan(1);
    expect(bot.choosePlacement(game, new StubRandomSource([0]))).toEqual(moves[0]);
    expect(bot.choosePlacement(game, new StubRandomSource([0.999]))).toEqual(moves[moves.length - 1]);

    const pending = [
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] as FlowerColor[] },
      { corner: new CornerCoord(1, 0), eligibleColors: ['red'] as FlowerColor[] },
    ];
    const blooms = bot.chooseBlooms(game, moves[0]!, pending, new StubRandomSource([0.5, 0.5]));
    expect(blooms).toHaveLength(2);
    expect(new Set(blooms.map((b) => b.color)).size).toBe(2);

    const g1 = playBotGame(bot, 42);
    const g2 = playBotGame(bot, 42);
    expect(g1.isComplete).toBe(true);
    expect(g1.score).toBe(g2.score);
  });

  it('BOT-04: GreedyBloomBot prefers immediate blooms, breaks ties by neighborCount, and completes full games', () => {
    const bot = new GreedyBloomBot();
    expect(bot.id).toBe('greedy-bloom');
    const rng = new SeededRandomSource(9);

    // Immediate bloom preference: (1,1) rot 0 completes corner (0,0) while outer edges do not
    const gBloom = makeOrderedGame([0, 1, 2, 25]);
    gBloom.applyMove({ coord: new GridCoord(1, 0), rotation: 3 });
    gBloom.applyMove({ coord: new GridCoord(0, 1), rotation: 3 });
    const chosenBloom = bot.choosePlacement(gBloom, rng);
    expect(chosenBloom).toEqual({ coord: new GridCoord(1, 1), rotation: 0 });
    expect(bot.chooseBlooms(gBloom, chosenBloom, gBloom.eligibleBloomsFor(chosenBloom), rng)).toHaveLength(1);

    // Tie-break by neighborCount when 0 immediate blooms exist: (3,1) has 2 neighbors vs 1 on outer edges
    const gTie = makeOrderedGame([0, 1, 27, 2, 10, 26, 6, 14]);
    gTie.applyMove({ coord: new GridCoord(1, 0), rotation: 3 });
    gTie.applyMove({ coord: new GridCoord(2, 0), rotation: 0 });
    gTie.applyMove({ coord: new GridCoord(0, 1), rotation: 3 });
    gTie.applyMove({ coord: new GridCoord(2, 1), rotation: 3 });
    gTie.applyMove({ coord: new GridCoord(1, 1), rotation: 2 }, [
      { corner: new CornerCoord(0, 0), color: 'pink' },
      { corner: new CornerCoord(1, 0), color: 'red' },
    ]);
    gTie.applyMove({ coord: new GridCoord(3, 0), rotation: 0 });
    expect(bot.choosePlacement(gTie, rng)).toEqual({ coord: new GridCoord(3, 1), rotation: 1 });

    for (let s = 1; s <= 5; s += 1) {
      expect(playBotGame(bot, s).isComplete).toBe(true);
    }
  });
});
