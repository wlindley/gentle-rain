import { useEffect, useRef } from 'react';
import type { Bot } from '../bots';
import { FLOWER_COLORS } from '../game';
import type { FlowerColor, PondTile, Rotation } from '../game';
import { drawTile } from './boardRenderer';
import { InteractiveBoardCanvas } from './InteractiveBoardCanvas';
import { FLOWER_PALETTE, POND_THEME } from './palette';
import { usePlayController } from './usePlayController';

export interface PlayPanelProps { readonly bots: readonly Bot[]; }

function TilePreview({ tile, rotation }: { readonly tile: PondTile; readonly rotation: Rotation }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = 80 * dpr; c.height = 80 * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = POND_THEME.cellBg; ctx.fillRect(0, 0, 80, 80);
    drawTile(ctx, tile, rotation, 4, 4, 72, { detailed: true, cutoutFill: POND_THEME.cellBg });
  }, [tile, rotation]);
  return <canvas ref={ref} width={80} height={80} aria-label="Current pond tile preview" style={{ width: 80, height: 80, borderRadius: 6, border: `1px solid ${POND_THEME.cellBorder}` }} />;
}

const FlowerDot = ({ color }: { readonly color: FlowerColor }) => (
  <span className="flower-dot" style={{ background: FLOWER_PALETTE[color].fill, borderColor: FLOWER_PALETTE[color].stroke }} />
);

