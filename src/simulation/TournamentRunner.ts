import type { Bot } from '../bots';
import type { TileCatalog } from '../game';
import { SimulationSession } from './SimulationSession';
import { SimulationStats } from './SimulationStats';

export interface TournamentConfig {
  readonly bots: readonly Bot[];
  readonly targetGames: number;
  readonly parallelSlots: number;
  readonly baseSeed: number;
  readonly catalog?: TileCatalog;
}

export interface TournamentSummary {
  readonly bot: Bot;
  readonly stats: SimulationStats;
}

export class TournamentRunner {
  readonly sessions: readonly SimulationSession[];

  constructor(config: TournamentConfig) {
    const { bots, targetGames, parallelSlots, baseSeed, catalog } = config;
    if (bots.length === 0) {
      throw new RangeError('TournamentRunner requires at least one bot');
    }
    this.sessions = bots.map(
      (bot) => new SimulationSession({ bot, targetGames, parallelSlots, baseSeed, catalog }),
    );
  }

  get isComplete(): boolean {
    return this.sessions.every((s) => s.isComplete);
  }

  get rankedSummaries(): readonly TournamentSummary[] {
    return this.sessions
      .map((s) => ({ bot: s.config.bot, stats: s.stats }))
      .sort((a, b) => b.stats.meanScore - a.stats.meanScore);
  }

  stepGamesAll(maxGamesPerBot: number): void {
    for (const session of this.sessions) {
      session.stepGames(maxGamesPerBot);
    }
  }
}
