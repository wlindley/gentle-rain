import { describe, expect, it } from 'vitest';
import { SeededRandomSource, StubRandomSource } from '../rng';
import {
  BloomPlacement,
  Board,
  CornerCoord,
  Direction,
  FLOWER_COLORS,
  FlowerColor,
  Game,
  GameResult,
  GridCoord,
  PondTile,
  TileCatalog,
} from './index';

describe('Coords', () => {
  it('exposes the 8 flower colors and W/N/E/S direction ordinals', () => {
    expect(FLOWER_COLORS).toEqual(['red', 'orange', 'white', 'yellow', 'pink', 'blue', 'purple', 'black']);
    expect([Direction.West, Direction.North, Direction.East, Direction.South]).toEqual([0, 1, 2, 3]);
  });

  it('computes GridCoord neighbors, equality, and key round-trips', () => {
    const origin = new GridCoord(2, -3);
    expect([origin.x, origin.y]).toEqual([2, -3]);
    expect(origin.equals(new GridCoord(2, -3))).toBe(true);
    expect(origin.equals(new GridCoord(2, 3))).toBe(false);
    expect(origin.neighbor(Direction.West).equals(new GridCoord(1, -3))).toBe(true);
    expect(origin.neighbor(Direction.North).equals(new GridCoord(2, -4))).toBe(true);
    expect(origin.neighbor(Direction.East).equals(new GridCoord(3, -3))).toBe(true);
    expect(origin.neighbor(Direction.South).equals(new GridCoord(2, -2))).toBe(true);
    expect(GridCoord.fromKey(origin.key).equals(origin)).toBe(true);
  });

  it('rejects non-integer GridCoord values and malformed keys', () => {
    expect(() => new GridCoord(1.5, 0)).toThrow();
    expect(() => new GridCoord(0, Number.NaN)).toThrow();
    expect(() => new GridCoord(Number.POSITIVE_INFINITY, 0)).toThrow();
    for (const bad of ['abc', '1,2,3', '1.5,2', '']) expect(() => GridCoord.fromKey(bad)).toThrow();
  });

  it('supports CornerCoord equality, key round-trips, and rejects invalid inputs', () => {
    const corner = new CornerCoord(-1, 4);
    expect([corner.cx, corner.cy]).toEqual([-1, 4]);
    expect(corner.equals(new CornerCoord(-1, 4))).toBe(true);
    expect(corner.equals(new CornerCoord(1, 4))).toBe(false);
    expect(CornerCoord.fromKey(corner.key).equals(corner)).toBe(true);
    expect(() => new CornerCoord(0.5, 1)).toThrow();
    expect(() => new CornerCoord(1, Number.NaN)).toThrow();
    expect(() => new CornerCoord(0, Number.NEGATIVE_INFINITY)).toThrow();
    for (const bad of ['bad', '1,2,3', '1,2.5']) expect(() => CornerCoord.fromKey(bad)).toThrow();
  });
});

