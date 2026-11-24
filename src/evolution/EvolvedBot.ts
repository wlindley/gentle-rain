import {
  BloomAssignmentSolver,
  countFrontierColors,
  countMatchingUnseen,
  countUnseenColors,
  selectBestPlacement,
} from '../bots';
import type { Bot } from '../bots';
import { ALL_DIRECTIONS } from '../game';
import type { ActiveGameView, BloomPlacement, FlowerColor, PendingCornerBloom, TilePlacement } from '../game';
import type { RandomSource } from '../rng';
import { Genome } from './Genome';

interface TurnContext {
  readonly unseenCounts: Record<FlowerColor, number>;
  readonly bloomPriority: (color: FlowerColor) => number;
  readonly progress: number;
  readonly curSpan: number;
  readonly fillableByN: Record<2 | 3 | 4, number>;
  readonly deadByN: Record<2 | 3 | 4, number>;
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

  choosePlacement(view: ActiveGameView, rng: RandomSource): TilePlacement {
    const w = this.genome.weights;
    const unseenCounts = countUnseenColors(view.unseenTiles);
    const { minX, maxX, minY, maxY } = view.board.bounds;
    const ctx: TurnContext = {
      unseenCounts,
      bloomPriority: this.makeBloomPriority(unseenCounts, countFrontierColors(view.board.frontierConstraints)),
      progress: 1 - view.remainingDrawCount / 26,
      curSpan: maxX - minX + (maxY - minY),
      fillableByN: { 2: w.fillablePocket2Weight, 3: w.fillablePocket3Weight, 4: w.fillablePocket4Weight },
      deadByN: { 2: w.deadPocket2Penalty, 3: w.deadPocket3Penalty, 4: w.deadPocket4Penalty },
    };
    return selectBestPlacement(view.validPlacements, (p) => this.scorePlacement(view, p, ctx), rng);
  }

  chooseBlooms(
    view: ActiveGameView,
    _placement: TilePlacement,
    pendingCorners: readonly PendingCornerBloom[],
    _rng: RandomSource,
  ): readonly BloomPlacement[] {
    return BloomAssignmentSolver.solve(
      pendingCorners,
      this.makeBloomPriority(countUnseenColors(view.unseenTiles), countFrontierColors(view.board.frontierConstraints)),
    );
  }

  private scorePlacement(view: ActiveGameView, placement: TilePlacement, ctx: TurnContext): number {
    const w = this.genome.weights;
    const { coord, rotation } = placement;
    const { minX, maxX, minY, maxY } = view.board.bounds;
    const preview = view.board.previewPlacement(view.currentTile, placement);
    const blooms = BloomAssignmentSolver.solve(view.eligibleBloomsFor(placement), ctx.bloomPriority).length;

    let score = blooms * (w.immediateBloomWeight + ctx.progress * w.bloomUrgencyLateSlope);
    if (blooms >= 2) score += w.multiBloomBonus * (blooms - 1);
    const newSpan = Math.max(maxX, coord.x) - Math.min(minX, coord.x) + (Math.max(maxY, coord.y) - Math.min(minY, coord.y));
    score += preview.neighborCount * (w.neighborCountWeight + ctx.progress * w.compactnessLateSlope);
    score += (newSpan - ctx.curSpan) * w.boundingBoxGrowthWeight + (Math.abs(coord.x) + Math.abs(coord.y)) * w.centerDistanceWeight;

    for (const fc of preview.affectedFrontierConstraints) {
      if (fc.neighborCount === 1) continue;
      const matches = countMatchingUnseen(fc, view.unseenTiles);
      if (matches === 0) {
        score += ctx.deadByN[fc.neighborCount];
      } else {
        const hasUnplayed = fc.requiredEdges.some((c) => c !== null && view.unplayedFlowers.has(c));
        score += ctx.fillableByN[fc.neighborCount] + Math.min(matches, 4) * w.pocketMatchDiversityWeight;
        score += hasUnplayed ? w.unplayedCornerSetupWeight : w.alreadyBloomedCornerWeight;
      }
    }
    for (const dir of ALL_DIRECTIONS) {
      if (view.board.tileAt(coord.neighbor(dir)) !== undefined) continue;
      const c = view.currentTile.edgeAt(dir, rotation);
      score += (view.unplayedFlowers.has(c) ? w.exposedUnplayedColorWeight : 0) + (ctx.unseenCounts[c] / 14) * w.exposedAbundanceWeight;
    }
    return score;
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
