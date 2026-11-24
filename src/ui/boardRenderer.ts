import { Direction, GridCoord } from '../game';
import type { BoardBounds, FlowerColor, GameSnapshot, PondTile, Rotation } from '../game';
import { FLOWER_PALETTE, POND_THEME } from './palette';

export interface RenderRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardLayout {
  readonly tileSize: number;
  readonly originX: number;
  readonly originY: number;
}

export interface BoardRenderOptions {
  readonly detailed?: boolean;
  readonly badgeText?: string;
}

export interface DrawTileOptions {
  readonly detailed?: boolean;
  readonly cutoutFill?: string;
  readonly alpha?: number;
}

const EDGE_ARCS: readonly {
  readonly dir: Direction;
  readonly dx: number;
  readonly dy: number;
  readonly start: number;
  readonly end: number;
}[] = [
  { dir: Direction.West, dx: 0, dy: 0.5, start: -Math.PI / 2, end: Math.PI / 2 },
  { dir: Direction.North, dx: 0.5, dy: 0, start: 0, end: Math.PI },
  { dir: Direction.East, dx: 1, dy: 0.5, start: Math.PI / 2, end: (3 * Math.PI) / 2 },
  { dir: Direction.South, dx: 0.5, dy: 1, start: Math.PI, end: 2 * Math.PI },
];

const CORNERS: readonly [number, number][] = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
];

export function computeBoardLayout(
  bounds: BoardBounds,
  rect: RenderRect,
  pad: number,
  marginCells = 0,
): BoardLayout {
  const minX = bounds.minX - marginCells;
  const maxX = bounds.maxX + marginCells;
  const minY = bounds.minY - marginCells;
  const maxY = bounds.maxY + marginCells;
  const spanX = Math.max(4, maxX - minX + 1);
  const spanY = Math.max(4, maxY - minY + 1);
  const tileSize = Math.max(4, Math.min((rect.width - pad * 2) / spanX, (rect.height - pad * 2) / spanY));
  const boardW = (maxX - minX + 1) * tileSize;
  const boardH = (maxY - minY + 1) * tileSize;
  const originX = rect.x + (rect.width - boardW) / 2 - minX * tileSize;
  const originY = rect.y + (rect.height - boardH) / 2 - minY * tileSize;
  return { tileSize, originX, originY };
}

export function canvasToGrid(px: number, py: number, layout: BoardLayout): GridCoord {
  return new GridCoord(
    Math.floor((px - layout.originX) / layout.tileSize),
    Math.floor((py - layout.originY) / layout.tileSize),
  );
}

export function drawTile(
  ctx: CanvasRenderingContext2D,
  tile: PondTile,
  rotation: Rotation,
  tx: number,
  ty: number,
  tileSize: number,
  options: DrawTileOptions = {},
): void {
  const detailed = options.detailed ?? false;
  const cutoutFill = options.cutoutFill ?? POND_THEME.cutoutFill;
  const alpha = options.alpha ?? 1;
  const petalR = tileSize * 0.24;
  const cutoutR = tileSize * 0.16;

  if (alpha < 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
  }

  ctx.fillStyle = POND_THEME.tileFill;
  ctx.fillRect(tx, ty, tileSize, tileSize);

  for (const edge of EDGE_ARCS) {
    const style = FLOWER_PALETTE[tile.edgeAt(edge.dir, rotation)];
    ctx.beginPath();
    ctx.arc(tx + edge.dx * tileSize, ty + edge.dy * tileSize, petalR, edge.start, edge.end);
    ctx.closePath();
    ctx.fillStyle = style.fill;
    ctx.fill();
    if (detailed) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = Math.max(1, tileSize * 0.03);
      ctx.stroke();
    }
  }

  ctx.fillStyle = cutoutFill;
  for (const [cx, cy] of CORNERS) {
    ctx.beginPath();
    ctx.arc(tx + cx * tileSize, ty + cy * tileSize, cutoutR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = POND_THEME.tileStroke;
  ctx.lineWidth = detailed ? 1.5 : 0.75;
  ctx.strokeRect(tx + 0.5, ty + 0.5, tileSize - 1, tileSize - 1);

  if (alpha < 1) ctx.restore();
}

export function drawBloom(
  ctx: CanvasRenderingContext2D,
  color: FlowerColor,
  bx: number,
  by: number,
  tileSize: number,
  alpha = 1,
): void {
  const bloomR = tileSize * 0.22;
  const style = FLOWER_PALETTE[color];

  if (alpha < 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
  }

  ctx.beginPath();
  ctx.arc(bx, by, bloomR * 1.4, 0, Math.PI * 2);
  ctx.fillStyle = style.glow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(bx, by, bloomR, 0, Math.PI * 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = Math.max(1, tileSize * 0.04);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(bx, by, bloomR * 0.34, 0, Math.PI * 2);
  ctx.fillStyle = POND_THEME.winBorder;
  ctx.fill();

  if (alpha < 1) ctx.restore();
}

export function renderBoardSnapshot(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  rect: RenderRect,
  options: BoardRenderOptions = {},
): void {
  const { x, y, width, height } = rect;
  const detailed = options.detailed ?? false;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  ctx.fillStyle = snapshot.isWin ? POND_THEME.cellWinBg : POND_THEME.cellBg;
  ctx.fillRect(x, y, width, height);

  const { tileSize, originX, originY } = computeBoardLayout(snapshot.bounds, rect, detailed ? 24 : 6);
  const cutoutFill = snapshot.isWin ? POND_THEME.cellWinBg : POND_THEME.cutoutFill;

  for (const placed of snapshot.placedTiles) {
    const tx = originX + placed.coord.x * tileSize;
    const ty = originY + placed.coord.y * tileSize;
    drawTile(ctx, placed.tile, placed.rotation, tx, ty, tileSize, { detailed, cutoutFill });
  }

  for (const bloom of snapshot.placedBlooms) {
    const bx = originX + (bloom.corner.cx + 1) * tileSize;
    const by = originY + (bloom.corner.cy + 1) * tileSize;
    drawBloom(ctx, bloom.color, bx, by, tileSize);
  }

  if (options.badgeText) {
    const fontSize = Math.max(9, Math.min(12, Math.floor(height * 0.12)));
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = POND_THEME.badgeBg;
    const metrics = ctx.measureText(options.badgeText);
    const bw = metrics.width + 8;
    const bh = fontSize + 6;
    ctx.fillRect(x + 4, y + 4, bw, bh);
    ctx.fillStyle = snapshot.isWin ? POND_THEME.badgeWinText : POND_THEME.badgeText;
    ctx.textBaseline = 'top';
    ctx.fillText(options.badgeText, x + 8, y + 7);
  }

  ctx.strokeStyle = snapshot.isWin ? POND_THEME.winBorder : POND_THEME.cellBorder;
  ctx.lineWidth = snapshot.isWin ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  ctx.restore();
}
