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
export type NeighborCount = 1 | 2 | 3 | 4;

export const ALL_DIRECTIONS: readonly Direction[] = [
  Direction.West,
  Direction.North,
  Direction.East,
  Direction.South,
];

export const ALL_ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

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
  readonly neighborCount: NeighborCount;
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
  readonly neighborCount: NeighborCount;
}

export interface PendingCornerBloom {
  readonly corner: CornerCoord;
  readonly eligibleColors: readonly FlowerColor[];
}

interface BaseGameSnapshot {
  readonly placedTiles: readonly PlacedTile[];
  readonly placedBlooms: readonly BloomPlacement[];
  readonly discardedTiles: readonly PondTile[];
  readonly unplayedFlowers: readonly FlowerColor[];
  readonly remainingDrawCount: number;
  readonly turnNumber: number;
  readonly score: number;
  readonly bounds: BoardBounds;
}

export interface ActiveGameSnapshot extends BaseGameSnapshot {
  readonly isComplete: false;
  readonly isWin: false;
  readonly currentTile: PondTile;
}

export interface CompletedGameSnapshot extends BaseGameSnapshot {
  readonly isComplete: true;
  readonly isWin: boolean;
  readonly currentTile: null;
}

export type GameSnapshot = ActiveGameSnapshot | CompletedGameSnapshot;

export interface PlacedTurnOutcome {
  readonly kind: 'placed';
  readonly tile: PondTile;
  readonly placement: TilePlacement;
  readonly blooms: readonly BloomPlacement[];
}

export interface DiscardedTurnOutcome {
  readonly kind: 'discarded';
  readonly tile: PondTile;
}

export type TurnOutcome = PlacedTurnOutcome | DiscardedTurnOutcome;
