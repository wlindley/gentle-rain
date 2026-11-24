import type { RandomSource } from '../rng';
import type { ActiveGameView, BloomPlacement, PendingCornerBloom, TilePlacement } from '../game';
import { BloomAssignmentSolver } from './BloomAssignmentSolver';
import type { Bot } from './Bot';

export class GreedyBloomBot implements Bot {
  readonly id = 'greedy-bloom';
  readonly name = 'Greedy Bloom Bot';
  readonly description = 'Maximizes immediate blooms, breaking ties by higher neighbor count.';

  choosePlacement(view: ActiveGameView, rng: RandomSource): TilePlacement {
    const tile = view.currentTile;
    let bestScore = Number.NEGATIVE_INFINITY;
    let best: TilePlacement[] = [];

    for (const placement of view.validPlacements) {
      const preview = view.board.previewPlacement(tile, placement);
      const pending = preview.completedCorners.map(({ corner, adjacentColors }) => ({
        corner,
        eligibleColors: adjacentColors.filter((c) => view.unplayedFlowers.has(c)),
      }));
      const score = BloomAssignmentSolver.solve(pending).length * 10 + preview.neighborCount;
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
    _view: ActiveGameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    _rng: RandomSource,
  ): readonly BloomPlacement[] {
    return BloomAssignmentSolver.solve(pendingCorners);
  }
}
