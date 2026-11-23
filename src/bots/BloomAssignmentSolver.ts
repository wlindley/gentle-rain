import type { BloomPlacement, FlowerColor, PendingCornerBloom } from '../game';

export class BloomAssignmentSolver {
  static solve(
    pendingCorners: readonly PendingCornerBloom[],
    colorPriority: (color: FlowerColor) => number = () => 0,
  ): readonly BloomPlacement[] {
    let best: BloomPlacement[] = [];
    let bestScore = Number.NEGATIVE_INFINITY;
    const current: BloomPlacement[] = [];
    const used = new Set<FlowerColor>();

    const dfs = (index: number, score: number): void => {
      if (index === pendingCorners.length) {
        if (current.length > best.length || (current.length === best.length && score > bestScore)) {
          best = [...current];
          bestScore = score;
        }
        return;
      }
      const { corner, eligibleColors } = pendingCorners[index]!;
      for (const color of eligibleColors) {
        if (used.has(color)) continue;
        used.add(color);
        current.push({ corner, color });
        dfs(index + 1, score + colorPriority(color));
        current.pop();
        used.delete(color);
      }
      dfs(index + 1, score);
    };

    dfs(0, 0);
    return best;
  }
}
