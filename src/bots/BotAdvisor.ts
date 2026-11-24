import type { ActiveGameView, BloomPlacement, TilePlacement } from '../game';
import type { RandomSource } from '../rng';
import type { Bot } from './Bot';

export type BotMoveAdvice =
  | { readonly kind: 'discard' }
  | {
      readonly kind: 'place';
      readonly placement: TilePlacement;
      readonly blooms: readonly BloomPlacement[];
    };

export function adviseMove(bot: Bot, view: ActiveGameView, rng: RandomSource): BotMoveAdvice {
  if (view.validPlacements.length === 0) return { kind: 'discard' };
  const placement = bot.choosePlacement(view, rng);
  const pending = view.eligibleBloomsFor(placement);
  const blooms = pending.length > 0 ? bot.chooseBlooms(view, placement, pending, rng) : [];
  return { kind: 'place', placement, blooms };
}
