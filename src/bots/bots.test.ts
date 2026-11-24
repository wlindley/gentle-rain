import { describe, expect, it } from 'vitest';
import { CornerCoord, Game, GridCoord, PondTile, TileCatalog } from '../game';
import type { FlowerColor, FrontierConstraint, TilePlacement } from '../game';
import { SeededRandomSource, StubRandomSource } from '../rng';
import {
  BloomAssignmentSolver,
  BotRegistry,
  countFrontierColors,
  countMatchingUnseen,
  countUnseenColors,
  GreedyBloomBot,
  HeuristicBot,
  RandomBot,
  selectBestPlacement,
  tileFitsConstraint,
} from './index';
import type { Bot } from './index';

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
    const view = game.activeView!;
    const p = bot.choosePlacement(view, botRng);
    const blooms = bot.chooseBlooms(view, p, view.eligibleBloomsFor(p), botRng);
    game.applyMove(p, blooms);
  }
  return game;
};

describe('BloomAssignmentSolver', () => {
  it('returns empty for 0 corners or corners with 0 eligible colors', () => {
    expect(BloomAssignmentSolver.solve([])).toEqual([]);
    expect(BloomAssignmentSolver.solve([{ corner: new CornerCoord(0, 0), eligibleColors: [] }])).toEqual([]);
  });

  it('finds maximal distinct-color assignments when corners share scarce colors', () => {
    const single = BloomAssignmentSolver.solve([{ corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] }]);
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

  it('maximizes total colorPriority among maximal assignments', () => {
    const priority = (c: FlowerColor): number =>
      ({ red: 1, blue: 5, yellow: 10 } as Record<string, number>)[c] ?? 0;

    expect(
      BloomAssignmentSolver.solve([{ corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] }], priority),
    ).toEqual([{ corner: new CornerCoord(0, 0), color: 'blue' }]);

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
});

describe('BoardAnalysis', () => {
  it('counts unseen tile colors and frontier required edge colors', () => {
    const tiles = [new PondTile(0, ['red', 'orange', 'white', 'yellow']), new PondTile(1, ['red', 'blue', 'pink', 'black'])];
    const unseen = countUnseenColors(tiles);
    expect(unseen.red).toBe(2);
    expect(unseen.blue).toBe(1);
    expect(unseen.purple).toBe(0);

    const constraints: FrontierConstraint[] = [
      { coord: new GridCoord(1, 0), requiredEdges: ['white', null, null, null], neighborCount: 1 },
      { coord: new GridCoord(1, 1), requiredEdges: ['white', 'red', null, null], neighborCount: 2 },
    ];
    const frontier = countFrontierColors(constraints);
    expect(frontier.white).toBe(2);
    expect(frontier.red).toBe(1);
    expect(frontier.blue).toBe(0);
  });

  it('checks tileFitsConstraint across rotations and counts matching unseen tiles', () => {
    const fitTile = new PondTile(0, ['yellow', 'red', 'orange', 'white']);
    const missTile = new PondTile(1, ['pink', 'blue', 'purple', 'black']);
    const constraint: FrontierConstraint = {
      coord: new GridCoord(1, 1),
      requiredEdges: ['red', 'orange', null, null],
      neighborCount: 2,
    };
    expect(tileFitsConstraint(fitTile, constraint.requiredEdges)).toBe(true);
    expect(tileFitsConstraint(missTile, constraint.requiredEdges)).toBe(false);
    expect(countMatchingUnseen(constraint, [fitTile, missTile])).toBe(1);
  });

  it('selectBestPlacement picks highest score and breaks ties via rng', () => {
    const moves: TilePlacement[] = [
      { coord: new GridCoord(0, 1), rotation: 0 },
      { coord: new GridCoord(1, 0), rotation: 1 },
      { coord: new GridCoord(-1, 0), rotation: 2 },
    ];
    const scoreFn = (p: TilePlacement): number => (p.coord.x === 0 ? 1 : 5);
    expect(selectBestPlacement(moves, scoreFn, new StubRandomSource([0]))).toEqual(moves[1]);
    expect(selectBestPlacement(moves, scoreFn, new StubRandomSource([0.99]))).toEqual(moves[2]);
  });
});

describe('RandomBot', () => {
  it('selects legal placements and maximal blooms deterministically via rng', () => {
    const bot = new RandomBot();
    expect(bot.id).toBe('random');
    const game = makeOrderedGame([0, 1]);
    const moves = game.validPlacements;
    expect(moves.length).toBeGreaterThan(1);
    expect(bot.choosePlacement(game.activeView!, new StubRandomSource([0]))).toEqual(moves[0]);
    expect(bot.choosePlacement(game.activeView!, new StubRandomSource([0.999]))).toEqual(moves[moves.length - 1]);

    const pending = [
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] as FlowerColor[] },
      { corner: new CornerCoord(1, 0), eligibleColors: ['red'] as FlowerColor[] },
    ];
    const blooms = bot.chooseBlooms(game.activeView!, moves[0]!, pending, new StubRandomSource([0.5, 0.5]));
    expect(blooms).toHaveLength(2);
    expect(new Set(blooms.map((b) => b.color)).size).toBe(2);
  });

  it('completes full seeded games reproducibly', () => {
    const bot = new RandomBot();
    const g1 = playBotGame(bot, 42);
    const g2 = playBotGame(bot, 42);
    expect(g1.isComplete).toBe(true);
    expect(g1.score).toBe(g2.score);
  });
});

