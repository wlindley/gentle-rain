import type { FlowerColor } from '../game';

export interface FlowerStyle {
  readonly fill: string;
  readonly stroke: string;
  readonly glow: string;
  readonly label: string;
}

export const FLOWER_PALETTE: Record<FlowerColor, FlowerStyle> = {
  red: { fill: '#e85555', stroke: '#ff9696', glow: 'rgba(232, 85, 85, 0.55)', label: 'Red' },
  orange: { fill: '#f39237', stroke: '#ffd08a', glow: 'rgba(243, 146, 55, 0.55)', label: 'Orange' },
  white: { fill: '#f4f7f8', stroke: '#cbdbe0', glow: 'rgba(244, 247, 248, 0.55)', label: 'White' },
  yellow: { fill: '#f4d35e', stroke: '#fff2b2', glow: 'rgba(244, 211, 94, 0.55)', label: 'Yellow' },
  pink: { fill: '#f082b4', stroke: '#ffc2df', glow: 'rgba(240, 130, 180, 0.55)', label: 'Pink' },
  blue: { fill: '#4fa8e8', stroke: '#a6dcff', glow: 'rgba(79, 168, 232, 0.55)', label: 'Blue' },
  purple: { fill: '#9f6be8', stroke: '#d2b8ff', glow: 'rgba(159, 107, 232, 0.55)', label: 'Purple' },
  black: { fill: '#2c363f', stroke: '#7b8e9c', glow: 'rgba(123, 142, 156, 0.45)', label: 'Black' },
};

export const POND_THEME = {
  waterBg: '#0b1c22',
  cellBg: '#10262e',
  cellWinBg: '#133138',
  tileFill: '#1c3e48',
  tileStroke: '#316270',
  cutoutFill: '#0b1c22',
  winBorder: '#e7c56b',
  activeBorder: '#4ca6b8',
  textMuted: '#93b4be',
} as const;