describe('PondTile', () => {
  it('rotates edges clockwise across rotations 0..3 and checks color membership', () => {
    const tile = new PondTile(0, ['red', 'orange', 'white', 'yellow']);
    expect(tile.id).toBe(0);
    expect(tile.baseEdges).toEqual(['red', 'orange', 'white', 'yellow']);
    expect(tile.edgeAt(Direction.West)).toBe('red');
    expect(tile.edgeAt(Direction.North, 0)).toBe('orange');
    expect(tile.edgesAt(0)).toEqual(['red', 'orange', 'white', 'yellow']);
    expect(tile.edgesAt(1)).toEqual(['yellow', 'red', 'orange', 'white']);
    expect(tile.edgesAt(2)).toEqual(['white', 'yellow', 'red', 'orange']);
    expect(tile.edgesAt(3)).toEqual(['orange', 'white', 'yellow', 'red']);
    expect(tile.edgeAt(Direction.East, 1)).toBe('orange');
    expect(tile.edgeAt(Direction.South, 3)).toBe('red');
    expect(tile.hasColor('white')).toBe(true);
    expect(tile.hasColor('blue')).toBe(false);
  });

  it('normalizes canonicalKey across rotations while distinguishing mirrored tiles', () => {
    const tile = new PondTile(0, ['red', 'orange', 'white', 'yellow']);
    const rotated = new PondTile(1, ['yellow', 'red', 'orange', 'white']);
    const reversed = new PondTile(2, ['red', 'yellow', 'white', 'orange']);
    expect(tile.canonicalKey()).toBe(rotated.canonicalKey());
    expect(tile.canonicalKey()).not.toBe(reversed.canonicalKey());
  });

  it('rejects invalid ids, duplicate colors, and unknown colors', () => {
    expect(() => new PondTile(-1, ['red', 'orange', 'white', 'yellow'])).toThrow();
    expect(() => new PondTile(0.5, ['red', 'orange', 'white', 'yellow'])).toThrow();
    expect(() => new PondTile(3, ['red', 'red', 'white', 'yellow'])).toThrow();
    expect(() => new PondTile(4, ['red', 'orange', 'white', 'green' as FlowerColor])).toThrow();
  });
});

