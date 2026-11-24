import { adviseMove } from '../bots';
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
    const advice = adviseMove(this.bot, view, this.botRng);
    if (advice.kind === 'discard') return this.game.discardCurrentTile();
    return this.game.applyMove(advice.placement, advice.blooms);
  }

  runToCompletion(): GameResult {
    while (!this.game.isComplete) this.step();
    return this.game.result!;
  }

  toSnapshot(): GameSnapshot { return this.game.toSnapshot(); }
}
