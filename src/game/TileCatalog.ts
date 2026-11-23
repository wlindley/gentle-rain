import defaultRawTiles from '../../rules/pond-tiles.json';
import { PondTile } from './PondTile';
import { FlowerColor } from './types';

const EXPECTED_TILE_COUNT = 28;

export class TileCatalog {
  private static cachedDefault: TileCatalog | undefined;

  readonly tiles: readonly PondTile[];

  constructor(rawTiles: readonly (readonly string[])[]) {
    if (rawTiles.length !== EXPECTED_TILE_COUNT) {
      throw new RangeError(`Expected ${EXPECTED_TILE_COUNT} tiles, received ${rawTiles.length}`);
    }
    const tiles: PondTile[] = [];
    const seenKeys = new Set<string>();
    for (let i = 0; i < rawTiles.length; i += 1) {
      const raw = rawTiles[i]!;
      if (raw.length !== 4) {
        throw new RangeError(`Tile ${i} must have 4 edges, received ${raw.length}`);
      }
      const edges = [raw[0]!, raw[1]!, raw[2]!, raw[3]!] as [
        FlowerColor,
        FlowerColor,
        FlowerColor,
        FlowerColor,
      ];
      const tile = new PondTile(i, edges);
      const key = tile.canonicalKey();
      if (seenKeys.has(key)) {
        throw new RangeError(`Duplicate tile orientation: ${key}`);
      }
      seenKeys.add(key);
      tiles.push(tile);
    }
    this.tiles = Object.freeze(tiles);
  }

  static defaultCatalog(): TileCatalog {
    TileCatalog.cachedDefault ??= new TileCatalog(defaultRawTiles);
    return TileCatalog.cachedDefault;
  }
}
