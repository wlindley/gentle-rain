# A Gentle Rain — Module Interfaces

Authoritative public TypeScript contracts for all 5 modules. Prefer `readonly` properties and computed getters over `get*()`/`set*()` methods.

---

## 1. `src/rng`

```ts
export interface RandomSource {
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

export abstract class BaseRandomSource implements RandomSource {
  abstract nextFloat(): number;
  nextInt(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

export class MathRandomSource extends BaseRandomSource {
  constructor(floatFn?: () => number);
  nextFloat(): number;
}

export class SeededRandomSource extends BaseRandomSource {
  readonly seed: number;
  constructor(seed: number); // Throws if !Number.isInteger(seed)
  nextFloat(): number;
  derive(offset: number): SeededRandomSource; // Throws if !Number.isInteger(offset)
}

export class StubRandomSource extends BaseRandomSource {
  constructor(floats: readonly number[]); // Validates non-empty, each in [0, 1)
  nextFloat(): number; // Throws when exhausted
}
```

---

## 2. `src/game`

```ts
export const FLOWER_COLORS = [
  'red', 'orange', 'white', 'yellow', 'pink', 'blue', 'purple', 'black',
] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];

export const enum Direction {
  West = 0,
  North = 1,
  East = 2,
  South = 3,
}

export type Rotation = 0 | 1 | 2 | 3;

export class GridCoord {
  readonly x: number;
  readonly y: number;
  readonly key: string;
  constructor(x: number, y: number);
  neighbor(dir: Direction): GridCoord;
  equals(other: GridCoord): boolean;
  static fromKey(key: string): GridCoord;
}

export class CornerCoord {
  readonly cx: number;
  readonly cy: number;
  readonly key: string;
  constructor(cx: number, cy: number);
  equals(other: CornerCoord): boolean;
  static fromKey(key: string): CornerCoord;
}

export class PondTile {
  readonly id: number;
  readonly baseEdges: readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor];
  constructor(id: number, edges: readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor]);
  edgeAt(dir: Direction, rotation?: Rotation): FlowerColor;
  edgesAt(rotation: Rotation): readonly [FlowerColor, FlowerColor, FlowerColor, FlowerColor];
  hasColor(color: FlowerColor): boolean;
  canonicalKey(): string;
}

export class TileCatalog {
  readonly tiles: readonly PondTile[];
  constructor(rawTiles: readonly (readonly string[])[]);
  static defaultCatalog(): TileCatalog;
}

export interface PlacedTile {
  readonly tile: PondTile;
  readonly coord: GridCoord;
  readonly rotation: Rotation;
}

export interface TilePlacement {
  readonly coord: GridCoord;
  readonly rotation: Rotation;
}

export interface FrontierConstraint {
  readonly coord: GridCoord;
  readonly requiredEdges: readonly [
    FlowerColor | null,
    FlowerColor | null,
    FlowerColor | null,
    FlowerColor | null,
  ];
  readonly neighborCount: number;
}

export interface CompletedCorner {
  readonly corner: CornerCoord;
  readonly adjacentColors: readonly FlowerColor[];
}

export interface BloomPlacement {
  readonly corner: CornerCoord;
  readonly color: FlowerColor;
}

export interface BoardBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface PlacementPreview {
  readonly placement: TilePlacement;
  readonly completedCorners: readonly CompletedCorner[];
  readonly affectedFrontierConstraints: readonly FrontierConstraint[];
  readonly neighborCount: number;
}

export interface ReadonlyBoardView {
  readonly placedTileCount: number;
  readonly placedBloomCount: number;
  readonly placedTiles: readonly PlacedTile[];
  readonly placedBlooms: readonly BloomPlacement[];
  readonly frontierConstraints: readonly FrontierConstraint[];
  readonly bounds: BoardBounds;
  tileAt(coord: GridCoord): PlacedTile | undefined;
  bloomAt(corner: CornerCoord): FlowerColor | undefined;
  validPlacementsFor(tile: PondTile): readonly TilePlacement[];
  isValidPlacement(tile: PondTile, placement: TilePlacement): boolean;
  previewPlacement(tile: PondTile, placement: TilePlacement): PlacementPreview;
}

export class Board implements ReadonlyBoardView {
  constructor();
  placeInitialTile(tile: PondTile, rotation?: Rotation): void;
  placeTile(tile: PondTile, placement: TilePlacement): readonly CompletedCorner[];
  placeBloom(bloom: BloomPlacement): void;
  // ...ReadonlyBoardView members
}

export interface PendingCornerBloom {
  readonly corner: CornerCoord;
  readonly eligibleColors: readonly FlowerColor[];
}

export interface GameSnapshot {
  readonly placedTiles: readonly PlacedTile[];
  readonly placedBlooms: readonly BloomPlacement[];
  readonly currentTile: PondTile | null;
  readonly discardedTiles: readonly PondTile[];
  readonly unplayedFlowers: readonly FlowerColor[];
  readonly remainingDrawCount: number;
  readonly turnNumber: number;
  readonly isComplete: boolean;
  readonly isWin: boolean;
  readonly score: number;
  readonly bounds: BoardBounds;
}

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
}

export class GameResult {
  readonly placedFlowers: number;
  readonly remainingDrawCount: number;
  readonly placedTilesCount: number;
  readonly discardedTilesCount: number;
  readonly turnsPlayed: number;
  constructor(params: {
    placedFlowers: number;
    remainingDrawCount: number;
    placedTilesCount: number;
    discardedTilesCount: number;
    turnsPlayed: number;
  });
  get score(): number;
  get isWin(): boolean;
}

export type TurnOutcome =
  | { readonly kind: 'placed'; readonly tile: PondTile; readonly placement: TilePlacement; readonly blooms: readonly BloomPlacement[] }
  | { readonly kind: 'discarded'; readonly tile: PondTile };

export class Game implements GameView {
  static create(rng: RandomSource, catalog?: TileCatalog): Game;
  get result(): GameResult | null;
  discardCurrentTile(): TurnOutcome;
  applyMove(placement: TilePlacement, blooms?: readonly BloomPlacement[]): TurnOutcome;
  eligibleBloomsFor(placement: TilePlacement): readonly PendingCornerBloom[];
  toSnapshot(): GameSnapshot;
  // ...GameView properties
}
```

