import { describe, expect, it } from 'vitest';
import { MathRandomSource, SeededRandomSource, StubRandomSource } from './index';

describe('StubRandomSource', () => {
  it('returns queued floats in FIFO order', () => {
    const rng = new StubRandomSource([0, 0.25, 0.999]);
    expect(rng.nextFloat()).toBe(0);
    expect(rng.nextFloat()).toBe(0.25);
    expect(rng.nextFloat()).toBe(0.999);
  });

  it('rejects empty or out-of-range float queues', () => {
    expect(() => new StubRandomSource([])).toThrow();
    expect(() => new StubRandomSource([-0.01])).toThrow();
    expect(() => new StubRandomSource([1])).toThrow();
    expect(() => new StubRandomSource([1.5])).toThrow();
    expect(() => new StubRandomSource([Number.NaN])).toThrow();
  });

  it('throws when the float queue is exhausted', () => {
    const rng = new StubRandomSource([0.5]);
    expect(rng.nextFloat()).toBe(0.5);
    expect(() => rng.nextFloat()).toThrow();
  });
});

describe('BaseRandomSource', () => {
  it('maps nextInt via Math.floor(float * maxExclusive)', () => {
    const rng = new StubRandomSource([0.25, 0.5, 0.999]);
    expect(rng.nextInt(4)).toBe(1);
    expect(rng.nextInt(10)).toBe(5);
    expect(rng.nextInt(3)).toBe(2);
  });

  it('rejects non-positive, non-integer, and NaN nextInt bounds', () => {
    const rng = new StubRandomSource([0.5]);
    expect(() => rng.nextInt(0)).toThrow();
    expect(() => rng.nextInt(-3)).toThrow();
    expect(() => rng.nextInt(1.5)).toThrow();
    expect(() => rng.nextInt(Number.NaN)).toThrow();
  });

  it('shuffles via deterministic Fisher-Yates without mutating input', () => {
    const input = [1, 2, 3, 4];
    const rotated = new StubRandomSource([0, 0, 0]).shuffle(input);
    expect(rotated).toEqual([2, 3, 4, 1]);
    expect(rotated).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4]);

    const identity = new StubRandomSource([0.99, 0.99, 0.99]).shuffle(input);
    expect(identity).toEqual([1, 2, 3, 4]);
    expect(identity).not.toBe(input);
  });

  it('handles empty and single-element arrays without consuming floats', () => {
    const rng = new StubRandomSource([0.5]);
    expect(rng.shuffle([])).toEqual([]);
    expect(rng.shuffle([42])).toEqual([42]);
    expect(rng.nextFloat()).toBe(0.5);
  });
});

describe('SeededRandomSource', () => {
  it('produces identical float, int, and shuffle sequences in [0, 1) for the same seed', () => {
    const rngA = new SeededRandomSource(42);
    const rngB = new SeededRandomSource(42);
    expect(rngA.seed).toBe(42);

    const floatsA = Array.from({ length: 10 }, () => rngA.nextFloat());
    const floatsB = Array.from({ length: 10 }, () => rngB.nextFloat());
    for (const value of floatsA) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
    expect(floatsA).toEqual(floatsB);
    expect(Array.from({ length: 10 }, () => rngA.nextInt(100))).toEqual(
      Array.from({ length: 10 }, () => rngB.nextInt(100)),
    );
    expect(rngA.shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual(rngB.shuffle([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('produces distinct sequences for different seeds', () => {
    const rngA = new SeededRandomSource(42);
    const rngB = new SeededRandomSource(43);
    const seqA = Array.from({ length: 10 }, () => rngA.nextFloat());
    const seqB = Array.from({ length: 10 }, () => rngB.nextFloat());
    expect(seqA).not.toEqual(seqB);
  });

  it('rejects non-integer seeds and non-integer derive offsets', () => {
    expect(() => new SeededRandomSource(1.5)).toThrow();
    expect(() => new SeededRandomSource(Number.NaN)).toThrow();
    expect(() => new SeededRandomSource(Number.POSITIVE_INFINITY)).toThrow();

    const base = new SeededRandomSource(100);
    expect(() => base.derive(0.5)).toThrow();
    expect(() => base.derive(Number.NaN)).toThrow();
  });

  it('derives reproducible independent child streams per offset', () => {
    const base = new SeededRandomSource(100);
    const child1a = base.derive(1);
    const child1b = new SeededRandomSource(100).derive(1);
    const child2 = base.derive(2);

    expect(Number.isInteger(child1a.seed)).toBe(true);
    expect(child1a.seed).toBe(child1b.seed);
    expect(Array.from({ length: 8 }, () => child1a.nextFloat())).toEqual(
      Array.from({ length: 8 }, () => child1b.nextFloat()),
    );
    expect(Array.from({ length: 8 }, () => child1a.nextFloat())).not.toEqual(
      Array.from({ length: 8 }, () => child2.nextFloat()),
    );
  });
});

describe('MathRandomSource', () => {
  it('returns floats in [0, 1) using default Math.random', () => {
    const rng = new MathRandomSource();
    for (let i = 0; i < 20; i += 1) {
      const value = rng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('uses an injected float function when provided', () => {
    const rng = new MathRandomSource(() => 0.42);
    expect(rng.nextFloat()).toBe(0.42);
    expect(rng.nextInt(10)).toBe(4);
  });
});
