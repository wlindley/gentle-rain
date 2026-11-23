import { Direction, FLOWER_COLORS, FlowerColor, Rotation } from './types';

const VALID_COLORS: ReadonlySet<string> = new Set(FLOWER_COLORS);
const ROTATIONS: readonly Rotation[] = [1, 2, 3];

export class PondTile {
  readonly id: number;
  readonly baseEdges: readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor];

  constructor(id: number, edges: readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor]) {
    if (!Number.isInteger(id) || id < 0) {
      throw new RangeError(`Tile id must be a non-negative integer, received ${id}`);
    }
    const seen = new Set<FlowerColor>();
    for (const color of edges) {
      if (!VALID_COLORS.has(color) || seen.has(color)) {
        throw new RangeError(`Invalid or duplicate edge color: ${color}`);
      }
      seen.add(color);
    }
    this.id = id;
    this.baseEdges = Object.freeze([edges[0], edges[1], edges[2], edges[3]] as const);
  }

  edgeAt(dir: Direction, rotation: Rotation = 0): FlowerColor {
    return this.baseEdges[(dir - rotation + 4) % 4]!;
  }

  edgesAt(rotation: Rotation): readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor] {
    return [
      this.edgeAt(Direction.West, rotation),
      this.edgeAt(Direction.North, rotation),
      this.edgeAt(Direction.East, rotation),
      this.edgeAt(Direction.South, rotation),
    ];
  }

  hasColor(color: FlowerColor): boolean {
    return this.baseEdges.includes(color);
  }

  canonicalKey(): string {
    let best = this.edgesAt(0).join(',');
    for (const rotation of ROTATIONS) {
      const key = this.edgesAt(rotation).join(',');
      if (key < best) {
        best = key;
      }
    }
    return best;
  }
}