export function PlayPanel({ bots }: PlayPanelProps) {
  const play = usePlayController(bots);
  const actionsRef = useRef(play);
  actionsRef.current = play;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (e.key === 'Enter' && tag === 'BUTTON')) return;
      const k = e.key.toLowerCase();
      if (k === 'q') actionsRef.current.rotatePreview(-1);
      else if (k === 'e' || k === 'r') actionsRef.current.rotatePreview(1);
      else if (e.key === 'Enter') actionsRef.current.confirmSelection();
      else if (e.key === 'Escape') actionsRef.current.cancelSelection();
      else if (k === 'h') actionsRef.current.toggleHint();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const { snapshot, turnState } = play;
  const activeRot: Rotation = turnState.kind === 'selected' ? turnState.rotation : turnState.kind === 'browsing' ? turnState.previewRotation : 0;
  const selectedRots = turnState.kind === 'selected' ? (play.validRotationsByCoord.get(turnState.coord.key) ?? []) : [];
  const subtitle =
    turnState.kind === 'complete' ? (turnState.result.isWin ? 'All 8 flowers bloomed — you won!' : 'Draw pile exhausted — game complete.') :
    turnState.kind === 'must_discard' ? 'No legal placement exists — discard the current tile to continue.' :
    turnState.kind === 'selected' ? 'Adjust rotation or pick bloom colors, then confirm (Enter) or cancel (Esc).' :
    'Click any dashed frontier cell to place. Press Q/E to rotate, H for a bot hint.';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <section className="panel control-bar" aria-label="Play controls">
        <label className="field">Seed<input type="number" value={play.seed} onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n)) play.startNewGame(n); }} style={{ width: '96px' }} /></label>
        <div className="btn-group" style={{ marginLeft: 0 }}>
          <button type="button" onClick={play.replaySeed}>Replay Seed</button>
          <button type="button" className="primary" onClick={() => play.startNewGame()}>New Game</button>
        </div>
        <div className="play-pills">
          <span className="pill">Turn {snapshot.turnNumber}</span><span className="pill">Blooms {snapshot.placedBlooms.length}/8</span>
          <span className="pill">Draw {snapshot.remainingDrawCount}</span><span className="pill">Discards {snapshot.discardedTiles.length}</span>
          <span className="pill strong">Score {snapshot.score}</span>
        </div>
      </section>

      <main className="workspace-grid">
        <section className="panel" aria-label="Interactive pond board">
          <h2>Interactive Pond · <span style={{ fontWeight: 400, fontSize: '0.82rem' }}>{subtitle}</span></h2>
          <InteractiveBoardCanvas snapshot={snapshot} validRotationsByCoord={play.validRotationsByCoord} turnState={turnState} pendingCorners={play.pendingCorners} advice={play.advice} onClickCoord={play.clickCoord} />
        </section>

        <aside style={{ display: 'grid', gap: '0.85rem', alignContent: 'start' }}>
          <section className="panel" aria-label="Current turn controls">
            {turnState.kind === 'complete' ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <h2 style={{ margin: 0 }}>{turnState.result.isWin ? 'Pond Complete — Victory!' : 'Game Over'}</h2>
                <div className="kpi-grid">
                  {[['Score', turnState.result.score], ['Blooms', `${turnState.result.placedFlowers}/8`], ['Draw Left', turnState.result.remainingDrawCount], ['Discards', turnState.result.discardedTilesCount]].map(([lbl, val]) => (
                    <div key={String(lbl)} className="kpi"><div className="kpi-label">{lbl}</div><div className="kpi-value">{val}</div></div>
                  ))}
                </div>
                <div className="btn-group" style={{ marginLeft: 0 }}>
                  <button type="button" className="primary" onClick={() => play.startNewGame()}>Play Again</button>
                  <button type="button" onClick={play.replaySeed}>Replay Seed</button>
                  <button type="button" className="gold" onClick={play.compareWithBotOnSeed}>Compare vs {play.advisorBot.name}</button>
                </div>
                {play.botBenchmark && <div className="advisor-box"><strong>Same-Seed Benchmark ({play.botBenchmark.botName}):</strong> Score {play.botBenchmark.result.score} ({play.botBenchmark.result.placedFlowers}/8, {play.botBenchmark.result.isWin ? 'Win' : 'Loss'}) vs Your Score {turnState.result.score}.</div>}
              </div>
            ) : turnState.kind === 'must_discard' ? (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <h2 style={{ margin: 0 }}>Forced Discard</h2>
                <div className="play-tile-row">{snapshot.currentTile && <TilePreview tile={snapshot.currentTile} rotation={0} />}<div style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>No valid placements exist for this tile.</div></div>
                <button type="button" className="primary" onClick={play.discardTile}>Discard Tile</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                <h2 style={{ margin: 0 }}>{turnState.kind === 'selected' ? `Selected (${turnState.coord.key})` : 'Current Tile'}</h2>
                <div className="play-tile-row">
                  {snapshot.currentTile && <TilePreview tile={snapshot.currentTile} rotation={activeRot} />}
                  <div style={{ display: 'grid', gap: '0.4rem' }}>
                    <div className="btn-group" style={{ marginLeft: 0 }}>
                      <button type="button" onClick={() => play.rotatePreview(-1)}>↺ (Q)</button>
                      <button type="button" onClick={() => play.rotatePreview(1)}>↻ (E)</button>
                    </div>
                    {selectedRots.length > 1 && <div className="btn-group" style={{ marginLeft: 0 }}>{selectedRots.map((r) => <button key={r} type="button" className={turnState.kind === 'selected' && turnState.rotation === r ? 'primary' : ''} onClick={() => play.selectRotation(r)}>{r * 90}°</button>)}</div>}
                  </div>
                </div>
                {turnState.kind === 'selected' && play.pendingCorners.length > 0 && (
                  <div className="bloom-picker">
                    {play.pendingCorners.map((pc) => {
                      const chosen = turnState.chosenBlooms[pc.corner.key];
                      const otherUsed = new Set<FlowerColor>(Object.entries(turnState.chosenBlooms).filter(([k]) => k !== pc.corner.key).map(([, v]) => v));
                      return (
                        <div key={pc.corner.key} className="bloom-row">
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Corner ({pc.corner.key}):</span>
                          {pc.eligibleColors.length === 0 ? <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>No unplayed colors</span> : pc.eligibleColors.map((c) => (
                            <button key={c} type="button" className={`flower-pill ${chosen === c ? 'selected' : ''}`} disabled={otherUsed.has(c)} onClick={() => play.chooseBloom(pc.corner.key, c)}><FlowerDot color={c} />{FLOWER_PALETTE[c].label}</button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                {turnState.kind === 'selected' && <div className="btn-group" style={{ marginLeft: 0 }}><button type="button" className="primary" disabled={!play.canConfirmSelected} onClick={play.confirmSelection}>Confirm Placement</button><button type="button" onClick={play.cancelSelection}>Cancel</button></div>}
              </div>
            )}
          </section>
          <section className="panel" aria-label="Unplayed flowers">
            <h2>Unplayed Flowers ({snapshot.unplayedFlowers.length}/8)</h2>
            <div className="flower-tray">{FLOWER_COLORS.map((c) => <span key={c} className={`flower-pill ${snapshot.unplayedFlowers.includes(c) ? '' : 'bloomed'}`}><FlowerDot color={c} />{FLOWER_PALETTE[c].label}</span>)}</div>
          </section>
          <section className="panel" aria-label="Bot move advisor">
            <h2>Bot Move Advisor</h2>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label className="field">Advisor Bot<select value={play.advisorBotId} onChange={(e) => play.setAdvisorBotId(e.target.value)}>{bots.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <div className="btn-group" style={{ marginLeft: 0, alignItems: 'center' }}>
                <button type="button" className="gold" disabled={snapshot.isComplete} onClick={play.toggleHint}>{play.showHint ? 'Hide Bot Hint (H)' : 'Show Bot Hint (H)'}</button>
                <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><input type="checkbox" checked={play.autoShowHint} onChange={(e) => play.setAutoShowHint(e.target.checked)} /> Auto-show</label>
              </div>
              {play.showHint && play.advice && (
                <div className="advisor-box">
                  <div style={{ marginBottom: '0.4rem' }}>{play.advice.kind === 'discard' ? 'Advisor recommends: Discard tile (no legal placements).' : `Place at (${play.advice.placement.coord.key}) · ${play.advice.placement.rotation * 90}°${play.advice.blooms.length > 0 ? ` · Bloom ${play.advice.blooms.map((b) => FLOWER_PALETTE[b.color].label).join(', ')}` : ''}`}</div>
                  <button type="button" className="primary" onClick={play.applyBotAdvice}>Play Bot&apos;s Move</button>
                </div>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
