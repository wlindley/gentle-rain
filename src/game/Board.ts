import { GridCoord } from './Coords';
import { PondTile } from './PondTile';
import { Direction } from './types';
import type { CompletedCorner, FlowerColor, FrontierConstraint, PlacedTile, Rotation, TilePlacement } from './types';

const DIRECTIONS: readonly Direction[] = [Direction.West, Direction.North, Direction.East, Direction.South];
const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];
const packCoord = (x: number, y: number): number => (x + 32768) * 65536 + (y + 32768);
type MutableEdges = [FlowerColor | null, FlowerColor | null, FlowerColor | null, FlowerColor | null];
interface MutableFrontierEntry { readonly coord: GridCoord; readonly requiredEdges: MutableEdges; neighborCount: number; }

export interface ReadonlyBoardView {
  readonly placedTileCount: number;
  readonly placedTiles: readonly PlacedTile[];
  readonly frontierConstraints: readonly FrontierConstraint[];
  tileAt(coord: GridCoord): PlacedTile | undefined;
  validPlacementsFor(tile: PondTile): readonly TilePlacement[];
  isValidPlacement(tile: PondTile, placement: TilePlacement): boolean;
}

export class Board implements ReadonlyBoardView {
  private readonly tiles = new Map<number, PlacedTile>();
  private readonly frontier = new Map<number, MutableFrontierEntry>();
  get placedTileCount(): number { return this.tiles.size; }
  get placedTiles(): readonly PlacedTile[] { return Array.from(this.tiles.values()); }
  get frontierConstraints(): readonly FrontierConstraint[] {
    return Array.from(this.frontier.values(), ({ coord, requiredEdges, neighborCount }) => ({
      coord, requiredEdges: [...requiredEdges] as FrontierConstraint['requiredEdges'], neighborCount,
    }));
  }
  placeInitialTile(tile: PondTile, rotation: Rotation = 0): void {
    if (this.tiles.size > 0) throw new Error('Cannot place initial tile on a non-empty board');
    this.commitTile(tile, new GridCoord(0, 0), rotation);
  }
  placeTile(tile: PondTile, placement: TilePlacement): readonly CompletedCorner[] {
    if (!this.isValidPlacement(tile, placement)) throw new Error(`Invalid placement at ${placement.coord.key}`);
    this.commitTile(tile, placement.coord, placement.rotation);
    return [];
  }
  tileAt(coord: GridCoord): PlacedTile | undefined { return this.tiles.get(packCoord(coord.x, coord.y)); }
  validPlacementsFor(tile: PondTile): readonly TilePlacement[] {
    const out: TilePlacement[] = [];
    for (const entry of this.frontier.values()) {
      for (const rotation of ROTATIONS) if (this.matches(tile, rotation, entry)) out.push({ coord: entry.coord, rotation });
    }
    return out;
  }
  isValidPlacement(tile: PondTile, placement: TilePlacement): boolean {
    const entry = this.frontier.get(packCoord(placement.coord.x, placement.coord.y));
    return entry !== undefined && this.matches(tile, placement.rotation, entry);
  }
  private commitTile(tile: PondTile, coord: GridCoord, rotation: Rotation): void {
    const key = packCoord(coord.x, coord.y);
    this.tiles.set(key, { tile, coord, rotation });
    this.frontier.delete(key);
    for (const dir of DIRECTIONS) {
      const neighbor = coord.neighbor(dir);
      const nKey = packCoord(neighbor.x, neighbor.y);
      if (this.tiles.has(nKey)) continue;
      let entry = this.frontier.get(nKey);
      if (!entry) { entry = { coord: neighbor, requiredEdges: [null, null, null, null], neighborCount: 0 }; this.frontier.set(nKey, entry); }
      entry.requiredEdges[(dir + 2) & 3] = tile.edgeAt(dir, rotation);
      entry.neighborCount += 1;
    }
  }
  private matches(tile: PondTile, rotation: Rotation, entry: MutableFrontierEntry): boolean {
    for (const dir of DIRECTIONS) {
      const req = entry.requiredEdges[dir];
      if (req !== null && tile.edgeAt(dir, rotation) !== req) return false;
    }
    return true;
  }
}