describe('TileCatalog', () => {
  it('loads 28 rotationally unique default tiles with 14 edges per color', () => {
    const catalog = TileCatalog.defaultCatalog();
    expect(catalog.tiles).toHaveLength(28);
    expect(new Set(catalog.tiles.map((t) => t.canonicalKey())).size).toBe(28);

    const counts = new Map<FlowerColor, number>(FLOWER_COLORS.map((c) => [c, 0]));
    for (const tile of catalog.tiles) {
      for (const color of tile.baseEdges) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    for (const color of FLOWER_COLORS) expect(counts.get(color)).toBe(14);
  });

  it('rejects wrong tile/edge counts, invalid or duplicate colors, and rotational duplicates', () => {
    const validRaw = TileCatalog.defaultCatalog().tiles.map((t) => [...t.baseEdges]);
    expect(new TileCatalog(validRaw).tiles).toHaveLength(28);
    expect(() => new TileCatalog(validRaw.slice(0, 27))).toThrow();
    expect(() => new TileCatalog(validRaw.map((e, i) => (i === 0 ? e.slice(0, 3) : e)))).toThrow();
    expect(() => new TileCatalog(validRaw.map((e, i) => (i === 0 ? ['red', 'orange', 'white', 'cyan'] : e)))).toThrow();
    expect(() => new TileCatalog(validRaw.map((e, i) => (i === 0 ? ['red', 'red', 'white', 'yellow'] : e)))).toThrow();
    const [e0, e1, e2, e3] = validRaw[0]!;
    expect(() => new TileCatalog(validRaw.map((e, i) => (i === 1 ? [e3!, e0!, e1!, e2!] : e)))).toThrow();
  });
});

describe('Board', () => {
  const makeThreeTileBoard = (): Board => {
    const b = new Board();
    b.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));
    b.placeTile(new PondTile(1, ['white', 'pink', 'blue', 'yellow']), { coord: new GridCoord(1, 0), rotation: 0 });
    b.placeTile(new PondTile(2, ['black', 'yellow', 'blue', 'pink']), { coord: new GridCoord(0, 1), rotation: 0 });
    return b;
  };

  it('places initial tile at (0,0), seeds 4 frontier constraints, and rejects non-empty boards', () => {
    const board = new Board();
    const t0 = new PondTile(0, ['red', 'orange', 'white', 'yellow']);
    board.placeInitialTile(t0);
    expect(board.placedTileCount).toBe(1);
    expect(board.placedTiles).toHaveLength(1);
    expect(board.tileAt(new GridCoord(0, 0))?.tile).toBe(t0);
    expect(board.tileAt(new GridCoord(0, 0))?.rotation).toBe(0);
    expect(board.tileAt(new GridCoord(1, 0))).toBeUndefined();

    const byKey = new Map(board.frontierConstraints.map((c) => [c.coord.key, c]));
    expect(byKey.size).toBe(4);
    expect(byKey.get('-1,0')?.requiredEdges).toEqual([null, null, 'red', null]);
    expect(byKey.get('0,-1')?.requiredEdges).toEqual([null, null, null, 'orange']);
    expect(byKey.get('1,0')?.requiredEdges).toEqual(['white', null, null, null]);
    expect(byKey.get('0,1')?.requiredEdges).toEqual([null, 'yellow', null, null]);
    for (const c of byKey.values()) expect(c.neighborCount).toBe(1);
    expect(() => board.placeInitialTile(t0)).toThrow();

    const rotatedBoard = new Board();
    rotatedBoard.placeInitialTile(t0, 1);
    expect(rotatedBoard.tileAt(new GridCoord(0, 0))?.rotation).toBe(1);
  });

  it('finds valid placements across rotations and returns [] when no edges match', () => {
    const board = new Board();
    board.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));
    const noMatch = new PondTile(1, ['pink', 'blue', 'purple', 'black']);
    expect(board.validPlacementsFor(noMatch)).toEqual([]);
    expect(board.isValidPlacement(noMatch, { coord: new GridCoord(1, 0), rotation: 0 })).toBe(false);

    const oneColorMatch = new PondTile(2, ['white', 'pink', 'blue', 'purple']);
    expect(board.validPlacementsFor(oneColorMatch)).toEqual([{ coord: new GridCoord(1, 0), rotation: 0 }]);
    expect(board.isValidPlacement(oneColorMatch, { coord: new GridCoord(1, 0), rotation: 0 })).toBe(true);
    expect(board.isValidPlacement(oneColorMatch, { coord: new GridCoord(1, 0), rotation: 1 })).toBe(false);

    board.placeTile(oneColorMatch, { coord: new GridCoord(1, 0), rotation: 0 });
    board.placeTile(new PondTile(3, ['black', 'yellow', 'blue', 'pink']), { coord: new GridCoord(0, 1), rotation: 0 });
    const cornerFit = new PondTile(4, ['blue', 'purple', 'red', 'white']);
    expect(board.isValidPlacement(cornerFit, { coord: new GridCoord(1, 1), rotation: 0 })).toBe(true);
    expect(board.isValidPlacement(cornerFit, { coord: new GridCoord(1, 1), rotation: 2 })).toBe(false);
  });

  it('rejects invalid placements and merges multi-edge frontier constraints incrementally', () => {
    const board = new Board();
    const t1 = new PondTile(1, ['white', 'pink', 'blue', 'purple']);
    board.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));
    expect(() => board.placeTile(t1, { coord: new GridCoord(0, 0), rotation: 0 })).toThrow();
    expect(() => board.placeTile(t1, { coord: new GridCoord(3, 3), rotation: 0 })).toThrow();
    expect(() => board.placeTile(t1, { coord: new GridCoord(1, 0), rotation: 1 })).toThrow();

    board.placeTile(t1, { coord: new GridCoord(1, 0), rotation: 0 });
    board.placeTile(new PondTile(2, ['black', 'yellow', 'blue', 'pink']), { coord: new GridCoord(0, 1), rotation: 0 });
    const byKey = new Map(board.frontierConstraints.map((c) => [c.coord.key, c]));
    expect(byKey.has('1,0')).toBe(false);
    expect(byKey.has('0,1')).toBe(false);
    expect(byKey.get('1,1')?.requiredEdges).toEqual(['blue', 'purple', null, null]);
    expect(byKey.get('1,1')?.neighborCount).toBe(2);
  });

  it('detects 1, 2, and 4 simultaneous 2x2 corners with deduplicated adjacentColors', () => {
    const c1 = makeThreeTileBoard().placeTile(new PondTile(3, ['blue', 'yellow', 'red', 'purple']), { coord: new GridCoord(1, 1), rotation: 0 });
    expect(c1).toHaveLength(1);
    expect(c1[0]!.corner.equals(new CornerCoord(0, 0))).toBe(true);
    expect([...c1[0]!.adjacentColors].sort()).toEqual(['blue', 'white', 'yellow']);

    const ring: readonly [number, number, readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor]][] = [
      [0, 0, ['red', 'orange', 'white', 'yellow']], [1, 0, ['white', 'pink', 'blue', 'purple']],
      [2, 0, ['blue', 'black', 'red', 'orange']], [2, 1, ['pink', 'orange', 'white', 'yellow']],
      [0, 1, ['white', 'yellow', 'blue', 'black']], [2, 2, ['purple', 'yellow', 'blue', 'black']],
      [1, 2, ['orange', 'red', 'purple', 'white']], [0, 2, ['blue', 'black', 'orange', 'pink']],
    ];
    const fill = (count: number) => {
      const b = new Board();
      ring.slice(0, count).forEach(([x, y, e], i) =>
        i === 0 ? b.placeInitialTile(new PondTile(i, e)) : b.placeTile(new PondTile(i, e), { coord: new GridCoord(x, y), rotation: 0 }),
      );
      return b.placeTile(new PondTile(9, ['blue', 'purple', 'pink', 'red']), { coord: new GridCoord(1, 1), rotation: 0 });
    };
    expect(fill(5).map((c) => c.corner.key).sort()).toEqual(['0,0', '1,0']);
    const c4 = fill(8);
    expect(c4.map((c) => c.corner.key).sort()).toEqual(['0,0', '0,1', '1,0', '1,1']);
    expect([...c4.find((c) => c.corner.key === '1,1')!.adjacentColors].sort()).toEqual(['pink', 'purple', 'red', 'yellow']);
  });

  it('previews corners, neighborCount, and affected frontier without mutating state', () => {
    const board = new Board();
    board.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));
    board.placeTile(new PondTile(1, ['white', 'pink', 'blue', 'yellow']), { coord: new GridCoord(1, 0), rotation: 0 });
    const t2 = new PondTile(2, ['black', 'yellow', 'blue', 'pink']);
    const sharedPreview = board.previewPlacement(t2, { coord: new GridCoord(0, 1), rotation: 0 });
    expect(sharedPreview.affectedFrontierConstraints.find((c) => c.coord.key === '1,1')?.requiredEdges).toEqual(['blue', 'yellow', null, null]);
    board.placeTile(t2, { coord: new GridCoord(0, 1), rotation: 0 });

    const t3 = new PondTile(3, ['blue', 'yellow', 'red', 'purple']);
    const placement = { coord: new GridCoord(1, 1), rotation: 0 as const };
    const beforeFrontier = board.frontierConstraints.map((c) => c.coord.key).sort();

    const preview = board.previewPlacement(t3, placement);
    expect(preview.placement).toEqual(placement);
    expect(preview.neighborCount).toBe(2);
    expect(preview.completedCorners).toHaveLength(1);
    expect(preview.completedCorners[0]!.corner.key).toBe('0,0');
    expect([...preview.completedCorners[0]!.adjacentColors].sort()).toEqual(['blue', 'white', 'yellow']);

    const affected = new Map(preview.affectedFrontierConstraints.map((c) => [c.coord.key, c]));
    expect(affected.size).toBe(2);
    expect(affected.get('2,1')?.requiredEdges).toEqual(['red', null, null, null]);
    expect(affected.get('1,2')?.requiredEdges).toEqual([null, 'purple', null, null]);

    expect(board.placedTileCount).toBe(3);
    expect(board.tileAt(new GridCoord(1, 1))).toBeUndefined();
    expect(board.frontierConstraints.map((c) => c.coord.key).sort()).toEqual(beforeFrontier);
    expect(() => board.previewPlacement(t3, { coord: new GridCoord(1, 1), rotation: 1 })).toThrow();
  });

  it('validates bloom placement and tracks board bounds across all quadrants', () => {
    const empty = new Board();
    expect(empty.bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect([empty.placedBloomCount, empty.placedBlooms, empty.bloomAt(new CornerCoord(0, 0))]).toEqual([0, [], undefined]);

    const board = makeThreeTileBoard();
    board.placeTile(new PondTile(3, ['blue', 'yellow', 'red', 'purple']), { coord: new GridCoord(1, 1), rotation: 0 });
    board.placeTile(new PondTile(4, ['pink', 'blue', 'red', 'black']), { coord: new GridCoord(-1, 0), rotation: 0 });
    board.placeTile(new PondTile(5, ['pink', 'blue', 'purple', 'orange']), { coord: new GridCoord(0, -1), rotation: 0 });
    expect(board.bounds).toEqual({ minX: -1, maxX: 1, minY: -1, maxY: 1 });

    expect(() => board.placeBloom({ corner: new CornerCoord(1, 0), color: 'blue' })).toThrow();
    expect(() => board.placeBloom({ corner: new CornerCoord(0, 0), color: 'black' })).toThrow();

    board.placeBloom({ corner: new CornerCoord(0, 0), color: 'white' });
    expect(board.placedBloomCount).toBe(1);
    expect(board.placedBlooms).toHaveLength(1);
    expect(board.bloomAt(new CornerCoord(0, 0))).toBe('white');
    expect(() => board.placeBloom({ corner: new CornerCoord(0, 0), color: 'blue' })).toThrow();
  });
});

