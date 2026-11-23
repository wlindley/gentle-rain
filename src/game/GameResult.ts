import { FLOWER_COLORS } from './types';

export interface GameResultParams {
  readonly placedFlowers: number;
  readonly remainingDrawCount: number;
  readonly placedTilesCount: number;
  readonly discardedTilesCount: number;
  readonly turnsPlayed: number;
}

export class GameResult {
  readonly placedFlowers: number;
  readonly remainingDrawCount: number;
  readonly placedTilesCount: number;
  readonly discardedTilesCount: number;
  readonly turnsPlayed: number;

  constructor(params: GameResultParams) {
    this.placedFlowers = params.placedFlowers;
    this.remainingDrawCount = params.remainingDrawCount;
    this.placedTilesCount = params.placedTilesCount;
    this.discardedTilesCount = params.discardedTilesCount;
    this.turnsPlayed = params.turnsPlayed;
  }

  get score(): number {
    return this.placedFlowers + this.remainingDrawCount;
  }

  get isWin(): boolean {
    return this.placedFlowers === FLOWER_COLORS.length;
  }
}
