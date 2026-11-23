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
  waterBg: '#dce9ed',
  cellBg: '#edf4f6',
  cellWinBg: '#f9f4e1',
  tileFill: '#345b66',
  tileStroke: '#203d46',
  cutoutFill: '#edf4f6',
  winBorder: '#c9921a',
  cellBorder: '#c2d5dc',
  badgeBg: 'rgba(255, 255, 255, 0.9)',
  badgeText: '#142c35',
  badgeWinText: '#8a5f00',
  activeBorder: '#1f7a8c',
  textMuted: '#4b6873',
} as const;
