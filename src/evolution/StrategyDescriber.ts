import { GENE_SPECS, Genome } from './Genome';

export interface StrategyDriver {
  readonly label: string;
  readonly normalizedWeight: number;
}

export interface StrategySummary {
  readonly headline: string;
  readonly bullets: readonly string[];
  readonly topDrivers: readonly StrategyDriver[];
}

export function describeGenome(genome: Genome): StrategySummary {
  const w = genome.weights;
  const topDrivers: StrategyDriver[] = GENE_SPECS.map((spec) => ({
    label: spec.label,
    normalizedWeight: w[spec.key] / Math.max(Math.abs(spec.min), Math.abs(spec.max)),
  }))
    .sort((a, b) => Math.abs(b.normalizedWeight) - Math.abs(a.normalizedWeight))
    .slice(0, 5);

  const avgDead = (w.deadPocket2Penalty + w.deadPocket3Penalty + w.deadPocket4Penalty) / 3;
  const avgFillable = (w.fillablePocket2Weight + w.fillablePocket3Weight + w.fillablePocket4Weight) / 3;

  const bloomTone = w.immediateBloomWeight >= 0 ? 'Bloom-Aggressive' : 'Bloom-Deferred';
  const pocketTone = avgDead < 0 ? 'Dead-Pocket-Averse' : 'Pocket-Tolerant';
  const shapeTone = w.neighborCountWeight >= 0 ? 'Compact Builder' : 'Sprawling Explorer';
  const headline = `${bloomTone}, ${pocketTone} ${shapeTone}`;

  const bullets: string[] = [
    `Blooms: ${w.immediateBloomWeight >= 0 ? 'Prioritizes' : 'De-prioritizes'} immediate blooms (${w.immediateBloomWeight.toFixed(0)}, multi-bloom ${w.multiBloomBonus.toFixed(0)}) and ${w.bloomUrgencyLateSlope >= 0 ? 'ramps up' : 'eases off'} urgency late (${w.bloomUrgencyLateSlope.toFixed(0)}).`,
    `Pockets: ${avgDead < 0 ? 'Strongly avoids' : 'Tolerates'} unfillable dead pockets (avg ${avgDead.toFixed(0)}) while weighting fillable pockets (${avgFillable.toFixed(0)}) and unplayed setups (${w.unplayedCornerSetupWeight.toFixed(0)}).`,
    `Geometry: ${w.neighborCountWeight >= 0 ? 'Favors compact high-neighbor clusters' : 'Spreads outward'} (neighbor ${w.neighborCountWeight.toFixed(0)}) and ${w.boundingBoxGrowthWeight <= 0 ? 'constrains' : 'encourages'} bounding-box expansion (${w.boundingBoxGrowthWeight.toFixed(0)}).`,
    `Open edges: Weights exposed unplayed colors at ${w.exposedUnplayedColorWeight.toFixed(0)} and unseen-deck edge abundance at ${w.exposedAbundanceWeight.toFixed(0)}.`,
    `Bloom choice: ${w.bloomScarcityPriority >= 0 ? 'Blooms scarcer unseen colors first' : 'Preserves scarce colors and blooms common ones'} (unseen ${w.bloomScarcityPriority.toFixed(0)}, frontier ${w.bloomFrontierScarcityPriority.toFixed(0)}).`,
  ];

  return { headline, bullets, topDrivers };
}
