import { describe, expect, it } from 'vitest';
import { MathRandomSource, StubRandomSource } from './index';

describe('src/rng', () => {
  it('RNG-01: StubRandomSource returns FIFO floats and maps nextInt via Math.floor(float * n)', () => {
    const rng = new StubRandomSource([0, 0.25, 0.5, 0.999]);
    expect(rng.nextFloat()).toBe(0);
    expect(rng.nextInt(4)).toBe(1);
    expect(rng.nextInt(10)).toBe(5);
    expect(rng.nextInt(3)).toBe(2);
  });

  it('RNG-02: StubRandomSource rejects invalid inputs and throws when exhausted', () => {
    expect(() => new StubRandomSource([])).toThrow();
    expect(() => new StubRandomSource([-0.01])).toThrow();
    expect(() => new StubRandomSource([1])).toThrow();
    expect(() => new StubRandomSource([1.5])).toThrow();
    expect(() => new StubRandomSource([Number.NaN])).toThrow();

    const rng = new StubRandomSource([0.5]);
    expect(rng.nextFloat()).toBe(0.5);
    expect(() => rng.nextFloat()).toThrow();
  });

  it('RNG-03: nextInt rejects 0, negative numbers, non-integers, and NaN', () => {
    const rng = new StubRandomSource([0.5, 0.5, 0.5, 0.5]);
    expect(() => rng.nextInt(0)).toThrow();
    expect(() => rng.nextInt(-3)).toThrow();
    expect(() => rng.nextInt(1.5)).toThrow();
    expect(() => rng.nextInt(Number.NaN)).toThrow();
  });

  it('RNG-04: shuffle returns a new array without mutating input and follows Fisher-Yates', () => {
    const input = [1, 2, 3, 4];
    const rotated = new StubRandomSource([0, 0, 0]).shuffle(input);
    expect(rotated).toEqual([2, 3, 4, 1]);
    expect(rotated).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4]);

    const identity = new StubRandomSource([0.99, 0.99, 0.99]).shuffle(input);
    expect(identity).toEqual([1, 2, 3, 4]);
    expect(identity).not.toBe(input);

    const smallRng = new StubRandomSource([0.5]);
    expect(smallRng.shuffle([])).toEqual([]);
    expect(smallRng.shuffle([42])).toEqual([42]);
    expect(smallRng.nextFloat()).toBe(0.5);
  });

  it('RNG-06: MathRandomSource returns values in [0, 1) with default and injected floatFn', () => {
    const defaultRng = new MathRandomSource();
    for (let i = 0; i < 20; i += 1) {
      const value = defaultRng.nextFloat();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }

    const injected = new MathRandomSource(() => 0.42);
    expect(injected.nextFloat()).toBe(0.42);
    expect(injected.nextInt(10)).toBe(4);
  });
});
