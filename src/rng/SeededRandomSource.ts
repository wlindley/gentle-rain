import { BaseRandomSource } from './RandomSource';

export class SeededRandomSource extends BaseRandomSource {
  readonly seed: number;
  private state: number;

  constructor(seed: number) {
    super();
    if (!Number.isInteger(seed)) {
      throw new RangeError(`Seed must be an integer, received ${seed}`);
    }
    this.seed = seed;
    this.state = seed >>> 0;
  }

  nextFloat(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  derive(offset: number): SeededRandomSource {
    if (!Number.isInteger(offset)) {
      throw new RangeError(`Derive offset must be an integer, received ${offset}`);
    }
    const mixed = Math.imul(this.seed ^ Math.imul(offset + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
    return new SeededRandomSource(mixed);
  }
}
