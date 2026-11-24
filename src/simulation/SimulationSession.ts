import type { Bot } from '../bots';
import type { GameSnapshot, TileCatalog } from '../game';
import { SeededRandomSource } from '../rng';
import { GameRunner } from './GameRunner';
import type { BotRunRecord } from './ScoreStore';
import { SimulationStats } from './SimulationStats';

export interface SimulationConfig {
  readonly bot: Bot;
  readonly targetGames: number;
  readonly parallelSlots: number;
  readonly baseSeed: number;
  readonly catalog?: TileCatalog;
}

export interface SlotView {
  readonly slotIndex: number;
  readonly gameIndex: number;
  readonly snapshot: GameSnapshot;
}

interface ActiveSlot { gameIndex: number; runner: GameRunner; recorded: boolean; }

function assertPositiveInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer, received ${value}`);
}

export class SimulationSession {
  readonly config: SimulationConfig;
  private readonly baseRng: SeededRandomSource;
  private readonly _stats = new SimulationStats();
  private readonly slots: ActiveSlot[] = [];
  private nextGameIndex = 0;
  private cursor = 0;
  private _bestSnapshot: GameSnapshot | null = null;
  private _worstSnapshot: GameSnapshot | null = null;

  constructor(config: SimulationConfig) {
    assertPositiveInt(config.targetGames, 'targetGames');
    assertPositiveInt(config.parallelSlots, 'parallelSlots');
    this.config = config;
    this.baseRng = new SeededRandomSource(config.baseSeed);
    const slotCount = Math.min(config.parallelSlots, config.targetGames);
    for (let i = 0; i < slotCount; i += 1) {
      const gameIndex = this.nextGameIndex++;
      this.slots.push({ gameIndex, runner: this.createRunner(gameIndex), recorded: false });
    }
  }

  get completedGames(): number { return this._stats.totalGames; }
  get remainingGames(): number { return this.config.targetGames - this._stats.totalGames; }
  get isComplete(): boolean { return this._stats.totalGames >= this.config.targetGames; }
  get stats(): SimulationStats { return this._stats; }
  get bestSnapshot(): GameSnapshot | null { return this._bestSnapshot; }
  get worstSnapshot(): GameSnapshot | null { return this._worstSnapshot; }
  get slotViews(): readonly SlotView[] {
    return this.slots.map((s, slotIndex) => ({ slotIndex, gameIndex: s.gameIndex, snapshot: s.runner.toSnapshot() }));
  }

  stepTurns(turnsPerSlot: number): number {
    if (this.isComplete) return 0;
    let newlyCompleted = 0;
    for (const slot of this.slots) {
      if (slot.recorded) continue;
      for (let t = 0; t < turnsPerSlot; t += 1) {
        slot.runner.step();
        if (slot.runner.isComplete) { this.finishSlot(slot); newlyCompleted += 1; break; }
      }
    }
    return newlyCompleted;
  }

  stepGames(maxGames: number): number {
    let completed = 0;
    while (!this.isComplete && completed < maxGames) {
      const active = this.slots.filter((s) => !s.recorded);
      const slot = active[this.cursor++ % active.length]!;
      slot.runner.runToCompletion();
      this.finishSlot(slot);
      completed += 1;
    }
    return completed;
  }

  toRunRecord(id: string, timestampIso: string, seedExplicit: boolean): BotRunRecord {
    const scoreHistogram: Record<string, number> = {};
    for (const [score, count] of this._stats.scoreHistogram) scoreHistogram[String(score)] = count;
    const s = this._stats;
    return {
      id, botId: this.config.bot.id, botName: this.config.bot.name, timestampIso,
      baseSeed: seedExplicit ? this.config.baseSeed : null,
      totalGames: s.totalGames, winCount: s.winCount, winRate: s.winRate,
      meanScore: s.meanScore, medianScore: s.medianScore, p95Score: s.p95Score, p99Score: s.p99Score,
      minScore: s.minScore, maxScore: s.maxScore, meanBlooms: s.meanBlooms, scoreHistogram,
    };
  }

  private createRunner(gameIndex: number): GameRunner {
    return new GameRunner(this.config.bot, this.baseRng.derive(gameIndex).seed, this.config.catalog);
  }

  private finishSlot(slot: ActiveSlot): void {
    this._stats.record(slot.runner.result!);
    const snap = slot.runner.toSnapshot();
    if (!this._bestSnapshot || snap.score > this._bestSnapshot.score) this._bestSnapshot = snap;
    if (!this._worstSnapshot || snap.score < this._worstSnapshot.score) this._worstSnapshot = snap;
    if (this.nextGameIndex < this.config.targetGames) {
      slot.gameIndex = this.nextGameIndex++;
      slot.runner = this.createRunner(slot.gameIndex);
    } else {
      slot.recorded = true;
    }
  }
}
