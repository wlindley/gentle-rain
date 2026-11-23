# A Gentle Rain — Incremental TDD Commit Plan

Builds on root commit `b86620a` (`rules/rules.md`, `rules/pond-tiles.json`). Target ~100 LOC per commit, hard limit `<= 200 LOC` across `src/` + config files (excluding `package-lock.json` and `*.md` docs). Every commit requires `gr-commit-reviewer` `VERDICT: APPROVED`.

1. **Commit 1 — Project Scaffold & Agent Docs**: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `AGENTS.md`, `docs/*`, `.agents/plugins/gr-team/*`.
2. **Commit 2 — `src/rng`: RandomSource, Stub & Math RNG** *(RNG-01–RNG-04, RNG-06)*.
3. **Commit 3 — `src/rng`: SeededRandomSource, `index.ts` & Module Docs** *(RNG-05, `src/rng/README.md`)*.
4. **Commit 4 — `src/game`: Colors, Directions, GridCoord & CornerCoord** *(GAME-01)*.
5. **Commit 5 — `src/game`: PondTile & TileCatalog** *(GAME-02–GAME-04)*.
6. **Commit 6 — `src/game`: Board Placement & Integer-Indexed FrontierCache** *(GAME-05–GAME-07)*.
7. **Commit 7 — `src/game`: Board 2×2 Corners, `previewPlacement`, Blooms & Bounds** *(GAME-08–GAME-10)*.
8. **Commit 8 — `src/game`: Game Engine Setup, Moves & Discards** *(GAME-12–GAME-15)*.
9. **Commit 9 — `src/game`: End Conditions, GameResult, Snapshots, `index.ts` & Module Docs** *(GAME-16–GAME-18, `src/game/README.md`)*.
10. **Commit 10 — `src/bots`: Bot Interface & BloomAssignmentSolver** *(BOT-01–BOT-02)*.
11. **Commit 11 — `src/bots`: RandomBot & GreedyBloomBot** *(BOT-03–BOT-04)*.
12. **Commit 12 — `src/bots`: HeuristicBot, BotRegistry, `index.ts` & Module Docs** *(BOT-05–BOT-06, `src/bots/README.md`)*.
13. **Commit 13 — `src/simulation`: GameRunner & SimulationStats** *(SIM-01–SIM-02)*.
14. **Commit 14 — `src/simulation`: ScoreStore (`InMemoryScoreStore` & `LocalStorageScoreStore`)** *(SIM-03–SIM-04)*.
15. **Commit 15 — `src/simulation`: SimulationSession (Parallel Slots & Recycling)** *(SIM-05–SIM-06)*.
16. **Commit 16 — `src/simulation`: TournamentRunner, `index.ts` & Module Docs** *(SIM-07, `src/simulation/README.md`)*.
17. **Commit 17 — `src/ui`: App Entry, Theme CSS & Pond Color Palette**.
18. **Commit 18 — `src/ui`: HTML5 Canvas Board Renderer**.
19. **Commit 19 — `src/ui`: Live Parallel Canvas Grid & Control Bar**.
20. **Commit 20 — `src/ui`: Live Stats, Score Histogram & Bloom Chart**.
21. **Commit 21 — `src/ui`: Persistent Bot Leaderboard & Compare All Bots View**.
22. **Commit 22 — `src/ui`: Board Inspector Modal, App Wiring & Module/Root Docs**.
23. **Commit 23 — Final Verification & Visual Polish**.
