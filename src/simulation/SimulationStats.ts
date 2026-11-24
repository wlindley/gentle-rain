import { FLOWER_COLORS } from '../game';
import type { GameResult } from '../game';

export class SimulationStats {
  private readonly _scores: number[] = [];
  private readonly _bloomCounts: number[] = [];
  private _totalDiscards = 0;
  private _sortedCache: number[] | null = null;

  constructor(results: readonly GameResult[] = []) {
    for (const r of results) this.record(r);
  }

  get totalGames(): number { return this._scores.length; }
  get scores(): readonly number[] { return [...this._scores]; }
  get bloomCounts(): readonly number[] { return [...this._bloomCounts]; }
  get totalDiscards(): number { return this._totalDiscards; }

  record(result: GameResult): void {
    this._scores.push(result.score);
    this._bloomCounts.push(result.placedFlowers);
    this._totalDiscards += result.discardedTilesCount;
    this._sortedCache = null;
  }

  get winCount(): number { return this._bloomCounts.filter((b) => b === FLOWER_COLORS.length).length; }
  get winRate(): number { return this.totalGames === 0 ? 0 : this.winCount / this.totalGames; }
  get meanScore(): number { return this.mean(this._scores); }
  get medianScore(): number {
    const s = this.sortedScores();
    const n = s.length;
    if (n === 0) return 0;
    const mid = Math.floor(n / 2);
    return n % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
  }
  get p95Score(): number { return this.percentile(0.95); }
  get p99Score(): number { return this.percentile(0.99); }
  get stdDevScore(): number {
    if (this._scores.length === 0) return 0;
    const m = this.meanScore;
    return Math.sqrt(this._scores.reduce((sum, x) => sum + (x - m) ** 2, 0) / this._scores.length);
  }
  get minScore(): number { return this._scores.length === 0 ? 0 : this.sortedScores()[0]!; }
  get maxScore(): number { return this._scores.length === 0 ? 0 : this.sortedScores()[this._scores.length - 1]!; }
  get meanBlooms(): number { return this.mean(this._bloomCounts); }
  get meanDiscards(): number { return this.totalGames === 0 ? 0 : this._totalDiscards / this.totalGames; }
  get scoreHistogram(): ReadonlyMap<number, number> {
    const map = new Map<number, number>();
    for (const s of this._scores) map.set(s, (map.get(s) ?? 0) + 1);
    return map;
  }
  get bloomHistogram(): readonly number[] {
    const hist = Array<number>(FLOWER_COLORS.length + 1).fill(0);
    for (const b of this._bloomCounts) hist[b]! += 1;
    return hist;
  }

  private sortedScores(): readonly number[] {
    this._sortedCache ??= [...this._scores].sort((a, b) => a - b);
    return this._sortedCache;
  }
  private mean(values: readonly number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
  }
  private percentile(p: number): number {
    const s = this.sortedScores();
    return s.length === 0 ? 0 : s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]!;
  }
}
