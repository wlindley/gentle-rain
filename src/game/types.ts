import type { CornerCoord, GridCoord } from './Coords';
import type { PondTile } from './PondTile';

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

export interface PlacedTile {
  readonly tile: PondTile;
  readonly coord: GridCoord;
  readonly rotation: Rotation;
}

export interface TilePlacement {
  readonly coord: GridCoord;
  readonly rotation: Rotation;
}

export interface FrontierConstraint {
  readonly coord: GridCoord;
  readonly requiredEdges: readonly [
    FlowerColor | null,
    FlowerColor | null,
    FlowerColor | null,
    FlowerColor | null,
  ];
  readonly neighborCount: number;
}

export interface CompletedCorner {
  readonly corner: CornerCoord;
  readonly adjacentColors: readonly FlowerColor[];
}

export interface BloomPlacement {
  readonly corner: CornerCoord;
  readonly color: FlowerColor;
}

export interface PlacementPreview {
  readonly placement: TilePlacement;
  readonly completedCorners: readonly CompletedCorner[];
  readonly affectedFrontierConstraints: readonly FrontierConstraint[];
  readonly neighborCount: number;
}

export interface PendingCornerBloom {
  readonly corner: CornerCoord;
  readonly eligibleColors: readonly FlowerColor[];
}

export type TurnOutcome =
  | {
      readonly kind: 'placed';
      readonly tile: PondTile;
      readonly placement: TilePlacement;
      readonly blooms: readonly BloomPlacement[];
    }
  | { readonly kind: 'discarded'; readonly tile: PondTile };