describe('GreedyBloomBot', () => {
  it('prefers immediate blooms over non-blooming placements', () => {
    const bot = new GreedyBloomBot();
    expect(bot.id).toBe('greedy-bloom');
    const rng = new SeededRandomSource(9);
    const game = makeOrderedGame([0, 1, 2, 25]);
    game.applyMove({ coord: new GridCoord(1, 0), rotation: 3 });
    game.applyMove({ coord: new GridCoord(0, 1), rotation: 3 });
    const chosen = bot.choosePlacement(game.activeView!, rng);
    expect(chosen).toEqual({ coord: new GridCoord(1, 1), rotation: 0 });
    expect(bot.chooseBlooms(game.activeView!, chosen, game.eligibleBloomsFor(chosen), rng)).toHaveLength(1);
  });

  it('breaks 0-bloom ties toward higher neighborCount and completes full games', () => {
    const bot = new GreedyBloomBot();
    const rng = new SeededRandomSource(9);
    const game = makeOrderedGame([0, 1, 27, 2, 10, 26, 6, 14]);
    game.applyMove({ coord: new GridCoord(1, 0), rotation: 3 });
    game.applyMove({ coord: new GridCoord(2, 0), rotation: 0 });
    game.applyMove({ coord: new GridCoord(0, 1), rotation: 3 });
    game.applyMove({ coord: new GridCoord(2, 1), rotation: 3 });
    game.applyMove({ coord: new GridCoord(1, 1), rotation: 2 }, [
      { corner: new CornerCoord(0, 0), color: 'pink' },
      { corner: new CornerCoord(1, 0), color: 'red' },
    ]);
    game.applyMove({ coord: new GridCoord(3, 0), rotation: 0 });
    expect(bot.choosePlacement(game.activeView!, rng)).toEqual({ coord: new GridCoord(3, 1), rotation: 1 });

    for (let s = 1; s <= 5; s += 1) expect(playBotGame(bot, s).isComplete).toBe(true);
  });
});

describe('HeuristicBot', () => {
  it('prefers immediate blooms on completed corners', () => {
    const bot = new HeuristicBot();
    expect(bot.id).toBe('heuristic');
    const game = makeOrderedGame([0, 1, 2, 25]);
    game.applyMove({ coord: new GridCoord(1, 0), rotation: 3 });
    game.applyMove({ coord: new GridCoord(0, 1), rotation: 3 });
    const chosen = bot.choosePlacement(game.activeView!, new SeededRandomSource(1));
    expect(chosen).toEqual({ coord: new GridCoord(1, 1), rotation: 0 });
    expect(
      bot.chooseBlooms(game.activeView!, chosen, game.eligibleBloomsFor(chosen), new SeededRandomSource(1)),
    ).toHaveLength(1);
  });

  it('outperforms RandomBot across a 50-game seeded suite', () => {
    const heuristic = new HeuristicBot();
    const random = new RandomBot();
    let heuristicTotal = 0;
    let randomTotal = 0;
    const base = new SeededRandomSource(1000);
    for (let i = 0; i < 50; i += 1) {
      const seed = base.derive(i).seed;
      const gH = playBotGame(heuristic, seed);
      const gR = playBotGame(random, seed);
      expect(gH.isComplete).toBe(true);
      heuristicTotal += gH.score;
      randomTotal += gR.score;
    }
    expect(heuristicTotal / 50).toBeGreaterThan(randomTotal / 50);
  });
});

describe('BotRegistry', () => {
  it('provides 3 default bots and resolves find and require lookups', () => {
    const registry = BotRegistry.createDefault();
    expect(registry.bots.map((b) => b.id)).toEqual(['random', 'greedy-bloom', 'heuristic']);
    expect(registry.find('heuristic')?.id).toBe('heuristic');
    expect(registry.require('random').id).toBe('random');
    expect(registry.find('missing')).toBeUndefined();
    expect(() => registry.require('missing')).toThrow();
  });

  it('registers custom bots and rejects duplicate IDs', () => {
    const registry = BotRegistry.createDefault();
    const custom: Bot = {
      id: 'custom-bot',
      name: 'Custom Bot',
      description: 'Test custom bot',
      choosePlacement: (view) => view.validPlacements[0]!,
      chooseBlooms: (_view, _p, pending) => BloomAssignmentSolver.solve(pending),
    };
    registry.register(custom);
    expect(registry.require('custom-bot')).toBe(custom);
    expect(registry.bots).toHaveLength(4);
    expect(() => registry.register(custom)).toThrow();
    expect(() => new BotRegistry([custom, custom])).toThrow();
  });
});
