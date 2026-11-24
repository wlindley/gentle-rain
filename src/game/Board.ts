import { CornerCoord, GridCoord } from './Coords';
import { PondTile } from './PondTile';
import { ALL_DIRECTIONS, ALL_ROTATIONS, Direction } from './types';
import type {
  BloomPlacement,
  BoardBounds,
  CompletedCorner,
  FlowerColor,
  FrontierConstraint,
  NeighborCount,
  PlacedTile,
  PlacementPreview,
  Rotation,
  TilePlacement,
} from './types';

const CORNER_OFFSETS: readonly (readonly [number, number])[] = [[-1, -1], [0, -1], [-1, 0], [0, 0]];
const packCoord = (x: number, y: number): number => (x + 32768) * 65536 + (y + 32768);
type MutableEdges = [FlowerColor | null, FlowerColor | null, FlowerColor | null, FlowerColor | null];
interface MutableFrontierEntry { readonly coord: GridCoord; readonly requiredEdges: MutableEdges; neighborCount: number; }

export interface ReadonlyBoardView {
  readonly placedTileCount: number;
  readonly placedBloomCount: number;
  readonly placedTiles: readonly PlacedTile[];
  readonly placedBlooms: readonly BloomPlacement[];
  readonly frontierConstraints: readonly FrontierConstraint[];
  readonly bounds: BoardBounds;
  tileAt(coord: GridCoord): PlacedTile | undefined;
  bloomAt(corner: CornerCoord): FlowerColor | undefined;
  validPlacementsFor(tile: PondTile): readonly TilePlacement[];
  isValidPlacement(tile: PondTile, placement: TilePlacement): boolean;
  previewPlacement(tile: PondTile, placement: TilePlacement): PlacementPreview;
}

export class Board implements ReadonlyBoardView {
  private readonly tiles = new Map<number, PlacedTile>();
  private readonly frontier = new Map<number, MutableFrontierEntry>();
  private readonly blooms = new Map<number, BloomPlacement>();
  private minX = 0;
  private maxX = 0;
  private minY = 0;
  private maxY = 0;

