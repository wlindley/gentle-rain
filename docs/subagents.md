# A Gentle Rain — Subagent Roster & Autonomous TDD Protocol

Five specialized subagents collaborate to build **A Gentle Rain** with strict Red-Green-Refactor TDD, ~100% coverage across non-UI modules, SOLID OOP, and `<= 200 LOC` commits.

| Subagent | Role | Write Files? | Run Commands? | Core Responsibility |
| :--- | :--- | :---: | :---: | :--- |
| **`gr-coordinator`** | Technical Lead & Release Coordinator | Yes (`git`, root docs) | Yes | Drives commits 1..23 autonomously, orchestrating Red -> Green -> Audit -> Commit. |
| **`gr-test-author`** | Module Boundary TDD Engineer | Yes (`*.test.ts` + throwing skeletons) | Yes (`vitest`, `tsc`) | Writes minimal failing boundary tests matching `docs/test-cases.md` using only `StubRandomSource` and `InMemoryScoreStore`. |
| **`gr-implementer`** | Core Domain TypeScript Engineer | Yes (`src/{rng,game,bots,simulation}/`) | Yes (`vitest`, `tsc`) | Writes minimal SOLID production code turning Red tests Green at ~100% coverage, plus per-module User & Developer READMEs. |
| **`gr-ui-builder`** | React & Canvas UI Engineer | Yes (`index.html`, `src/main.tsx`, `src/ui/**`) | Yes (`tsc`, `vite build`, `vitest`) | Builds thin React + HTML5 Canvas UI using domain modules (consulting `modern-web-guidance`). |
| **`gr-commit-reviewer`** | Architectural & Commit Auditor | **No** (read-only) | No (reviews staged diff & coverage) | Audits every commit against the 8-point checklist (`<= 200 LOC`, ~100% coverage, SOLID/DRY, DAG, zero mocks, spec fidelity, docs) and issues `VERDICT: APPROVED` or `CHANGES_REQUESTED`. |
