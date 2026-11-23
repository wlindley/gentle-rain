import { BloomAssignmentSolver } from '../bots';
import type { Bot } from '../bots';
import { Direction, FLOWER_COLORS } from '../game';
import type { BloomPlacement, FlowerColor, FrontierConstraint, GameView, PendingCornerBloom, PondTile, Rotation, TilePlacement } from '../game';
import type { RandomSource } from '../rng';
import { Genome } from './Genome';

const DIRECTIONS: readonly Direction[] = [Direction.West, Direction.North, Direction.East, Direction.South];
const ROTATIONS: readonly Rotation[] = [0, 1, 2, 3];

function zeroColorCounts(): Record<FlowerColor, number> {
  const counts = {} as Record<FlowerColor, number>;
  for (const c of FLOWER_COLORS) counts[c] = 0;
  return counts;
}

function countUnseenColors(unseenTiles: readonly PondTile[]): Record<FlowerColor, number> {
  const counts = zeroColorCounts();
  for (const tile of unseenTiles) for (const color of tile.baseEdges) counts[color] += 1;
  return counts;
}

function countFrontierColors(constraints: readonly FrontierConstraint[]): Record<FlowerColor, number> {
  const counts = zeroColorCounts();
  for (const fc of constraints) for (const req of fc.requiredEdges) if (req !== null) counts[req] += 1;
  return counts;
}

function tileFitsConstraint(tile: PondTile, requiredEdges: FrontierConstraint['requiredEdges']): boolean {
  for (const rot of ROTATIONS) {
    let ok = true;
    for (const dir of DIRECTIONS) {
      const req = requiredEdges[dir];
      if (req !== null && tile.edgeAt(dir, rot) !== req) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

function countMatchingUnseen(constraint: FrontierConstraint, unseenTiles: readonly PondTile[]): number {
  let matches = 0;
  for (const tile of unseenTiles) if (tileFitsConstraint(tile, constraint.requiredEdges)) matches += 1;
  return matches;
}

export class EvolvedBot implements Bot {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly genome: Genome;

  constructor(genome: Genome, name?: string) {
    this.genome = genome;
    this.id = `evolved-${genome.id}`;
    this.name = name ?? `Evolved (${genome.id})`;
    this.description = `Parameterized 20-gene evolved heuristic bot (gen ${genome.generation}).`;
  }

  choosePlacement(view: GameView, rng: RandomSource): TilePlacement {
    const tile = view.currentTile!;
    const w = this.genome.weights;
    const unseenCounts = countUnseenColors(view.unseenTiles);
    const bloomPriority = this.makeBloomPriority(unseenCounts, countFrontierColors(view.board.frontierConstraints));
    const progress = 1 - view.remainingDrawCount / 26;
    const { minX, maxX, minY, maxY } = view.board.bounds;
    const curSpan = maxX - minX + (maxY - minY);
    const fillableByN = [0, 0, w.fillablePocket2Weight, w.fillablePocket3Weight, w.fillablePocket4Weight];
    const deadByN = [0, 0, w.deadPocket2Penalty, w.deadPocket3Penalty, w.deadPocket4Penalty];
    let bestScore = Number.NEGATIVE_INFINITY;
    let best: TilePlacement[] = [];

    for (const placement of view.validPlacements) {
      const { coord, rotation } = placement;
      const preview = view.board.previewPlacement(tile, placement);
      const pending = preview.completedCorners.map(({ corner, adjacentColors }) => ({
        corner, eligibleColors: adjacentColors.filter((c) => view.unplayedFlowers.has(c)),
      }));
      const blooms = BloomAssignmentSolver.solve(pending, bloomPriority).length;

      let score = blooms * (w.immediateBloomWeight + progress * w.bloomUrgencyLateSlope);
      if (blooms >= 2) score += w.multiBloomBonus * (blooms - 1);
      const newSpan = Math.max(maxX, coord.x) - Math.min(minX, coord.x) + (Math.max(maxY, coord.y) - Math.min(minY, coord.y));
      score += preview.neighborCount * (w.neighborCountWeight + progress * w.compactnessLateSlope);
      score += (newSpan - curSpan) * w.boundingBoxGrowthWeight + (Math.abs(coord.x) + Math.abs(coord.y)) * w.centerDistanceWeight;

      for (const fc of preview.affectedFrontierConstraints) {
        if (fc.neighborCount < 2) continue;
        const matches = countMatchingUnseen(fc, view.unseenTiles);
        if (matches === 0) {
          score += deadByN[fc.neighborCount]!;
        } else {
          const hasUnplayed = fc.requiredEdges.some((c) => c !== null && view.unplayedFlowers.has(c));
          score += fillableByN[fc.neighborCount]! + Math.min(matches, 4) * w.pocketMatchDiversityWeight;
          score += hasUnplayed ? w.unplayedCornerSetupWeight : w.alreadyBloomedCornerWeight;
        }
      }
      for (const dir of DIRECTIONS) {
        if (view.board.tileAt(coord.neighbor(dir)) !== undefined) continue;
        const c = tile.edgeAt(dir, rotation);
        score += (view.unplayedFlowers.has(c) ? w.exposedUnplayedColorWeight : 0) + (unseenCounts[c] / 14) * w.exposedAbundanceWeight;
      }
      if (score > bestScore) { bestScore = score; best = [placement]; }
      else if (score === bestScore) best.push(placement);
    }
    return best[rng.nextInt(best.length)]!;
  }

  chooseBlooms(
    view: GameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    _rng: RandomSource,
  ): readonly BloomPlacement[] {
    return BloomAssignmentSolver.solve(
      pendingCorners,
      this.makeBloomPriority(countUnseenColors(view.unseenTiles), countFrontierColors(view.board.frontierConstraints)),
    );
  }

  private makeBloomPriority(
    unseenCounts: Record<FlowerColor, number>,
    frontierCounts: Record<FlowerColor, number>,
  ): (color: FlowerColor) => number {
    const { bloomScarcityPriority, bloomFrontierScarcityPriority } = this.genome.weights;
    return (color) =>
      bloomScarcityPriority * (14 - unseenCounts[color]) +
      bloomFrontierScarcityPriority * (10 - frontierCounts[color]);
  }
}
