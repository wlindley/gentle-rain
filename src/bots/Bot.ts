import type { RandomSource } from '../rng';
import type { ActiveGameView, BloomPlacement, PendingCornerBloom, TilePlacement } from '../game';

export interface Bot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  choosePlacement(view: ActiveGameView, rng: RandomSource): TilePlacement;
  chooseBlooms(
    view: ActiveGameView,
    placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    rng: RandomSource,
  ): readonly BloomPlacement[];
}
