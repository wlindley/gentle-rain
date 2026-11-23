# A Gentle Rain — Boundary Test Case Catalog

All automated tests execute at module boundaries via public `index.ts` entrypoints with ZERO auto-generated mocks (`vi.mock`, `vi.fn`, `vi.spyOn` forbidden).

## Module 1: `src/rng` (`src/rng/rng.test.ts`)
- **RNG-01**: `StubRandomSource` returns queued floats in FIFO order and maps `nextInt(n)` via `Math.floor(float * n)`.
- **RNG-02**: `StubRandomSource` rejects empty arrays, negative values, values `>= 1`, and `NaN`, and throws when exhausted.
- **RNG-03**: `nextInt` rejects `0`, negative numbers, non-integers (`1.5`), and `NaN`.
- **RNG-04**: `shuffle` returns a new array without mutating input, preserves all elements, and follows deterministic Fisher-Yates swaps with `StubRandomSource`.
- **RNG-05**: `SeededRandomSource` produces identical sequences for the same integer seed, distinct sequences for different seeds, rejects non-integer seeds (and non-integer `derive` offsets), and `derive(offset)` yields independent reproducible child streams.
- **RNG-06**: `MathRandomSource` returns values in `[0, 1)` using default `Math.random` and optional injected float function.

## Module 2: `src/game` (`src/game/game.test.ts`)
- **GAME-01**: `GridCoord` and `CornerCoord` reject non-integers, compute `neighbor(Direction)` across W/N/E/S, round-trip `key` <-> `fromKey` (rejecting invalid keys), and compare via `equals`.
- **GAME-02**: `PondTile` stores edges in `[West, North, East, South]` at rotation 0, rotates clockwise accurately for rotations `0..3`, supports `edgesAt`/`hasColor`, rejects duplicate or invalid colors, and produces identical `canonicalKey()` for rotationally equivalent tiles.
- **GAME-03**: `TileCatalog.defaultCatalog()` loads `rules/pond-tiles.json` with 28 rotationally unique tiles where every color appears 14 times.
- **GAME-04**: `TileCatalog` rejects wrong tile count (`!= 28`), wrong edge count, invalid colors, duplicate colors within a tile, and duplicate tiles up to rotation.
- **GAME-05**: `Board.placeInitialTile` places tile at `(0, 0)`, populates 4 frontier cells (`(-1,0), (0,-1), (1,0), (0,1)`) with exact 1-edge constraints, and throws if called on a non-empty board.
- **GAME-06**: `Board.validPlacementsFor` and `isValidPlacement` accept only placements matching all adjacent placed edges across all 4 rotations; return `[]` when no placement matches.
- **GAME-07**: `Board.placeTile` rejects occupied cells, non-adjacent cells, and mismatched edges; updates integer-indexed frontier cache incrementally (removing placed cell, merging multi-edge constraints onto shared neighbors).
- **GAME-08**: `Board.placeTile` detects newly completed 2×2 corners (single corner, 2 simultaneous corners, and 4 corners closing a center pocket) with exact deduplicated `adjacentColors`.
- **GAME-09**: `Board.previewPlacement` predicts newly completed corners, `neighborCount`, and ≤4 updated neighbor `FrontierConstraint`s purely in O(1) without mutating board state.
- **GAME-10**: `Board.placeBloom` succeeds for completed empty corner + adjacent color and throws for uncompleted, already-bloomed, or non-adjacent color; `Board.bounds` accurately tracks `minX/maxX/minY/maxY`.
- **GAME-12**: `Game.create` shuffles catalog via `RandomSource`, places 1st tile at `(0, 0)`, draws 2nd tile as `currentTile`, leaves `remainingDrawCount === 26`, and exposes fair `unseenTiles` (26 tiles).
- **GAME-13**: `Game.applyMove` places tile, resolves single & simultaneous blooms, removes placed flower colors from `unplayedFlowers`, advances `turnNumber`, and updates `unseenTiles`.
- **GAME-14**: `Game.applyMove` enforces bloom validity (rejects non-completed corner, already-played color, duplicate color in simultaneous blooms, or leaving a corner unbloomed when an eligible unplayed color remains unused; permits unbloomed corner ONLY when all adjacent colors are already played).
- **GAME-15**: `Game.discardCurrentTile` discards unplaceable tile into `discardedTiles`, advances to next tile, and throws if valid placements exist or game is already complete.
- **GAME-16**: Early Victory: placing the 8th flower token immediately marks `isComplete === true`, `isWin === true`, `currentTile === null`, does not draw another tile, and computes `score === 8 + remainingDrawCount` (discarded tiles excluded).
- **GAME-17**: Deck Exhaustion: resolving or discarding the 28th tile with `< 8` blooms marks `isComplete === true`, `isWin === false`, `remainingDrawCount === 0`, and computes `score === placedFlowers`.
- **GAME-18**: `Game.result` is `null` before completion and returns accurate `GameResult` (`score`, `isWin`) upon completion; `Game.toSnapshot()` returns an immutable snapshot detached from subsequent turns.

