import type { RandomSource } from '../rng';
import { Direction } from '../game';
import type {
  BloomPlacement,
  FlowerColor,
  FrontierConstraint,
  GameView,
  PendingCornerBloom,
  PondTile,
  Rotation,
  TilePlacement,
} from '../game';
import { BloomAssignmentSolver } from './BloomAssignmentSolver';
import type { Bot } from './Bot';

const DIRECTIONS: readonly Direction[] = [Direction.West, Direction.North, Direction.East, Direction.South];
const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

function scarcityPriority(unseenTiles: readonly PondTile[]): (color: FlowerColor) => number {
  const counts = new Map<FlowerColor, number>();
  for (const tile of unseenTiles) {
    for (const color of tile.baseEdges) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  return (color: FlowerColor) => 100 - (counts.get(color) ?? 0);
}

function tileFitsConstraint(tile: PondTile, requiredEdges: FrontierConstraint['requiredEdges']): boolean {
  for (const rot of ROTATIONS) {
    let ok = true;
    for (const dir of DIRECTIONS) {
      const req = requiredEdges[dir];
      if (req !== null && tile.edgeAt(dir, rot) !== req) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function countMatchingUnseen(constraint: FrontierConstraint, unseenTiles: readonly PondTile[]): number {
  let matches = 0;
  for (const tile of unseenTiles) {
    if (tileFitsConstraint(tile, constraint.requiredEdges)) matches += 1;
  }
  return matches;
}

export class HeuristicBot implements Bot {
  readonly id = 'heuristic';
  readonly name = 'Heuristic Bot';
  readonly description = 'Evaluates immediate blooms, unseen-tile fillability, and color scarcity.';

  choosePlacement(view: GameView, rng: RandomSource): TilePlacement {
    const tile = view.currentTile!;
    const priority = scarcityPriority(view.unseenTiles);
    let bestScore = Number.NEGATIVE_INFINITY;
    let best: TilePlacement[] = [];

    for (const placement of view.validPlacements) {
      const preview = view.board.previewPlacement(tile, placement);
      const pending = preview.completedCorners.map(({ corner, adjacentColors }) => ({
        corner,
        eligibleColors: adjacentColors.filter((c) => view.unplayedFlowers.has(c)),
      }));
      const immediateBlooms = BloomAssignmentSolver.solve(pending, priority).length;
      let score = immediateBlooms * 100 + preview.neighborCount * 6;
      for (const fc of preview.affectedFrontierConstraints) {
        if (fc.neighborCount < 2) continue;
        const matches = countMatchingUnseen(fc, view.unseenTiles);
        score += matches === 0 ? -18 * fc.neighborCount : 8 * fc.neighborCount + Math.min(matches, 4) * 2;
      }
      if (score > bestScore) {
        bestScore = score;
        best = [placement];
      } else if (score === bestScore) {
        best.push(placement);
      }
    }

    return best[rng.nextInt(best.length)]!;
  }

  chooseBlooms(
    view: GameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    _rng: RandomSource,
  ): readonly BloomPlacement[] {
    return BloomAssignmentSolver.solve(pendingCorners, scarcityPriority(view.unseenTiles));
  }
}
