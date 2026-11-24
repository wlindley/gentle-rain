import type { RandomSource } from '../rng';
import type {
  ActiveGameView,
  BloomPlacement,
  FlowerColor,
  PendingCornerBloom,
  PondTile,
  TilePlacement,
} from '../game';
import { BloomAssignmentSolver } from './BloomAssignmentSolver';
import { countMatchingUnseen, countUnseenColors, selectBestPlacement } from './BoardAnalysis';
import type { Bot } from './Bot';

function scarcityPriority(unseenTiles: readonly PondTile[]): (color: FlowerColor) => number {
  const counts = countUnseenColors(unseenTiles);
  return (color: FlowerColor) => 100 - counts[color];
}

export class HeuristicBot implements Bot {
  readonly id = 'heuristic';
  readonly name = 'Heuristic Bot';
  readonly description = 'Evaluates immediate blooms, unseen-tile fillability, and color scarcity.';

  choosePlacement(view: ActiveGameView, rng: RandomSource): TilePlacement {
    const priority = scarcityPriority(view.unseenTiles);
    return selectBestPlacement(
      view.validPlacements,
      (placement) => {
        const preview = view.board.previewPlacement(view.currentTile, placement);
        const immediateBlooms = BloomAssignmentSolver.solve(view.eligibleBloomsFor(placement), priority).length;
        let score = immediateBlooms * 100 + preview.neighborCount * 6;
        for (const fc of preview.affectedFrontierConstraints) {
          if (fc.neighborCount < 2) continue;
          const matches = countMatchingUnseen(fc, view.unseenTiles);
          score += matches === 0 ? -18 * fc.neighborCount : 8 * fc.neighborCount + Math.min(matches, 4) * 2;
        }
        return score;
      },
      rng,
    );
  }

  chooseBlooms(
    view: ActiveGameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    _rng: RandomSource,
  ): readonly BloomPlacement[] {
    return BloomAssignmentSolver.solve(pendingCorners, scarcityPriority(view.unseenTiles));
  }
}