## Module 3: `src/bots` (`src/bots/bots.test.ts`)
- **BOT-01**: `BloomAssignmentSolver.solve` handles 0 pending corners, 1 corner with multiple colors, 1 corner with 0 eligible colors, and simultaneous corners sharing a scarce color (assigning maximal blooms).
- **BOT-02**: `BloomAssignmentSolver.solve` respects optional `colorPriority` comparator when multiple maximal assignments exist.
- **BOT-03**: `RandomBot` always selects legal placements & maximal blooms, is deterministic with `StubRandomSource` / `SeededRandomSource`, and completes full games cleanly.
- **BOT-04**: `GreedyBloomBot` strictly prefers placements completing immediately bloomable 2×2 corners, breaks ties by higher `neighborCount`, and completes full games cleanly.
- **BOT-05**: `HeuristicBot` prefers immediate blooms, avoids dead pockets using `unseenTiles`, prefers fillable 3-tile setups, and outperforms `RandomBot` in average score on a fixed seeded benchmark suite.
- **BOT-06**: `BotRegistry` supports `createDefault()` (3 built-in bots), `register` custom bots, `find`, `require` (throws on unknown ID), `bots`, and rejects duplicate IDs.

## Module 4: `src/simulation` (`src/simulation/simulation.test.ts`)
- **SIM-01**: `GameRunner` plays step-by-step via `step()` (placements & discards), returns `null` after completion, and yields identical `GameResult` to `runToCompletion()` for the same `(bot, seed)`.
- **SIM-02**: `SimulationStats` handles empty state (`0` for rates/means/percentiles/min/max) and computes exact `winCount`, `winRate`, `meanScore`, `medianScore` (odd & even), `p95Score`, `p99Score` (nearest-rank), `stdDevScore`, `minScore`, `maxScore`, `meanBlooms`, `meanDiscards`, `scoreHistogram`, and `bloomHistogram`.
- **SIM-03**: `InMemoryScoreStore` saves, loads in order (returning defensive copies), and clears `BotRunRecord` entries.
- **SIM-04**: `LocalStorageScoreStore` persists JSON using an injected `{getItem, setItem, removeItem}` fake, recovers gracefully from empty or malformed JSON, and clears cleanly.
- **SIM-05**: `SimulationSession` initializes `min(parallelSlots, targetGames)` active slots, advances via `stepTurns`, recycles finished slots until `completedGames === targetGames`, tracks `bestSnapshot`/`worstSnapshot`, and produces identical final stats whether driven by `stepTurns(1)` or `stepGames(N)`.
- **SIM-06**: `SimulationSession.toRunRecord` exports a `BotRunRecord` (including `p95Score` and `p99Score`) that round-trips cleanly through `ScoreStore`.
- **SIM-07**: `TournamentRunner` runs all provided bots across identical seed sequences (`baseSeed + 0..targetGames-1`), steps cleanly to completion, and ranks bots by `meanScore` descending.

## Module 5: `src/ui` (Manual & Live Browser Verification)
- **UI-01**: Clean `npm run dev` and `npm run build` with zero console/TS errors.
- **UI-02**: Live parallel Canvas grid animates N boards smoothly across speeds up to Turbo (1,000+ games).
- **UI-03**: Clicking any live mini-board or Best/Worst button opens zoomed Board Inspector `<dialog>`.
- **UI-04**: Completed runs persist in `localStorage` across page reloads and clear via Clear History.
- **UI-05**: "Compare All Bots" runs all 3 bots on identical seeds and updates leaderboard/comparison table.
