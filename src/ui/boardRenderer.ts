import { Direction } from '../game';
import type { GameSnapshot } from '../game';
import { FLOWER_PALETTE, POND_THEME } from './palette';

export interface RenderRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BoardRenderOptions {
  readonly detailed?: boolean;
  readonly badgeText?: string;
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

  const { minX, maxX, minY, maxY } = snapshot.bounds;
  const spanX = Math.max(4, maxX - minX + 1);
  const spanY = Math.max(4, maxY - minY + 1);
  const pad = detailed ? 24 : 6;
  const tileSize = Math.max(4, Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY));
  const boardW = (maxX - minX + 1) * tileSize;
  const boardH = (maxY - minY + 1) * tileSize;
  const originX = x + (width - boardW) / 2 - minX * tileSize;
  const originY = y + (height - boardH) / 2 - minY * tileSize;
  const petalR = tileSize * 0.24;
  const cutoutR = tileSize * 0.16;

  for (const placed of snapshot.placedTiles) {
    const tx = originX + placed.coord.x * tileSize;
    const ty = originY + placed.coord.y * tileSize;

    ctx.fillStyle = POND_THEME.tileFill;
    ctx.fillRect(tx, ty, tileSize, tileSize);

    for (const edge of EDGE_ARCS) {
      const style = FLOWER_PALETTE[placed.tile.edgeAt(edge.dir, placed.rotation)];
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

    ctx.fillStyle = snapshot.isWin ? POND_THEME.cellWinBg : POND_THEME.cutoutFill;
    for (const [cx, cy] of CORNERS) {
      ctx.beginPath();
      ctx.arc(tx + cx * tileSize, ty + cy * tileSize, cutoutR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = POND_THEME.tileStroke;
    ctx.lineWidth = detailed ? 1.5 : 0.75;
    ctx.strokeRect(tx + 0.5, ty + 0.5, tileSize - 1, tileSize - 1);
  }

  const bloomR = tileSize * 0.22;
  for (const bloom of snapshot.placedBlooms) {
    const bx = originX + (bloom.corner.cx + 1) * tileSize;
    const by = originY + (bloom.corner.cy + 1) * tileSize;
    const style = FLOWER_PALETTE[bloom.color];

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
