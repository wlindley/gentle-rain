# `src/rng` — Randomness Abstraction & Deterministic PRNG

## User / Consumer Guide

`src/rng` provides a small, injectable `RandomSource` interface so game shuffles, bot tie-breaking, and batch simulations can swap between live randomness, deterministic seeded runs, and hand-written test stubs without touching `Math.random` directly.

Always import from the module entrypoint (`../rng`):

```ts
import {
  MathRandomSource,
  SeededRandomSource,
  StubRandomSource,
  type RandomSource,
} from '../rng';
```

### Quick-Start Examples

#### Live gameplay (`MathRandomSource`)

```ts
const rng = new MathRandomSource();
const roll = rng.nextInt(6); // integer in [0, 5]
const deck = rng.shuffle([1, 2, 3, 4]); // returns a new shuffled array
```

#### Reproducible simulations & derived child streams (`SeededRandomSource`)

```ts
const root = new SeededRandomSource(42);
const game0Rng = root.derive(0);
const game1Rng = root.derive(1);

// Independent, repeatable streams without mutating `root`
const firstDraw = game0Rng.nextFloat(); // float in [0, 1)
const shuffled = game1Rng.shuffle(['a', 'b', 'c']);
```

#### Deterministic unit tests (`StubRandomSource`)

```ts
const stub = new StubRandomSource([0, 0.25, 0.99]);
stub.nextFloat(); // 0
stub.nextInt(4); // 1 -> Math.floor(0.25 * 4)
stub.nextInt(3); // 2 -> Math.floor(0.99 * 3)
```

### Public API Summary

| Export | Kind | Description |
| --- | --- | --- |
| `RandomSource` | `interface` | Narrow contract: `nextFloat()`, `nextInt(maxExclusive)`, `shuffle<T>(items)`. |
| `BaseRandomSource` | `abstract class` | Shared `nextInt` validation/mapping and non-mutating Fisher-Yates `shuffle`. |
| `MathRandomSource` | `class` | Production `RandomSource` backed by `Math.random` (or an injected `() => number`). |
| `SeededRandomSource` | `class` | Deterministic 32-bit PRNG with `readonly seed` and `derive(offset)`. |
| `StubRandomSource` | `class` | Hand-written test double returning queued `[0, 1)` floats FIFO and throwing on exhaustion. |

---

## Developer / Maintainer Guide

### Internal Architecture

- **`BaseRandomSource`** (`src/rng/RandomSource.ts`) implements the Template Method pattern: subclasses only provide `nextFloat(): number`, while `nextInt` and `shuffle` live once in the base class.
  - `nextInt(maxExclusive)` validates `Number.isInteger(maxExclusive) && maxExclusive > 0` and maps via `Math.floor(this.nextFloat() * maxExclusive)`.
  - `shuffle<T>(items)` copies `items` and runs a standard descending Fisher-Yates loop (`i = copy.length - 1` down to `1`, `j = this.nextInt(i + 1)`), leaving the input untouched and making zero RNG calls for arrays of length `<= 1`.
- **`SeededRandomSource`** (`src/rng/SeededRandomSource.ts`) uses **Mulberry32** over an unsigned 32-bit internal state (`seed >>> 0`), scaling the mixed 32-bit output by `1 / 2^32` (`4294967296`) to guarantee `[0, 1)`.
  - `derive(offset)` mixes `this.seed` and `offset` using golden-ratio and Murmur3 avalanche constants (`0x9e3779b1`, `0x85ebca6b`) to produce a new `SeededRandomSource` without advancing the parent's `state`.

### Module DAG & Invariants

- **Zero internal dependencies**: `src/rng` MUST NOT import from any other `src/*` module.
- **Input validation**:
  - `nextInt(maxExclusive)` throws `RangeError` for `<= 0`, non-integers, `NaN`, and `±Infinity`.
  - `StubRandomSource` throws `RangeError` on empty arrays, any float outside `[0, 1)` or non-finite, and when exhausted.
  - `SeededRandomSource` throws `RangeError` for non-integer `seed` or `derive(offset)` values.
- **No mocking libraries**: tests in `src/rng/rng.test.ts` use `StubRandomSource` and `SeededRandomSource` directly.

### Running Tests & Coverage

```bash
npm run typecheck
npm run test:coverage
```
