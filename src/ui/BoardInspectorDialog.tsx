import { useEffect, useRef } from 'react';
import type { GameSnapshot } from '../game';
import { renderBoardSnapshot } from './boardRenderer';

export interface BoardInspectorDialogProps {
  readonly title: string;
  readonly snapshot: GameSnapshot | null;
  readonly onClose: () => void;
}

export function BoardInspectorDialog({ title, snapshot, onClose }: BoardInspectorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (snapshot && !dialog.open) dialog.showModal();
    if (!snapshot && dialog.open) dialog.close();
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;
    const width = 580;
    const height = 435;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderBoardSnapshot(ctx, snapshot, { x: 0, y: 0, width, height }, { detailed: true });
  }, [snapshot]);

  return (
    <dialog
      ref={dialogRef}
      className="inspector-dialog"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      {snapshot && (
        <>
          <div className="dialog-head">
            <strong>{title}</strong>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <canvas ref={canvasRef} className="dialog-canvas" aria-label={`Zoomed board view: ${title}`} />
          <div className="kpi-grid" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <div className="kpi"><div className="kpi-label">Score</div><div className="kpi-value">{snapshot.score}</div></div>
            <div className="kpi"><div className="kpi-label">Blooms</div><div className="kpi-value">{snapshot.placedBlooms.length} / 8</div></div>
            <div className="kpi"><div className="kpi-label">Tiles Placed</div><div className="kpi-value">{snapshot.placedTiles.length}</div></div>
            <div className="kpi"><div className="kpi-label">Remaining</div><div className="kpi-value">{snapshot.remainingDrawCount}</div></div>
            <div className="kpi"><div className="kpi-label">Discarded</div><div className="kpi-value">{snapshot.discardedTiles.length}</div></div>
          </div>
        </>
      )}
    </dialog>
  );
}
