import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { BotMoveAdvice } from '../bots';
import { GridCoord } from '../game';
import type { GameSnapshot, PendingCornerBloom, Rotation } from '../game';
import { canvasToGrid, computeBoardLayout, drawBloom, drawTile } from './boardRenderer';
import type { BoardLayout } from './boardRenderer';
import { POND_THEME } from './palette';
import type { PlayTurnState } from './usePlayController';

export interface InteractiveBoardCanvasProps {
  readonly snapshot: GameSnapshot;
  readonly validRotationsByCoord: ReadonlyMap<string, readonly Rotation[]>;
  readonly turnState: PlayTurnState;
  readonly pendingCorners: readonly PendingCornerBloom[];
  readonly advice: BotMoveAdvice | null;
  readonly onClickCoord: (coord: GridCoord) => void;
}

const CANVAS_HEIGHT = 540;

export function InteractiveBoardCanvas({
  snapshot,
  validRotationsByCoord,
  turnState,
  pendingCorners,
  advice,
  onClickCoord,
}: InteractiveBoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutRef = useRef<BoardLayout | null>(null);
  const [size, setSize] = useState({ width: 640, height: CANVAS_HEIGHT });
  const [hoveredCoord, setHoveredCoord] = useState<GridCoord | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: Math.max(280, Math.floor(entry.contentRect.width)), height: CANVAS_HEIGHT });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rect = { x: 0, y: 0, width: size.width, height: size.height };
    ctx.fillStyle = snapshot.isWin ? POND_THEME.cellWinBg : POND_THEME.cellBg;
    ctx.fillRect(0, 0, size.width, size.height);

    const layout = computeBoardLayout(snapshot.bounds, rect, 24, 1);
    layoutRef.current = layout;
    const { tileSize, originX, originY } = layout;
    const cutoutFill = snapshot.isWin ? POND_THEME.cellWinBg : POND_THEME.cutoutFill;

    for (const placed of snapshot.placedTiles) {
      drawTile(ctx, placed.tile, placed.rotation, originX + placed.coord.x * tileSize, originY + placed.coord.y * tileSize, tileSize, { detailed: true, cutoutFill });
    }
    for (const bloom of snapshot.placedBlooms) {
      drawBloom(ctx, bloom.color, originX + (bloom.corner.cx + 1) * tileSize, originY + (bloom.corner.cy + 1) * tileSize, tileSize);
    }

    if (!snapshot.isComplete) {
      ctx.save();
      ctx.fillStyle = 'rgba(31, 122, 140, 0.08)';
      ctx.strokeStyle = 'rgba(31, 122, 140, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      for (const key of validRotationsByCoord.keys()) {
        const c = GridCoord.fromKey(key);
        const tx = originX + c.x * tileSize, ty = originY + c.y * tileSize;
        ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
        ctx.strokeRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);
      }
      ctx.restore();

      if (advice?.kind === 'place') {
        const tx = originX + advice.placement.coord.x * tileSize, ty = originY + advice.placement.coord.y * tileSize;
        drawTile(ctx, snapshot.currentTile, advice.placement.rotation, tx, ty, tileSize, { detailed: true, cutoutFill, alpha: 0.55 });
        ctx.save();
        ctx.strokeStyle = POND_THEME.winBorder; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
        ctx.strokeRect(tx + 1.5, ty + 1.5, tileSize - 3, tileSize - 3);
        ctx.setLineDash([]);
        ctx.fillStyle = POND_THEME.winBorder; ctx.fillRect(tx + 4, ty + 4, 30, 15);
        ctx.fillStyle = '#ffffff'; ctx.font = '700 10px system-ui, sans-serif'; ctx.textBaseline = 'top';
        ctx.fillText('BOT', tx + 8, ty + 6);
        for (const b of advice.blooms) {
          const bx = originX + (b.corner.cx + 1) * tileSize, by = originY + (b.corner.cy + 1) * tileSize;
          drawBloom(ctx, b.color, bx, by, tileSize, 0.85);
          ctx.beginPath(); ctx.arc(bx, by, tileSize * 0.29, 0, Math.PI * 2);
          ctx.strokeStyle = POND_THEME.winBorder; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke();
        }
        ctx.restore();
      }

      let preview: { coord: GridCoord; rotation: Rotation; isSelected: boolean } | null = null;
      if (turnState.kind === 'selected') {
        preview = { coord: turnState.coord, rotation: turnState.rotation, isSelected: true };
      } else if (turnState.kind === 'browsing' && hoveredCoord) {
        const rots = validRotationsByCoord.get(hoveredCoord.key);
        if (rots && rots.length > 0) {
          preview = { coord: hoveredCoord, rotation: rots.includes(turnState.previewRotation) ? turnState.previewRotation : rots[0]!, isSelected: false };
        }
      }
      if (preview) {
        const tx = originX + preview.coord.x * tileSize, ty = originY + preview.coord.y * tileSize;
        drawTile(ctx, snapshot.currentTile, preview.rotation, tx, ty, tileSize, { detailed: true, cutoutFill, alpha: preview.isSelected ? 0.82 : 0.62 });
        ctx.strokeStyle = POND_THEME.activeBorder; ctx.lineWidth = preview.isSelected ? 3 : 2;
        ctx.strokeRect(tx + 1.5, ty + 1.5, tileSize - 3, tileSize - 3);
      }
      if (turnState.kind === 'selected') {
        for (const pc of pendingCorners) {
          const bx = originX + (pc.corner.cx + 1) * tileSize, by = originY + (pc.corner.cy + 1) * tileSize;
          const chosen = turnState.chosenBlooms[pc.corner.key];
          if (chosen) drawBloom(ctx, chosen, bx, by, tileSize, 0.9);
          else {
            ctx.save(); ctx.beginPath(); ctx.arc(bx, by, tileSize * 0.25, 0, Math.PI * 2);
            ctx.strokeStyle = pc.eligibleColors.length > 0 ? POND_THEME.activeBorder : POND_THEME.textMuted;
            ctx.lineWidth = 2.5;
            if (pc.eligibleColors.length === 0) ctx.setLineDash([4, 3]);
            ctx.stroke(); ctx.restore();
          }
        }
      }
    }

    ctx.strokeStyle = snapshot.isWin ? POND_THEME.winBorder : POND_THEME.cellBorder;
    ctx.lineWidth = snapshot.isWin ? 2 : 1;
    ctx.strokeRect(0.5, 0.5, size.width - 1, size.height - 1);
  }, [snapshot, validRotationsByCoord, turnState, pendingCorners, advice, hoveredCoord, size]);

  const coordFromEvent = (e: MouseEvent<HTMLCanvasElement>): GridCoord | null => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return null;
    const rect = canvas.getBoundingClientRect();
    return canvasToGrid(e.clientX - rect.left, e.clientY - rect.top, layout);
  };

  const handlePointerMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const c = coordFromEvent(e);
    const valid = c && validRotationsByCoord.has(c.key) ? c : null;
    setHoveredCoord((prev) => (prev?.key === valid?.key ? prev : valid));
  };

  return (
    <canvas
      ref={canvasRef}
      aria-label="Interactive Gentle Rain pond board"
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoveredCoord(null)}
      onClick={(e) => { const c = coordFromEvent(e); if (c) onClickCoord(c); }}
      style={{ width: '100%', height: `${CANVAS_HEIGHT}px`, display: 'block', borderRadius: '8px', cursor: hoveredCoord ? 'pointer' : 'default' }}
    />
  );
}
