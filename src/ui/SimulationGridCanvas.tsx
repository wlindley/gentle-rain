import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import type { SlotView } from '../simulation';
import { renderBoardSnapshot } from './boardRenderer';
import { POND_THEME } from './palette';

export interface SimulationGridCanvasProps {
  readonly slots: readonly SlotView[];
  readonly onSelectSlot: (slot: SlotView) => void;
}

function gridDims(count: number): { cols: number; rows: number } {
  const safe = Math.max(1, count);
  const cols = Math.ceil(Math.sqrt(safe));
  return { cols, rows: Math.ceil(safe / cols) };
}

export function SimulationGridCanvas({ slots, onSelectSlot }: SimulationGridCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(240, Math.floor(rect.width));
      const height = Math.max(180, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = POND_THEME.waterBg;
      ctx.fillRect(0, 0, width, height);

      if (slots.length === 0) return;
      const { cols, rows } = gridDims(slots.length);
      const cellW = width / cols;
      const cellH = height / rows;
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i]!;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const snap = slot.snapshot;
        const badge = slots.length <= 64 ? `${snap.placedBlooms.length}/8 · ${snap.score}` : undefined;
        renderBoardSnapshot(
          ctx,
          snap,
          { x: col * cellW, y: row * cellH, width: cellW, height: cellH },
          { badgeText: badge },
        );
      }
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [slots]);

  const handleClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || slots.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const { cols, rows } = gridDims(slots.length);
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * rows)));
    const slot = slots[row * cols + col];
    if (slot) onSelectSlot(slot);
  };

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        aria-label="Live parallel A Gentle Rain simulation grid. Click any board to inspect."
      />
    </div>
  );
}
