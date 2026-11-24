import type { Bot } from '../bots';
import { Game, GameResult, TileCatalog } from '../game';
import type { GameSnapshot, TurnOutcome } from '../game';
import { SeededRandomSource } from '../rng';

export class GameRunner {
  readonly game: Game;
  readonly bot: Bot;
  readonly seed: number;
  private readonly botRng: SeededRandomSource;

  constructor(bot: Bot, seed: number, catalog?: TileCatalog) {
    this.bot = bot;
    this.seed = seed;
    const deckRng = new SeededRandomSource(seed);
    this.botRng = deckRng.derive(1);
    this.game = Game.create(deckRng, catalog);
  }

  get isComplete(): boolean { return this.game.isComplete; }
  get result(): GameResult | null { return this.game.result; }

  step(): TurnOutcome | null {
    const view = this.game.activeView;
    if (!view) return null;
    if (view.validPlacements.length === 0) return this.game.discardCurrentTile();
    const placement = this.bot.choosePlacement(view, this.botRng);
    const pending = view.eligibleBloomsFor(placement);
    const blooms = this.bot.chooseBlooms(view, placement, pending, this.botRng);
    return this.game.applyMove(placement, blooms);
  }

  runToCompletion(): GameResult {
    while (!this.game.isComplete) this.step();
    return this.game.result!;
  }

  toSnapshot(): GameSnapshot { return this.game.toSnapshot(); }
}
