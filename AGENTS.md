# A Gentle Rain — Workspace Agent Rules

Every agent and subagent working in this repository MUST follow these rules without exception:

## 1. Authoritative Specifications
- **Game Rules**: [`rules/rules.md`](rules/rules.md) & [`rules/pond-tiles.json`](rules/pond-tiles.json)
- **Architecture**: [`docs/architecture.md`](docs/architecture.md)
- **Module Interfaces**: [`docs/interfaces.md`](docs/interfaces.md)
- **Boundary Test Cases**: [`docs/test-cases.md`](docs/test-cases.md)
- **Commit Plan**: [`docs/implementation-plan.md`](docs/implementation-plan.md)
- **Subagent Roles**: [`docs/subagents.md`](docs/subagents.md)

## 2. Software Engineering Principles (TDD, SOLID, DRY)
- **Strict Red-Green-Refactor TDD**: Write failing module-boundary tests first (Red), then write the **minimal** production code required to make the tests pass (Green), then refactor duplication while keeping tests green. Target ~100% line and branch coverage across `src/rng`, `src/game`, `src/bots`, and `src/simulation`.
- **SOLID & Clean OOP Design**:
  - **SRP**: Small, focused classes with clear responsibilities.
  - **OCP**: Polymorphic interfaces (`RandomSource`, `Bot`, `ScoreStore`, `ReadonlyBoardView`) rather than `switch` chains over type tags.
  - **LSP / ISP**: Narrow interfaces (`RandomSource`, `Bot`, `ScoreStore`).
  - **DIP**: Inject abstractions (`RandomSource`, `Bot`, `ScoreStore`, `TileCatalog`) rather than hardcoding concrete dependencies.
- **DRY & Computed Properties**: Prefer `readonly` properties and computed getters (`score`, `isWin`, `winRate`, `meanScore`, `medianScore`, `p95Score`, `p99Score`, `bounds`, `placedTiles`, etc.) over `get*()`/`set*()` methods, and never store derived values alongside source fields.

## 3. Strict Module Boundaries (One-Way DAG)
Cross-module imports MUST go exclusively through public `index.ts` entrypoints (`../rng`, `../game`, `../bots`, `../simulation`) and follow this strict downward hierarchy:
1. `src/rng` imports **nothing** from `src/*`.
2. `src/game` imports **only** from `src/rng` (and `rules/pond-tiles.json`).
3. `src/bots` imports **only** from `src/rng` and `src/game`.
4. `src/simulation` imports **only** from `src/rng`, `src/game`, and `src/bots`.
5. `src/ui` imports from `src/rng`, `src/game`, `src/bots`, and `src/simulation`. No domain module may ever import from `src/ui` or `react`.

## 4. Testing & Fake Mandate
- Automated Vitest boundary tests are required for `src/rng`, `src/game`, `src/bots`, and `src/simulation`.
- **NEVER** use `vi.mock`, `vi.fn`, `vi.spyOn`, or any auto-generated mocks.
- **ONLY** hand-written fakes wrapping external boundaries are permitted:
  - `StubRandomSource` (and `SeededRandomSource`) for RNG
  - `InMemoryScoreStore` (and a tiny plain `{getItem, setItem, removeItem}` object inside `simulation.test.ts` to test `LocalStorageScoreStore`) for browser `localStorage`
- `src/ui` has **no** automated unit test suite; keep it thin, delegate all game rules/stats to domain modules, and verify via `npm run typecheck`, `npm run build`, and browser inspection.

## 5. Performance & Future Multi-Ply Note
- `Board` uses private packed integer keys and an incrementally updated frontier cache + O(1) `previewPlacement` so v1 bots perform zero board clones.
- When multi-ply lookahead / rollout / MCTS bots are added later, prefer adding `Board.clone()` first for simplicity and safety over stateful make/unmake (`undoPlacement`/`removeBloom`).

## 6. Commit Size & Autonomous Audit Policy
- Target **~100 LOC** per commit with a **hard limit of <= 200 LOC** (added/modified lines across `src/` and config files, excluding `package-lock.json` and `*.md` docs).
- Every commit requires `gr-commit-reviewer` `VERDICT: APPROVED` before `git commit`.

## 7. Documentation & UI Best Practices
- Every module in `src/` must include a `README.md` with both a **User / Consumer Guide** and a **Developer / Maintainer Guide**.
- Consult `modern-web-guidance` before implementing HTML/CSS/React UI components in `src/ui/`.
