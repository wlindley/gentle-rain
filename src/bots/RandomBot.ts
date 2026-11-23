import type { RandomSource } from '../rng';
import type { BloomPlacement, GameView, PendingCornerBloom, TilePlacement } from '../game';
import { BloomAssignmentSolver } from './BloomAssignmentSolver';
import type { Bot } from './Bot';

export class RandomBot implements Bot {
  readonly id = 'random';
  readonly name = 'Random Bot';
  readonly description = 'Selects a uniformly random valid placement and maximal bloom assignment.';

  choosePlacement(view: GameView, rng: RandomSource): TilePlacement {
    return view.validPlacements[rng.nextInt(view.validPlacements.length)]!;
  }

  chooseBlooms(
    _view: GameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    rng: RandomSource,
  ): readonly BloomPlacement[] {
    const shuffled = pendingCorners.map(({ corner, eligibleColors }) => ({
      corner,
      eligibleColors: rng.shuffle(eligibleColors),
    }));
    return BloomAssignmentSolver.solve(shuffled);
  }
}
