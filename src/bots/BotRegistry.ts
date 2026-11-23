import type { Bot } from './Bot';
import { GreedyBloomBot } from './GreedyBloomBot';
import { HeuristicBot } from './HeuristicBot';
import { RandomBot } from './RandomBot';

export class BotRegistry {
  private readonly byId = new Map<string, Bot>();

  constructor(initialBots: readonly Bot[] = []) {
    for (const bot of initialBots) {
      this.register(bot);
    }
  }

  get bots(): readonly Bot[] {
    return Array.from(this.byId.values());
  }

  register(bot: Bot): void {
    if (this.byId.has(bot.id)) {
      throw new Error(`Bot with id "${bot.id}" is already registered`);
    }
    this.byId.set(bot.id, bot);
  }

  find(id: string): Bot | undefined {
    return this.byId.get(id);
  }

  require(id: string): Bot {
    const bot = this.byId.get(id);
    if (!bot) {
      throw new Error(`Unknown bot id "${id}"`);
    }
    return bot;
  }

  static createDefault(): BotRegistry {
    return new BotRegistry([new RandomBot(), new GreedyBloomBot(), new HeuristicBot()]);
  }
}
