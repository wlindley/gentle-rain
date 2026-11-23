export const FLOWER_COLORS = [
  'red',
  'orange',
  'white',
  'yellow',
  'pink',
  'blue',
  'purple',
  'black',
] as const;

export type FlowerColor = (typeof FLOWER_COLORS)[number];

export enum Direction {
  West = 0,
  North = 1,
  East = 2,
  South = 3,
}

export type Rotation = 0 | 1 | 2 | 3;

export interface BoardBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}
