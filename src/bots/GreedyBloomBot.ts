import type { RandomSource } from '../rng';
import type { ActiveGameView, BloomPlacement, PendingCornerBloom, TilePlacement } from '../game';
import { BloomAssignmentSolver } from './BloomAssignmentSolver';
import { selectBestPlacement } from './BoardAnalysis';
import type { Bot } from './Bot';

export class GreedyBloomBot implements Bot {
  readonly id = 'greedy-bloom';
  readonly name = 'Greedy Bloom Bot';
  readonly description = 'Maximizes immediate blooms, breaking ties by higher neighbor count.';

  choosePlacement(view: ActiveGameView, rng: RandomSource): TilePlacement {
    return selectBestPlacement(
      view.validPlacements,
      (placement) => {
        const preview = view.board.previewPlacement(view.currentTile, placement);
        const blooms = BloomAssignmentSolver.solve(view.eligibleBloomsFor(placement)).length;
        return blooms * 10 + preview.neighborCount;
      },
      rng,
    );
  }

  chooseBlooms(
    _view: ActiveGameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    _rng: RandomSource,
  ): readonly BloomPlacement[] {
    return BloomAssignmentSolver.solve(pendingCorners);
  }
}
