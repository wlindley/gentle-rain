import type { RandomSource } from '../rng';
import type { BloomPlacement, GameView, PendingCornerBloom, TilePlacement } from '../game';

export interface Bot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  choosePlacement(view: GameView, rng: RandomSource): TilePlacement;
  chooseBlooms(
    view: GameView,
    placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    rng: RandomSource,
  ): readonly BloomPlacement[];
}
