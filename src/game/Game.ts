import type { RandomSource } from '../rng';
import { Board, type ReadonlyBoardView } from './Board';
import { GameResult } from './GameResult';
import { PondTile } from './PondTile';
import { TileCatalog } from './TileCatalog';
import { FLOWER_COLORS } from './types';
import type {
  BloomPlacement,
  DiscardedTurnOutcome,
  FlowerColor,
  GameSnapshot,
  PendingCornerBloom,
  PlacedTurnOutcome,
  TilePlacement,
} from './types';

export interface GameView {
  readonly board: ReadonlyBoardView;
  readonly currentTile: PondTile | null;
  readonly validPlacements: readonly TilePlacement[];
  readonly unplayedFlowers: ReadonlySet<FlowerColor>;
  readonly remainingDrawCount: number;
  readonly discardedTiles: readonly PondTile[];
  readonly unseenTiles: readonly PondTile[];
  readonly turnNumber: number;
  readonly isComplete: boolean;
  readonly score: number;
  readonly isWin: boolean;
  eligibleBloomsFor(placement: TilePlacement): readonly PendingCornerBloom[];
}

export interface ActiveGameView extends GameView {
  readonly isComplete: false;
  readonly isWin: false;
  readonly currentTile: PondTile;
}
export class Game implements GameView {
  private readonly _board = new Board();
  private readonly _unplayedFlowers = new Set<FlowerColor>(FLOWER_COLORS);
  private readonly _discardedTiles: PondTile[] = [];
  private drawIndex = 2;
  private _currentTile: PondTile | null;
  private _validPlacements: readonly TilePlacement[];
  private _turnNumber = 0;
  private constructor(private readonly deck: readonly PondTile[]) {
    this._board.placeInitialTile(deck[0]!);
    this._currentTile = deck[1]!;
    this._validPlacements = this._board.validPlacementsFor(this._currentTile);
  }
  static create(rng: RandomSource, catalog: TileCatalog = TileCatalog.defaultCatalog()): Game { return new Game(rng.shuffle(catalog.tiles)); }
  get board(): ReadonlyBoardView { return this._board; }
  get currentTile(): PondTile | null { return this._currentTile; }
  get validPlacements(): readonly TilePlacement[] { return this._validPlacements; }
  get unplayedFlowers(): ReadonlySet<FlowerColor> { return this._unplayedFlowers; }
  get remainingDrawCount(): number { return this.deck.length - this.drawIndex; }
  get discardedTiles(): readonly PondTile[] { return [...this._discardedTiles]; }
  get unseenTiles(): readonly PondTile[] { return this.deck.slice(this.drawIndex).sort((a, b) => a.id - b.id); }
  get turnNumber(): number { return this._turnNumber; }
  get isWin(): boolean { return this._board.placedBloomCount === FLOWER_COLORS.length; }
  get isComplete(): boolean { return this.isWin || this._currentTile === null; }
  get score(): number { return this.isWin ? this._board.placedBloomCount + this.remainingDrawCount : this._board.placedBloomCount; }
  get result(): GameResult | null {
    if (!this.isComplete) return null;
    return new GameResult({
      placedFlowers: this._board.placedBloomCount,
      remainingDrawCount: this.remainingDrawCount,
      placedTilesCount: this._board.placedTileCount,
      discardedTilesCount: this._discardedTiles.length,
      turnsPlayed: this._turnNumber,
    });
  }
  get activeView(): ActiveGameView | null {
    return this.isComplete ? null : (this as unknown as ActiveGameView);
  }
  toSnapshot(): GameSnapshot {
    const base = {
      placedTiles: [...this._board.placedTiles],
      placedBlooms: [...this._board.placedBlooms],
      discardedTiles: [...this._discardedTiles],
      unplayedFlowers: Array.from(this._unplayedFlowers),
      remainingDrawCount: this.remainingDrawCount,
      turnNumber: this._turnNumber,
      score: this.score,
      bounds: { ...this._board.bounds },
    };
    return this._currentTile
      ? { ...base, isComplete: false, isWin: false, currentTile: this._currentTile }
      : { ...base, isComplete: true, isWin: this.isWin, currentTile: null };
  }
  eligibleBloomsFor(placement: TilePlacement): readonly PendingCornerBloom[] {
    const tile = this.requireActiveTile();
    return this._board.previewPlacement(tile, placement).completedCorners.map(({ corner, adjacentColors }) => ({
      corner, eligibleColors: adjacentColors.filter((c) => this._unplayedFlowers.has(c)),
    }));
  }
  applyMove(placement: TilePlacement, blooms: readonly BloomPlacement[] = []): PlacedTurnOutcome {
    const tile = this.requireActiveTile();
    const pending = this.eligibleBloomsFor(placement);
    const byCorner = new Map(pending.map((p) => [p.corner.key, p.eligibleColors]));
    const usedCorners = new Set<string>(), usedColors = new Set<FlowerColor>();
    for (const b of blooms) {
      const eligible = byCorner.get(b.corner.key);
      if (!eligible || usedCorners.has(b.corner.key) || usedColors.has(b.color) || !eligible.includes(b.color)) {
        throw new Error(`Invalid bloom ${b.color} at corner ${b.corner.key}`);
      }
      usedCorners.add(b.corner.key); usedColors.add(b.color);
    }
    for (const { corner, eligibleColors } of pending) {
      if (!usedCorners.has(corner.key) && eligibleColors.some((c) => !usedColors.has(c))) {
        throw new Error(`Must place an eligible bloom at completed corner ${corner.key}`);
      }
    }
    this._board.placeTile(tile, placement);
    for (const b of blooms) { this._board.placeBloom(b); this._unplayedFlowers.delete(b.color); }
    this.advanceTurn();
    return { kind: 'placed', tile, placement, blooms: [...blooms] };
  }
  discardCurrentTile(): DiscardedTurnOutcome {
    const tile = this.requireActiveTile();
    if (this._validPlacements.length > 0) throw new Error('Cannot discard when valid placements exist');
    this._discardedTiles.push(tile);
    this.advanceTurn();
    return { kind: 'discarded', tile };
  }
  private requireActiveTile(): PondTile {
    if (!this._currentTile) throw new Error('Game is already complete');
    return this._currentTile;
  }
  private advanceTurn(): void {
    this._turnNumber += 1;
    this._currentTile = this.isWin || this.drawIndex >= this.deck.length ? null : this.deck[this.drawIndex++]!;
    this._validPlacements = this._currentTile ? this._board.validPlacementsFor(this._currentTile) : [];
  }
}