  get placedTileCount(): number { return this.tiles.size; }
  get placedBloomCount(): number { return this.blooms.size; }
  get placedTiles(): readonly PlacedTile[] { return Array.from(this.tiles.values()); }
  get placedBlooms(): readonly BloomPlacement[] { return Array.from(this.blooms.values()); }
  get bounds(): BoardBounds { return { minX: this.minX, maxX: this.maxX, minY: this.minY, maxY: this.maxY }; }
  get frontierConstraints(): readonly FrontierConstraint[] {
    return Array.from(this.frontier.values(), ({ coord, requiredEdges, neighborCount }) => ({
      coord,
      requiredEdges: [...requiredEdges] as FrontierConstraint['requiredEdges'],
      neighborCount: neighborCount as NeighborCount,
    }));
  }
  placeInitialTile(tile: PondTile, rotation: Rotation = 0): void {
    if (this.tiles.size > 0) throw new Error('Cannot place initial tile on a non-empty board');
    this.commitTile(tile, new GridCoord(0, 0), rotation);
  }
  placeTile(tile: PondTile, placement: TilePlacement): readonly CompletedCorner[] {
    if (!this.isValidPlacement(tile, placement)) throw new Error(`Invalid placement at ${placement.coord.key}`);
    this.commitTile(tile, placement.coord, placement.rotation);
    return this.completedCornersFor(placement.coord);
  }
  tileAt(coord: GridCoord): PlacedTile | undefined { return this.tiles.get(packCoord(coord.x, coord.y)); }
  bloomAt(corner: CornerCoord): FlowerColor | undefined { return this.blooms.get(packCoord(corner.cx, corner.cy))?.color; }
  placeBloom(bloom: BloomPlacement): void {
    const key = packCoord(bloom.corner.cx, bloom.corner.cy);
    if (this.blooms.has(key)) throw new Error(`Corner ${bloom.corner.key} already has a bloom`);
    const colors = this.cornerAdjacentColors(bloom.corner.cx, bloom.corner.cy);
    if (!colors || !colors.includes(bloom.color)) throw new Error(`Invalid bloom ${bloom.color} at ${bloom.corner.key}`);
    this.blooms.set(key, bloom);
  }
  previewPlacement(tile: PondTile, placement: TilePlacement): PlacementPreview {
    if (!this.isValidPlacement(tile, placement)) throw new Error(`Invalid placement at ${placement.coord.key}`);
    const entry = this.frontier.get(packCoord(placement.coord.x, placement.coord.y))!;
    const affectedFrontierConstraints: FrontierConstraint[] = [];
    for (const dir of ALL_DIRECTIONS) {
      const neighbor = placement.coord.neighbor(dir);
      const nKey = packCoord(neighbor.x, neighbor.y);
      if (this.tiles.has(nKey)) continue;
      const existing = this.frontier.get(nKey);
      const requiredEdges: MutableEdges = existing ? [...existing.requiredEdges] : [null, null, null, null];
      requiredEdges[(dir + 2) & 3] = tile.edgeAt(dir, placement.rotation);
      affectedFrontierConstraints.push({
        coord: neighbor,
        requiredEdges,
        neighborCount: ((existing?.neighborCount ?? 0) + 1) as NeighborCount,
      });
    }
    const completedCorners = this.completedCornersFor(placement.coord, { tile, coord: placement.coord, rotation: placement.rotation });
    return { placement, completedCorners, affectedFrontierConstraints, neighborCount: entry.neighborCount as NeighborCount };
  }
  validPlacementsFor(tile: PondTile): readonly TilePlacement[] {
    const out: TilePlacement[] = [];
    for (const entry of this.frontier.values()) {
      for (const rotation of ALL_ROTATIONS) if (this.matches(tile, rotation, entry)) out.push({ coord: entry.coord, rotation });
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
    this.minX = Math.min(this.minX, coord.x);
    this.maxX = Math.max(this.maxX, coord.x);
    this.minY = Math.min(this.minY, coord.y);
    this.maxY = Math.max(this.maxY, coord.y);
    for (const dir of ALL_DIRECTIONS) {
      const neighbor = coord.neighbor(dir);
      const nKey = packCoord(neighbor.x, neighbor.y);
      if (this.tiles.has(nKey)) continue;
      let entry = this.frontier.get(nKey);
      if (!entry) { entry = { coord: neighbor, requiredEdges: [null, null, null, null], neighborCount: 0 }; this.frontier.set(nKey, entry); }
      entry.requiredEdges[(dir + 2) & 3] = tile.edgeAt(dir, rotation);
      entry.neighborCount += 1;
    }
  }
  private completedCornersFor(coord: GridCoord, override?: PlacedTile): readonly CompletedCorner[] {
    const out: CompletedCorner[] = [];
    for (const [dx, dy] of CORNER_OFFSETS) {
      const cx = coord.x + dx;
      const cy = coord.y + dy;
      const adjacentColors = this.cornerAdjacentColors(cx, cy, override);
      if (adjacentColors) out.push({ corner: new CornerCoord(cx, cy), adjacentColors });
    }
    return out;
  }
  private cornerAdjacentColors(cx: number, cy: number, override?: PlacedTile): readonly FlowerColor[] | null {
    const nw = this.lookupTile(cx, cy, override);
    const ne = this.lookupTile(cx + 1, cy, override);
    const sw = this.lookupTile(cx, cy + 1, override);
    const se = this.lookupTile(cx + 1, cy + 1, override);
    if (!nw || !ne || !sw || !se) return null;
    return Array.from(new Set([
      nw.tile.edgeAt(Direction.East, nw.rotation),
      ne.tile.edgeAt(Direction.South, ne.rotation),
      sw.tile.edgeAt(Direction.East, sw.rotation),
      nw.tile.edgeAt(Direction.South, nw.rotation),
    ]));
  }
  private lookupTile(x: number, y: number, override?: PlacedTile): PlacedTile | undefined {
    return override && override.coord.x === x && override.coord.y === y ? override : this.tiles.get(packCoord(x, y));
  }
  private matches(tile: PondTile, rotation: Rotation, entry: MutableFrontierEntry): boolean {
    for (const dir of ALL_DIRECTIONS) {
      const req = entry.requiredEdges[dir];
      if (req !== null && tile.edgeAt(dir, rotation) !== req) return false;
    }
    return true;
  }
}
