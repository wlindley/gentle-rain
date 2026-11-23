import { describe, expect, it } from 'vitest';
import { CornerCoord, Direction, FLOWER_COLORS, GridCoord } from './index';

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
});
