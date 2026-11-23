import { describe, expect, it } from 'vitest';
import {
  Board,
  CornerCoord,
  Direction,
  FLOWER_COLORS,
  FlowerColor,
  GridCoord,
  PondTile,
  TileCatalog,
} from './index';

describe('src/game', () => {
  it('GAME-01: GridCoord and CornerCoord validate integers, compute neighbors, round-trip keys, and compare equality', () => {
    expect(FLOWER_COLORS).toEqual([
      'red',
      'orange',
      'white',
      'yellow',
      'pink',
      'blue',
      'purple',
      'black',
    ]);
    expect(Direction.West).toBe(0);
    expect(Direction.North).toBe(1);
    expect(Direction.East).toBe(2);
    expect(Direction.South).toBe(3);

    const origin = new GridCoord(2, -3);
    expect(origin.x).toBe(2);
    expect(origin.y).toBe(-3);
    expect(origin.equals(new GridCoord(2, -3))).toBe(true);
    expect(origin.equals(new GridCoord(2, 3))).toBe(false);

    expect(origin.neighbor(Direction.West).equals(new GridCoord(1, -3))).toBe(true);
    expect(origin.neighbor(Direction.North).equals(new GridCoord(2, -4))).toBe(true);
    expect(origin.neighbor(Direction.East).equals(new GridCoord(3, -3))).toBe(true);
    expect(origin.neighbor(Direction.South).equals(new GridCoord(2, -2))).toBe(true);

    expect(GridCoord.fromKey(origin.key).equals(origin)).toBe(true);
    expect(() => new GridCoord(1.5, 0)).toThrow();
    expect(() => new GridCoord(0, Number.NaN)).toThrow();
    expect(() => new GridCoord(Number.POSITIVE_INFINITY, 0)).toThrow();
    expect(() => GridCoord.fromKey('abc')).toThrow();
    expect(() => GridCoord.fromKey('1,2,3')).toThrow();
    expect(() => GridCoord.fromKey('1.5,2')).toThrow();
    expect(() => GridCoord.fromKey('')).toThrow();

    const corner = new CornerCoord(-1, 4);
    expect(corner.cx).toBe(-1);
    expect(corner.cy).toBe(4);
    expect(corner.equals(new CornerCoord(-1, 4))).toBe(true);
    expect(corner.equals(new CornerCoord(1, 4))).toBe(false);
    expect(CornerCoord.fromKey(corner.key).equals(corner)).toBe(true);

    expect(() => new CornerCoord(0.5, 1)).toThrow();
    expect(() => new CornerCoord(1, Number.NaN)).toThrow();
    expect(() => new CornerCoord(0, Number.NEGATIVE_INFINITY)).toThrow();
    expect(() => CornerCoord.fromKey('bad')).toThrow();
    expect(() => CornerCoord.fromKey('1,2,3')).toThrow();
    expect(() => CornerCoord.fromKey('1,2.5')).toThrow();
  });

  it('GAME-02: PondTile rotates clockwise, checks colors, rejects invalid edges, and normalizes canonicalKey', () => {
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

    const rotated = new PondTile(1, ['yellow', 'red', 'orange', 'white']);
    const reversed = new PondTile(2, ['red', 'yellow', 'white', 'orange']);
    expect(tile.canonicalKey()).toBe(rotated.canonicalKey());
    expect(tile.canonicalKey()).not.toBe(reversed.canonicalKey());

    expect(() => new PondTile(-1, ['red', 'orange', 'white', 'yellow'])).toThrow();
    expect(() => new PondTile(0.5, ['red', 'orange', 'white', 'yellow'])).toThrow();
    expect(() => new PondTile(3, ['red', 'red', 'white', 'yellow'])).toThrow();
    expect(() => new PondTile(4, ['red', 'orange', 'white', 'green' as FlowerColor])).toThrow();
  });

  it('GAME-03: TileCatalog.defaultCatalog loads 28 rotationally unique tiles with 14 edges per color', () => {
    const catalog = TileCatalog.defaultCatalog();
    expect(catalog.tiles).toHaveLength(28);

    const keys = new Set(catalog.tiles.map((t) => t.canonicalKey()));
    expect(keys.size).toBe(28);

    const counts = new Map<FlowerColor, number>(FLOWER_COLORS.map((c) => [c, 0]));
    for (const tile of catalog.tiles) {
      for (const color of tile.baseEdges) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }
    }
    for (const color of FLOWER_COLORS) {
      expect(counts.get(color)).toBe(14);
    }
  });

  it('GAME-04: TileCatalog rejects invalid tile counts, edge counts, colors, duplicates, and rotational duplicates', () => {
    const validRaw = TileCatalog.defaultCatalog().tiles.map((t) => [...t.baseEdges]);
    expect(new TileCatalog(validRaw).tiles).toHaveLength(28);

    expect(() => new TileCatalog(validRaw.slice(0, 27))).toThrow();

    const badEdgeCount = validRaw.map((e, i) => (i === 0 ? e.slice(0, 3) : e));
    expect(() => new TileCatalog(badEdgeCount)).toThrow();

    const badColor = validRaw.map((e, i) => (i === 0 ? ['red', 'orange', 'white', 'cyan'] : e));
    expect(() => new TileCatalog(badColor)).toThrow();

    const dupColor = validRaw.map((e, i) => (i === 0 ? ['red', 'red', 'white', 'yellow'] : e));
    expect(() => new TileCatalog(dupColor)).toThrow();

    const first = validRaw[0]!;
    const rotatedFirst = [first[3]!, first[0]!, first[1]!, first[2]!];
    const dupTile = validRaw.map((e, i) => (i === 1 ? rotatedFirst : e));
    expect(() => new TileCatalog(dupTile)).toThrow();
  });

  it('GAME-05: Board.placeInitialTile places at (0,0), populates 4 frontier constraints, and rejects non-empty board', () => {
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

  it('GAME-06: Board.validPlacementsFor and isValidPlacement match all adjacent edges across rotations', () => {
    const board = new Board();
    board.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));

    const noMatch = new PondTile(1, ['pink', 'blue', 'purple', 'black']);
    expect(board.validPlacementsFor(noMatch)).toEqual([]);
    expect(board.isValidPlacement(noMatch, { coord: new GridCoord(1, 0), rotation: 0 })).toBe(false);

    const oneColorMatch = new PondTile(2, ['white', 'pink', 'blue', 'purple']);
    const placements = board.validPlacementsFor(oneColorMatch);
    expect(placements).toEqual([{ coord: new GridCoord(1, 0), rotation: 0 }]);
    expect(board.isValidPlacement(oneColorMatch, { coord: new GridCoord(1, 0), rotation: 0 })).toBe(true);
    expect(board.isValidPlacement(oneColorMatch, { coord: new GridCoord(1, 0), rotation: 1 })).toBe(false);

    board.placeTile(oneColorMatch, { coord: new GridCoord(1, 0), rotation: 0 });
    const southTile = new PondTile(3, ['black', 'yellow', 'blue', 'pink']);
    board.placeTile(southTile, { coord: new GridCoord(0, 1), rotation: 0 });

    const cornerFit = new PondTile(4, ['blue', 'purple', 'red', 'white']);
    expect(board.isValidPlacement(cornerFit, { coord: new GridCoord(1, 1), rotation: 0 })).toBe(true);
    expect(board.isValidPlacement(cornerFit, { coord: new GridCoord(1, 1), rotation: 2 })).toBe(false);
  });

  it('GAME-07: Board.placeTile rejects invalid moves and updates multi-edge frontier constraints incrementally', () => {
    const board = new Board();
    const t0 = new PondTile(0, ['red', 'orange', 'white', 'yellow']);
    const t1 = new PondTile(1, ['white', 'pink', 'blue', 'purple']);
    const t2 = new PondTile(2, ['black', 'yellow', 'blue', 'pink']);
    board.placeInitialTile(t0);

    expect(() => board.placeTile(t1, { coord: new GridCoord(0, 0), rotation: 0 })).toThrow();
    expect(() => board.placeTile(t1, { coord: new GridCoord(3, 3), rotation: 0 })).toThrow();
    expect(() => board.placeTile(t1, { coord: new GridCoord(1, 0), rotation: 1 })).toThrow();

    board.placeTile(t1, { coord: new GridCoord(1, 0), rotation: 0 });
    board.placeTile(t2, { coord: new GridCoord(0, 1), rotation: 0 });

    const byKey = new Map(board.frontierConstraints.map((c) => [c.coord.key, c]));
    expect(byKey.has('1,0')).toBe(false);
    expect(byKey.has('0,1')).toBe(false);
    expect(byKey.get('1,1')?.requiredEdges).toEqual(['blue', 'purple', null, null]);
    expect(byKey.get('1,1')?.neighborCount).toBe(2);
  });

  it('GAME-08: Board.placeTile detects 1, 2, and 4 simultaneous 2x2 corners with deduplicated adjacentColors', () => {
    const b1 = new Board();
    b1.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));
    b1.placeTile(new PondTile(1, ['white', 'pink', 'blue', 'yellow']), { coord: new GridCoord(1, 0), rotation: 0 });
    b1.placeTile(new PondTile(2, ['black', 'yellow', 'blue', 'pink']), { coord: new GridCoord(0, 1), rotation: 0 });
    const c1 = b1.placeTile(new PondTile(3, ['blue', 'yellow', 'red', 'purple']), { coord: new GridCoord(1, 1), rotation: 0 });
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

  it('GAME-09: Board.previewPlacement predicts corners, neighborCount, and affected frontier without mutating state', () => {
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

  it('GAME-10: Board.placeBloom validates corners/colors and Board.bounds tracks min/max coordinates', () => {
    const board = new Board();
    expect(board.bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect(board.placedBloomCount).toBe(0);
    expect(board.placedBlooms).toEqual([]);
    expect(board.bloomAt(new CornerCoord(0, 0))).toBeUndefined();

    board.placeInitialTile(new PondTile(0, ['red', 'orange', 'white', 'yellow']));
    expect(board.bounds).toEqual({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
    board.placeTile(new PondTile(1, ['white', 'pink', 'blue', 'yellow']), { coord: new GridCoord(1, 0), rotation: 0 });
    const t2 = new PondTile(2, ['black', 'yellow', 'blue', 'pink']);
    const sharedPreview = board.previewPlacement(t2, { coord: new GridCoord(0, 1), rotation: 0 });
    expect(sharedPreview.affectedFrontierConstraints.find((c) => c.coord.key === '1,1')?.requiredEdges).toEqual(['blue', 'yellow', null, null]);
    board.placeTile(t2, { coord: new GridCoord(0, 1), rotation: 0 });
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
