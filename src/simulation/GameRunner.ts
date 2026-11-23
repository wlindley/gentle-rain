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

  step(): TurnOutcome | null {
    if (this.game.isComplete) return null;
    if (this.game.validPlacements.length === 0) return this.game.discardCurrentTile();
    const placement = this.bot.choosePlacement(this.game, this.botRng);
    const pending = this.game.eligibleBloomsFor(placement);
    const blooms = this.bot.chooseBlooms(this.game, placement, pending, this.botRng);
    return this.game.applyMove(placement, blooms);
  }

  runToCompletion(): GameResult {
    while (!this.game.isComplete) this.step();
    return this.game.result!;
  }

  toSnapshot(): GameSnapshot { return this.game.toSnapshot(); }
}