---

## 3. `src/bots`

```ts
export interface Bot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  choosePlacement(view: GameView, rng: RandomSource): TilePlacement;
  chooseBlooms(
    view: GameView,
    placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    rng: RandomSource,
  ): readonly BloomPlacement[];
}

export class BloomAssignmentSolver {
  static solve(
    pendingCorners: readonly PendingCornerBloom[],
    colorPriority?: (color: FlowerColor) => number,
  ): readonly BloomPlacement[];
}

export class RandomBot implements Bot { ... }
export class GreedyBloomBot implements Bot { ... }
export class HeuristicBot implements Bot { ... }

export class BotRegistry {
  readonly bots: readonly Bot[];
  constructor(initialBots?: readonly Bot[]);
  register(bot: Bot): void;
  find(id: string): Bot | undefined;
  require(id: string): Bot;
  static createDefault(): BotRegistry;
}
```

---

## 4. `src/simulation`

```ts
export class GameRunner {
  readonly game: Game;
  readonly bot: Bot;
  readonly seed: number;
  constructor(bot: Bot, seed: number, catalog?: TileCatalog);
  get isComplete(): boolean;
  step(): TurnOutcome | null;
  runToCompletion(): GameResult;
  toSnapshot(): GameSnapshot;
}

export class SimulationStats {
  readonly totalGames: number;
  readonly scores: readonly number[];
  readonly bloomCounts: readonly number[];
  readonly totalDiscards: number;
  constructor(results?: readonly GameResult[]);
  record(result: GameResult): void;
  get winCount(): number;
  get winRate(): number;
  get meanScore(): number;
  get medianScore(): number;
  get p95Score(): number; // nearest-rank: sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)]
  get p99Score(): number; // nearest-rank: sorted[Math.min(n - 1, Math.ceil(0.99 * n) - 1)]
  get stdDevScore(): number;
  get minScore(): number;
  get maxScore(): number;
  get meanBlooms(): number;
  get meanDiscards(): number;
  get scoreHistogram(): ReadonlyMap<number, number>;
  get bloomHistogram(): readonly number[];
}

export interface BotRunRecord {
  readonly id: string;
  readonly botId: string;
  readonly botName: string;
  readonly timestampIso: string;
  readonly baseSeed: number | null;
  readonly totalGames: number;
  readonly winCount: number;
  readonly winRate: number;
  readonly meanScore: number;
  readonly medianScore: number;
  readonly p95Score: number;
  readonly p99Score: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly meanBlooms: number;
  readonly scoreHistogram: Record<string, number>;
}

export interface ScoreStore {
  loadAll(): readonly BotRunRecord[];
  save(record: BotRunRecord): void;
  clear(): void;
}

export class LocalStorageScoreStore implements ScoreStore {
  constructor(storageKey?: string, storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>);
  loadAll(): readonly BotRunRecord[];
  save(record: BotRunRecord): void;
  clear(): void;
}

export class InMemoryScoreStore implements ScoreStore {
  loadAll(): readonly BotRunRecord[];
  save(record: BotRunRecord): void;
  clear(): void;
}

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

export class SimulationSession {
  readonly config: SimulationConfig;
  constructor(config: SimulationConfig);
  get completedGames(): number;
  get remainingGames(): number;
  get isComplete(): boolean;
  get stats(): SimulationStats;
  get bestSnapshot(): GameSnapshot | null;
  get worstSnapshot(): GameSnapshot | null;
  get slotViews(): readonly SlotView[];
  stepTurns(turnsPerSlot: number): number;
  stepGames(maxGames: number): number;
  toRunRecord(id: string, timestampIso: string, seedExplicit: boolean): BotRunRecord;
}

export class TournamentRunner {
  readonly sessions: readonly SimulationSession[];
  constructor(bots: readonly Bot[], targetGames: number, parallelSlots: number, baseSeed: number, catalog?: TileCatalog);
  get isComplete(): boolean;
  get rankedSummaries(): readonly { readonly bot: Bot; readonly stats: SimulationStats }[];
  stepGamesAll(maxGamesPerBot: number): void;
}
```
