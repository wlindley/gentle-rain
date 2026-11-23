import { describe, expect, it } from 'vitest';
import { CornerCoord } from '../game';
import type { FlowerColor } from '../game';
import { BloomAssignmentSolver } from './index';

describe('src/bots', () => {
  it('BOT-01: BloomAssignmentSolver.solve finds maximal distinct-color bloom assignments across 0 to 3 corners', () => {
    expect(BloomAssignmentSolver.solve([])).toEqual([]);
    expect(
      BloomAssignmentSolver.solve([{ corner: new CornerCoord(0, 0), eligibleColors: [] }]),
    ).toEqual([]);

    const single = BloomAssignmentSolver.solve([
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] },
    ]);
    expect(single).toHaveLength(1);
    expect(['red', 'blue']).toContain(single[0]!.color);

    const scarce = BloomAssignmentSolver.solve([
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] },
      { corner: new CornerCoord(1, 0), eligibleColors: ['red'] },
    ]);
    expect(scarce).toHaveLength(2);
    expect(scarce.find((b) => b.corner.key === '0,0')?.color).toBe('blue');
    expect(scarce.find((b) => b.corner.key === '1,0')?.color).toBe('red');

    const capped = BloomAssignmentSolver.solve([
      { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] },
      { corner: new CornerCoord(1, 0), eligibleColors: ['red'] },
      { corner: new CornerCoord(0, 1), eligibleColors: ['blue'] },
    ]);
    expect(capped).toHaveLength(2);
    expect(new Set(capped.map((b) => b.color)).size).toBe(2);
  });

  it('BOT-02: BloomAssignmentSolver.solve maximizes total colorPriority among maximal assignments', () => {
    const priority = (c: FlowerColor): number =>
      ({ red: 1, blue: 5, yellow: 10, green: 0 } as Record<string, number>)[c] ?? 0;

    const single = BloomAssignmentSolver.solve(
      [{ corner: new CornerCoord(0, 0), eligibleColors: ['red', 'blue'] }],
      priority,
    );
    expect(single).toEqual([{ corner: new CornerCoord(0, 0), color: 'blue' }]);

    const pair = BloomAssignmentSolver.solve(
      [
        { corner: new CornerCoord(0, 0), eligibleColors: ['red', 'yellow'] },
        { corner: new CornerCoord(1, 0), eligibleColors: ['blue', 'yellow'] },
      ],
      priority,
    );
    expect(pair).toHaveLength(2);
    expect(pair.find((b) => b.corner.key === '0,0')?.color).toBe('yellow');
    expect(pair.find((b) => b.corner.key === '1,0')?.color).toBe('blue');
  });
});
