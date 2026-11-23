import type { Bot } from '../bots';
import type { TileCatalog } from '../game';
import { SimulationSession } from './SimulationSession';
import { SimulationStats } from './SimulationStats';

export interface TournamentSummary {
  readonly bot: Bot;
  readonly stats: SimulationStats;
}

export class TournamentRunner {
  readonly sessions: readonly SimulationSession[];

  constructor(
    bots: readonly Bot[],
    targetGames: number,
    parallelSlots: number,
    baseSeed: number,
    catalog?: TileCatalog,
  ) {
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
