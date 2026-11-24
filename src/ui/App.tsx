import { useState } from 'react';
import type { Genome, GenomeEvaluation } from '../evolution';
import type { GameSnapshot } from '../game';
import { BoardInspectorDialog } from './BoardInspectorDialog';
import { ControlBar } from './ControlBar';
import { EvolutionPanel } from './EvolutionPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { SimulationGridCanvas } from './SimulationGridCanvas';
import { StatsPanel } from './StatsPanel';
import { useSimulationController } from './useSimulationController';

export function App() {
  const sim = useSimulationController();
  const [activeTab, setActiveTab] = useState<'simulator' | 'evolve'>('simulator');
  const [inspected, setInspected] = useState<{ title: string; snapshot: GameSnapshot } | null>(null);

  const handleSendToSimulator = (genome: Genome, evaluation: GenomeEvaluation | null) => {
    sim.registerEvolvedBot(genome, evaluation);
    setActiveTab('simulator');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>A Gentle Rain</h1>
          <p>
            {activeTab === 'simulator'
              ? `Parallel Monte Carlo Bot Simulator · ${sim.activeBot.description}`
              : 'Multi-Core Genetic Algorithm Bot Optimizer · Maximize 4×mean + median + 0.5×p95'}
          </p>
        </div>
        <nav className="tab-bar" aria-label="Workspace views">
          <button type="button" className={activeTab === 'simulator' ? 'active' : ''} onClick={() => setActiveTab('simulator')}>
            Simulator
          </button>
          <button type="button" className={activeTab === 'evolve' ? 'active' : ''} onClick={() => { sim.pause(); setActiveTab('evolve'); }}>
            Evolve Bot (GA)
          </button>
        </nav>
      </header>
      {activeTab === 'evolve' ? (
        <EvolutionPanel onSendToSimulator={handleSendToSimulator} />
      ) : (
        <>
          <ControlBar
            bots={sim.bots} selectedBotId={sim.selectedBotId} targetGames={sim.targetGames} parallelSlots={sim.parallelSlots}
            speed={sim.speed} useFixedSeed={sim.useFixedSeed} seed={sim.seed}
            isRunning={sim.runMode === 'simulating'} isTournamentRunning={sim.runMode === 'tournament'}
            onSelectBot={sim.selectBot} onTargetGamesChange={sim.changeTargetGames}
            onParallelSlotsChange={sim.changeParallelSlots} onSpeedChange={sim.setSpeed}
            onToggleFixedSeed={sim.toggleFixedSeed} onSeedChange={sim.changeSeed}
            onToggleRun={sim.toggleRun} onReset={sim.reset} onCompareAll={sim.compareAll}
          />
          <main className="workspace-grid">
            <section className="panel" aria-label="Live parallel boards">
              <h2>Live Parallel Pond Grid ({sim.slots.length} Active · Click any board to inspect)</h2>
              <SimulationGridCanvas
                slots={sim.slots}
                onSelectSlot={(slot) => setInspected({ title: `${sim.activeBot.name} — Game #${slot.gameIndex + 1}`, snapshot: slot.snapshot })}
              />
            </section>
            <StatsPanel
              botName={sim.activeBot.name} completedGames={sim.session.completedGames} targetGames={sim.targetGames}
              gamesPerSec={sim.gamesPerSec} stats={sim.session.stats}
              bestSnapshot={sim.session.bestSnapshot} worstSnapshot={sim.session.worstSnapshot}
              onInspectSnapshot={(title, snapshot) => setInspected({ title, snapshot })}
            />
          </main>
          <LeaderboardPanel
            records={sim.records} tournamentSummaries={sim.tournamentSummaries} tournamentSeed={sim.tournamentSeed}
            onClearHistory={sim.clearHistory}
          />
          <BoardInspectorDialog
            title={inspected?.title ?? ''} snapshot={inspected?.snapshot ?? null} onClose={() => setInspected(null)}
          />
        </>
      )}
    </div>
  );
}
