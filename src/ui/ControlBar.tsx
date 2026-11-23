import type { Bot } from '../bots';

export type SpeedMode = '1x' | '4x' | '20x' | 'turbo';

export interface ControlBarProps {
  readonly bots: readonly Bot[];
  readonly selectedBotId: string;
  readonly targetGames: number;
  readonly parallelSlots: number;
  readonly speed: SpeedMode;
  readonly useFixedSeed: boolean;
  readonly seed: number;
  readonly isRunning: boolean;
  readonly isTournamentRunning: boolean;
  readonly onSelectBot: (botId: string) => void;
  readonly onTargetGamesChange: (count: number) => void;
  readonly onParallelSlotsChange: (slots: number) => void;
  readonly onSpeedChange: (speed: SpeedMode) => void;
  readonly onToggleFixedSeed: (enabled: boolean) => void;
  readonly onSeedChange: (seed: number) => void;
  readonly onToggleRun: () => void;
  readonly onReset: () => void;
  readonly onCompareAll: () => void;
}

const GAME_COUNTS = [100, 1000, 5000, 10000] as const;
const SLOT_COUNTS = [16, 36, 64, 100] as const;

export function ControlBar(props: ControlBarProps) {
  const busy = props.isTournamentRunning;
  return (
    <section className="panel control-bar" aria-label="Simulation controls">
      <label className="field">
        Bot Strategy
        <select value={props.selectedBotId} disabled={busy} onChange={(e) => props.onSelectBot(e.target.value)}>
          {props.bots.map((bot) => (
            <option key={bot.id} value={bot.id}>{bot.name}</option>
          ))}
        </select>
      </label>

      <label className="field">
        Games
        <select value={props.targetGames} disabled={busy} onChange={(e) => props.onTargetGamesChange(Number(e.target.value))}>
          {GAME_COUNTS.map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
        </select>
      </label>

      <label className="field">
        Live Grid
        <select value={props.parallelSlots} disabled={busy} onChange={(e) => props.onParallelSlotsChange(Number(e.target.value))}>
          {SLOT_COUNTS.map((n) => <option key={n} value={n}>{n} boards</option>)}
        </select>
      </label>

      <label className="field">
        Speed
        <select value={props.speed} onChange={(e) => props.onSpeedChange(e.target.value as SpeedMode)}>
          <option value="1x">1× (Watch)</option>
          <option value="4x">4× (Fast)</option>
          <option value="20x">20× (Rapid)</option>
          <option value="turbo">Turbo (Batch)</option>
        </select>
      </label>

      <label className="field">
        <span>
          <input
            type="checkbox"
            checked={props.useFixedSeed}
            disabled={busy}
            onChange={(e) => props.onToggleFixedSeed(e.target.checked)}
          />{' '}
          Fixed Seed
        </span>
        <input
          type="number"
          value={props.seed}
          disabled={!props.useFixedSeed || busy}
          onChange={(e) => props.onSeedChange(Math.trunc(Number(e.target.value) || 0))}
          style={{ width: '96px' }}
        />
      </label>

      <div className="btn-group">
        <button type="button" className="primary" disabled={busy} onClick={props.onToggleRun}>
          {props.isRunning ? 'Pause' : 'Run'}
        </button>
        <button type="button" disabled={busy} onClick={props.onReset}>Reset</button>
        <button type="button" className="gold" disabled={busy} onClick={props.onCompareAll}>
          {busy ? 'Comparing…' : 'Compare All Bots'}
        </button>
      </div>
    </section>
  );
}
