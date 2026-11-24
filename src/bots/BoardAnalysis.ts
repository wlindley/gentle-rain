import { ALL_DIRECTIONS, ALL_ROTATIONS, FLOWER_COLORS } from '../game';
import type { FlowerColor, FrontierConstraint, PondTile, TilePlacement } from '../game';
import type { RandomSource } from '../rng';

function zeroColorCounts(): Record<FlowerColor, number> {
  const counts = {} as Record<FlowerColor, number>;
  for (const color of FLOWER_COLORS) counts[color] = 0;
  return counts;
}

export function countUnseenColors(unseenTiles: readonly PondTile[]): Record<FlowerColor, number> {
  const counts = zeroColorCounts();
  for (const tile of unseenTiles) {
    for (const color of tile.baseEdges) counts[color] += 1;
  }
  return counts;
}

export function countFrontierColors(constraints: readonly FrontierConstraint[]): Record<FlowerColor, number> {
  const counts = zeroColorCounts();
  for (const fc of constraints) {
    for (const req of fc.requiredEdges) {
      if (req !== null) counts[req] += 1;
    }
  }
  return counts;
}

export function tileFitsConstraint(
  tile: PondTile,
  requiredEdges: FrontierConstraint['requiredEdges'],
): boolean {
  for (const rot of ALL_ROTATIONS) {
    let ok = true;
    for (const dir of ALL_DIRECTIONS) {
      const req = requiredEdges[dir];
      if (req !== null && tile.edgeAt(dir, rot) !== req) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export function countMatchingUnseen(
  constraint: FrontierConstraint,
  unseenTiles: readonly PondTile[],
): number {
  let matches = 0;
  for (const tile of unseenTiles) {
    if (tileFitsConstraint(tile, constraint.requiredEdges)) matches += 1;
  }
  return matches;
}

export function selectBestPlacement(
  placements: readonly TilePlacement[],
  scoreFn: (placement: TilePlacement) => number,
  rng: RandomSource,
): TilePlacement {
  let bestScore = Number.NEGATIVE_INFINITY;
  let best: TilePlacement[] = [];
  for (const placement of placements) {
    const score = scoreFn(placement);
    if (score > bestScore) {
      bestScore = score;
      best = [placement];
    } else if (score === bestScore) {
      best.push(placement);
    }
  }
  return best[rng.nextInt(best.length)]!;
}
