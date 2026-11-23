import { Direction } from './types';

const INT_PAIR_RE = /^(-?\d+),(-?\d+)$/;

const DIRECTION_DELTAS: Record<Direction, readonly [number, number]> = {
  [Direction.West]: [-1, 0],
  [Direction.North]: [0, -1],
  [Direction.East]: [1, 0],
  [Direction.South]: [0, 1],
};

function assertIntPair(a: number, b: number, label: string): void {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new RangeError(`${label} coordinates must be integers, received (${a}, ${b})`);
  }
}

function parseIntPairKey(key: string, label: string): readonly [number, number] {
  const match = INT_PAIR_RE.exec(key);
  if (!match) {
    throw new RangeError(`Invalid ${label} key: "${key}"`);
  }
  return [Number(match[1]), Number(match[2])];
}

export class GridCoord {
  readonly x: number;
  readonly y: number;
  readonly key: string;

  constructor(x: number, y: number) {
    assertIntPair(x, y, 'GridCoord');
    this.x = x;
    this.y = y;
    this.key = `${x},${y}`;
  }

  neighbor(dir: Direction): GridCoord {
    const [dx, dy] = DIRECTION_DELTAS[dir];
    return new GridCoord(this.x + dx, this.y + dy);
  }

  equals(other: GridCoord): boolean {
    return this.key === other.key;
  }

  static fromKey(key: string): GridCoord {
    const [x, y] = parseIntPairKey(key, 'GridCoord');
    return new GridCoord(x, y);
  }
}

export class CornerCoord {
  readonly cx: number;
  readonly cy: number;
  readonly key: string;

  constructor(cx: number, cy: number) {
    assertIntPair(cx, cy, 'CornerCoord');
    this.cx = cx;
    this.cy = cy;
    this.key = `${cx},${cy}`;
  }

  equals(other: CornerCoord): boolean {
    return this.key === other.key;
  }

  static fromKey(key: string): CornerCoord {
    const [cx, cy] = parseIntPairKey(key, 'CornerCoord');
    return new CornerCoord(cx, cy);
  }
}
