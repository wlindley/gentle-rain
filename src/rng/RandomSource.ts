export interface RandomSource {
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
  shuffle<T>(items: readonly T[]): T[];
}

export abstract class BaseRandomSource implements RandomSource {
  abstract nextFloat(): number;

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`maxExclusive must be a positive integer, received ${maxExclusive}`);
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.nextInt(i + 1);
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
    }
    return copy;
  }
}

export class MathRandomSource extends BaseRandomSource {
  private readonly floatFn: () => number;

  constructor(floatFn: () => number = Math.random) {
    super();
    this.floatFn = floatFn;
  }

  nextFloat(): number {
    return this.floatFn();
  }
}

export class StubRandomSource extends BaseRandomSource {
  private readonly floats: readonly number[];
  private index = 0;

  constructor(floats: readonly number[]) {
    super();
    if (floats.length === 0) {
      throw new RangeError('StubRandomSource requires at least one float');
    }
    for (const value of floats) {
      if (!Number.isFinite(value) || value < 0 || value >= 1) {
        throw new RangeError(`StubRandomSource float must be in [0, 1), received ${value}`);
      }
    }
    this.floats = [...floats];
  }

  nextFloat(): number {
    if (this.index >= this.floats.length) {
      throw new RangeError('StubRandomSource exhausted');
    }
    const value = this.floats[this.index]!;
    this.index += 1;
    return value;
  }
}