describe('src/game', () => {

  const makeOrderedGame = (frontIds: readonly number[]): Game => {
    const all = TileCatalog.defaultCatalog().tiles;
    const frontSet = new Set(frontIds);
    const ordered = [...frontIds.map((id) => all[id]!), ...all.filter((t) => !frontSet.has(t.id))];
    const catalog = new TileCatalog(ordered.map((t) => t.baseEdges));
    return Game.create(new StubRandomSource(Array.from({ length: 27 }, () => 0.9999)), catalog);
  };

  it('GAME-12: Game.create shuffles deck, places initial tile at (0,0), draws currentTile, and exposes fair unseenTiles', () => {
    const game = Game.create(new SeededRandomSource(7));
    expect(game.board.placedTileCount).toBe(1);
    const initial = game.board.tileAt(new GridCoord(0, 0))!.tile;
    expect(game.currentTile).not.toBeNull();
    expect(game.currentTile!.id).not.toBe(initial.id);
    expect(game.remainingDrawCount).toBe(26);
    expect(game.unseenTiles).toHaveLength(26);
    expect(game.unseenTiles.some((t) => t.id === initial.id || t.id === game.currentTile!.id)).toBe(false);
    expect(game.unplayedFlowers.size).toBe(8);
    expect(game.discardedTiles).toEqual([]);
    expect(game.turnNumber).toBe(0);
    expect(game.isComplete).toBe(false);
  });

  const setupTwoCornerGame = (extraIds: readonly number[] = []): Game => {
    const game = makeOrderedGame([0, 1, 27, 2, 10, 26, ...extraIds]);
    game.applyMove({ coord: new GridCoord(1, 0), rotation: 3 });
    game.applyMove({ coord: new GridCoord(2, 0), rotation: 0 });
    game.applyMove({ coord: new GridCoord(0, 1), rotation: 3 });
    game.applyMove({ coord: new GridCoord(2, 1), rotation: 3 });
    return game;
  };

  it('GAME-13: Game.applyMove places tiles, resolves single/simultaneous blooms, and updates turn/unseen state', () => {
    const game = setupTwoCornerGame();
    const p = { coord: new GridCoord(1, 1), rotation: 2 as const };
    expect(game.eligibleBloomsFor(p).map((c) => c.corner.key).sort()).toEqual(['0,0', '1,0']);

    const outcome = game.applyMove(p, [
      { corner: new CornerCoord(0, 0), color: 'pink' },
      { corner: new CornerCoord(1, 0), color: 'red' },
    ]);
    expect(outcome.kind).toBe('placed');
    expect(game.board.placedBloomCount).toBe(2);
    expect(game.unplayedFlowers.has('pink')).toBe(false);
    expect(game.unplayedFlowers.has('red')).toBe(false);
    expect(game.turnNumber).toBe(5);
    expect(game.remainingDrawCount).toBe(21);
    expect(game.unseenTiles).toHaveLength(21);
  });

  it('GAME-14: Game.applyMove enforces bloom validity and allows unbloomed corner only when 0 eligible colors remain', () => {
    const game = setupTwoCornerGame([6, 14]);
    const p = { coord: new GridCoord(1, 1), rotation: 2 as const };
    expect(() => game.applyMove(p, [])).toThrow();
    expect(() => game.applyMove(p, [{ corner: new CornerCoord(0, 0), color: 'pink' }])).toThrow();
    expect(() => game.applyMove(p, [
      { corner: new CornerCoord(0, 0), color: 'pink' }, { corner: new CornerCoord(1, 0), color: 'pink' },
    ])).toThrow();
    expect(() => game.applyMove(p, [
      { corner: new CornerCoord(5, 5), color: 'pink' }, { corner: new CornerCoord(1, 0), color: 'red' },
    ])).toThrow();

    game.applyMove(p, [
      { corner: new CornerCoord(0, 0), color: 'pink' }, { corner: new CornerCoord(1, 0), color: 'red' },
    ]);
    game.applyMove({ coord: new GridCoord(3, 0), rotation: 0 });
    const dead = { coord: new GridCoord(3, 1), rotation: 1 as const };
    expect(game.eligibleBloomsFor(dead)).toEqual([{ corner: new CornerCoord(2, 0), eligibleColors: [] }]);
    expect(() => game.applyMove(dead, [{ corner: new CornerCoord(2, 0), color: 'pink' }])).toThrow();
    expect(game.applyMove(dead, []).kind).toBe('placed');
    expect(game.board.bloomAt(new CornerCoord(2, 0))).toBeUndefined();
  });

  it('GAME-15: Game.discardCurrentTile discards unplaceable tile and throws when valid placements exist', () => {
    const placeable = makeOrderedGame([0, 1]);
    expect(placeable.validPlacements.length).toBeGreaterThan(0);
    expect(() => placeable.discardCurrentTile()).toThrow();

    const unplaceable = makeOrderedGame([0, 27]);
    expect(unplaceable.validPlacements).toEqual([]);
    const drawn = unplaceable.currentTile!;
    const out = unplaceable.discardCurrentTile();
    expect(out).toEqual({ kind: 'discarded', tile: drawn });
    expect(unplaceable.discardedTiles).toEqual([drawn]);
    expect(unplaceable.turnNumber).toBe(1);
    expect(unplaceable.remainingDrawCount).toBe(25);
  });

  const playToEnd = (seed: number, preferBloom: boolean): Game => {
    const game = Game.create(new SeededRandomSource(seed));
    while (!game.isComplete) {
      const moves = game.validPlacements;
      if (moves.length === 0) { game.discardCurrentTile(); continue; }
      let best = moves[0]!;
      let bestScore = -Infinity;
      for (const m of moves) {
        const preview = game.board.previewPlacement(game.currentTile!, m);
        const bloomable = game.eligibleBloomsFor(m).filter((c) => c.eligibleColors.length > 0).length;
        const val = preferBloom
          ? bloomable * 10 + preview.neighborCount
          : -preview.completedCorners.length * 100 - preview.neighborCount;
        if (val > bestScore) { bestScore = val; best = m; }
      }
      const pending = game.eligibleBloomsFor(best);
      const blooms: BloomPlacement[] = [];
      const used = new Set<FlowerColor>();
      for (const p of [...pending].sort((a, b) => a.eligibleColors.length - b.eligibleColors.length)) {
        const color = p.eligibleColors.find((c) => !used.has(c));
        if (color) { used.add(color); blooms.push({ corner: p.corner, color }); }
      }
      game.applyMove(best, blooms);
    }
    return game;
  };

  it('GAME-16: Early Victory ends immediately on 8th bloom with score = 8 + remainingDrawCount and rejects further moves', () => {
    let game: Game | undefined;
    for (let s = 1; s <= 50; s += 1) {
      const candidate = playToEnd(s, true);
      if (candidate.isWin && candidate.remainingDrawCount > 0) { game = candidate; break; }
    }
    expect(game).toBeDefined();
    expect(game!.isComplete).toBe(true);
    expect(game!.isWin).toBe(true);
    expect(game!.currentTile).toBeNull();
    expect(game!.validPlacements).toEqual([]);
    expect(game!.remainingDrawCount).toBeGreaterThan(0);
    expect(game!.score).toBe(8 + game!.remainingDrawCount);

    const res = game!.result!;
    expect(res).not.toBeNull();
    expect(res.isWin).toBe(true);
    expect(res.placedFlowers).toBe(8);
    expect(res.score).toBe(8 + game!.remainingDrawCount);
    expect(() => game!.discardCurrentTile()).toThrow();
    expect(() => game!.applyMove({ coord: new GridCoord(0, 0), rotation: 0 })).toThrow();
    expect(() => game!.eligibleBloomsFor({ coord: new GridCoord(0, 0), rotation: 0 })).toThrow();
  });

  it('GAME-17: Deck Exhaustion ends with isWin=false, remainingDrawCount=0, and score=placedFlowers', () => {
    const game = playToEnd(1, false);
    expect(game.isComplete).toBe(true);
    expect(game.isWin).toBe(false);
    expect(game.currentTile).toBeNull();
    expect(game.remainingDrawCount).toBe(0);
    expect(game.board.placedBloomCount).toBeLessThan(8);
    expect(game.score).toBe(game.board.placedBloomCount);

    const res = game.result!;
    expect(res).not.toBeNull();
    expect(res.isWin).toBe(false);
    expect(res.score).toBe(res.placedFlowers);
    expect(res.placedTilesCount + res.discardedTilesCount).toBe(28);
  });

  it('GAME-18: Game.result is null until complete and Game.toSnapshot returns an immutable detached snapshot', () => {
    const winRes = new GameResult({ placedFlowers: 8, remainingDrawCount: 5, placedTilesCount: 22, discardedTilesCount: 1, turnsPlayed: 22 });
    expect(winRes.score).toBe(13);
    expect(winRes.isWin).toBe(true);
    const lossRes = new GameResult({ placedFlowers: 6, remainingDrawCount: 0, placedTilesCount: 25, discardedTilesCount: 3, turnsPlayed: 27 });
    expect(lossRes.score).toBe(6);
    expect(lossRes.isWin).toBe(false);

    const game = makeOrderedGame([0, 1]);
    expect(game.result).toBeNull();
    const snap0 = game.toSnapshot();
    expect(snap0.placedTiles).toHaveLength(1);
    expect(snap0.placedBlooms).toEqual([]);
    expect(snap0.unplayedFlowers).toHaveLength(8);
    expect(snap0.remainingDrawCount).toBe(26);
    expect(snap0.turnNumber).toBe(0);
    expect(snap0.isComplete).toBe(false);
    expect(snap0.isWin).toBe(false);
    expect(snap0.bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

    game.applyMove(game.validPlacements[0]!);
    const snap1 = game.toSnapshot();
    expect(snap0.placedTiles).toHaveLength(1);
    expect(snap0.turnNumber).toBe(0);
    expect(snap0.remainingDrawCount).toBe(26);
    expect(snap1.placedTiles).toHaveLength(2);
    expect(snap1.turnNumber).toBe(1);
    expect(snap1.remainingDrawCount).toBe(25);
  });
});
