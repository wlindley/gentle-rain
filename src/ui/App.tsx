import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BotRegistry } from '../bots';
import type { GameSnapshot } from '../game';
import { LocalStorageScoreStore, SimulationSession, TournamentRunner } from '../simulation';
import type { BotRunRecord, TournamentSummary } from '../simulation';
import { BoardInspectorDialog } from './BoardInspectorDialog';
import { ControlBar, type SpeedMode } from './ControlBar';
import { LeaderboardPanel } from './LeaderboardPanel';
import { SimulationGridCanvas } from './SimulationGridCanvas';
import { StatsPanel } from './StatsPanel';

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);
const TURNS_PER_FRAME: Record<Exclude<SpeedMode, 'turbo'>, number> = { '1x': 1, '4x': 3, '20x': 12 };

export function App() {
  const registry = useMemo(() => BotRegistry.createDefault(), []);
  const store = useMemo(() => new LocalStorageScoreStore(), []);

  const [selectedBotId, setSelectedBotId] = useState(registry.bots[2]?.id ?? registry.bots[0]!.id);
  const [targetGames, setTargetGames] = useState(1000);
  const [parallelSlots, setParallelSlots] = useState(36);
  const [speed, setSpeed] = useState<SpeedMode>('4x');
  const [useFixedSeed, setUseFixedSeed] = useState(true);
  const [seed, setSeed] = useState(2026);
  const [isRunning, setIsRunning] = useState(false);
  const [isTournamentRunning, setIsTournamentRunning] = useState(false);
  const [records, setRecords] = useState<readonly BotRunRecord[]>(() => store.loadAll());
  const [tournamentSummaries, setTournamentSummaries] = useState<readonly TournamentSummary[]>([]);
  const [tournamentSeed, setTournamentSeed] = useState<number | null>(null);
  const [inspected, setInspected] = useState<{ title: string; snapshot: GameSnapshot } | null>(null);
  const [gamesPerSec, setGamesPerSec] = useState(0);
  const [, setTick] = useState(0);

  const sessionRef = useRef<SimulationSession | null>(null);
  const tournamentRef = useRef<TournamentRunner | null>(null);
  const savedRef = useRef(false);
  const rateRef = useRef({ lastTime: performance.now(), lastCompleted: 0 });
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const createSession = useCallback(
    (botId: string, games: number, slots: number, baseSeed: number) => {
      sessionRef.current = new SimulationSession({ bot: registry.require(botId), targetGames: games, parallelSlots: slots, baseSeed });
      savedRef.current = false;
      rateRef.current = { lastTime: performance.now(), lastCompleted: 0 };
      setGamesPerSec(0);
      setTick((t) => t + 1);
    },
    [registry],
  );

  if (!sessionRef.current) {
    sessionRef.current = new SimulationSession({
      bot: registry.require(selectedBotId),
      targetGames,
      parallelSlots,
      baseSeed: useFixedSeed ? seed : randomSeed(),
    });
  }

  const resetSession = useCallback(
    (botId = selectedBotId, games = targetGames, slots = parallelSlots, fixed = useFixedSeed, s = seed) => {
      setIsRunning(false);
      createSession(botId, games, slots, fixed ? s : randomSeed());
    },
    [selectedBotId, targetGames, parallelSlots, useFixedSeed, seed, createSession],
  );

  useEffect(() => {
    if (!isRunning && !isTournamentRunning) return;
    let rafId = 0;

    const frame = () => {
      if (isTournamentRunning && tournamentRef.current) {
        const runner = tournamentRef.current;
        const deadline = performance.now() + 12;
        while (!runner.isComplete && performance.now() < deadline) runner.stepGamesAll(5);
        setTournamentSummaries(runner.rankedSummaries);
        if (runner.isComplete) {
          const now = new Date().toISOString();
          for (const s of runner.sessions) {
            store.save(s.toRunRecord(`${s.config.bot.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, now, true));
          }
          setRecords(store.loadAll());
          setIsTournamentRunning(false);
          return;
        }
        rafId = requestAnimationFrame(frame);
        return;
      }

      const session = sessionRef.current;
      if (!session) return;
      const mode = speedRef.current;
      if (mode === 'turbo') {
        const deadline = performance.now() + 10;
        while (!session.isComplete && performance.now() < deadline) session.stepGames(25);
      } else {
        session.stepTurns(TURNS_PER_FRAME[mode]);
      }

      const now = performance.now();
      const dt = (now - rateRef.current.lastTime) / 1000;
      if (dt >= 0.25 || session.isComplete) {
        setGamesPerSec(dt > 0 ? (session.completedGames - rateRef.current.lastCompleted) / dt : 0);
        rateRef.current = { lastTime: now, lastCompleted: session.completedGames };
      }

      setTick((t) => t + 1);
      if (session.isComplete) {
        if (!savedRef.current) {
          savedRef.current = true;
          store.save(session.toRunRecord(`${session.config.bot.id}-${Date.now()}`, new Date().toISOString(), useFixedSeed));
          setRecords(store.loadAll());
        }
        setIsRunning(false);
        return;
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [isRunning, isTournamentRunning, store, targetGames, useFixedSeed]);

  const session = sessionRef.current;
  const activeBot = registry.require(selectedBotId);
  const slots = session.slotViews;

  const handleToggleRun = () => {
    if (session.isComplete) {
      createSession(selectedBotId, targetGames, parallelSlots, useFixedSeed ? seed : randomSeed());
      setIsRunning(true);
    } else {
      setIsRunning((r) => !r);
    }
  };

  const handleCompareAll = () => {
    const runSeed = useFixedSeed ? seed : randomSeed();
    setIsRunning(false);
    tournamentRef.current = new TournamentRunner(registry.bots, targetGames, Math.min(parallelSlots, 16), runSeed);
    setTournamentSeed(runSeed);
    setTournamentSummaries(tournamentRef.current.rankedSummaries);
    setIsTournamentRunning(true);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>A Gentle Rain</h1>
          <p>Parallel Monte Carlo Bot Simulator · {activeBot.description}</p>
        </div>
      </header>
      <ControlBar
        bots={registry.bots} selectedBotId={selectedBotId} targetGames={targetGames} parallelSlots={parallelSlots}
        speed={speed} useFixedSeed={useFixedSeed} seed={seed} isRunning={isRunning} isTournamentRunning={isTournamentRunning}
        onSelectBot={(id) => { setSelectedBotId(id); resetSession(id); }}
        onTargetGamesChange={(n) => { setTargetGames(n); resetSession(selectedBotId, n); }}
        onParallelSlotsChange={(n) => { setParallelSlots(n); resetSession(selectedBotId, targetGames, n); }}
        onSpeedChange={setSpeed}
        onToggleFixedSeed={(on) => { setUseFixedSeed(on); resetSession(selectedBotId, targetGames, parallelSlots, on); }}
        onSeedChange={(s) => { setSeed(s); resetSession(selectedBotId, targetGames, parallelSlots, useFixedSeed, s); }}
        onToggleRun={handleToggleRun} onReset={() => resetSession()} onCompareAll={handleCompareAll}
      />
      <main className="workspace-grid">
        <section className="panel" aria-label="Live parallel boards">
          <h2>Live Parallel Pond Grid ({slots.length} Active · Click any board to inspect)</h2>
          <SimulationGridCanvas
            slots={slots}
            onSelectSlot={(slot) => setInspected({ title: `${activeBot.name} — Game #${slot.gameIndex + 1}`, snapshot: slot.snapshot })}
          />
        </section>
        <StatsPanel
          botName={activeBot.name} completedGames={session.completedGames} targetGames={targetGames}
          gamesPerSec={gamesPerSec} stats={session.stats} bestSnapshot={session.bestSnapshot} worstSnapshot={session.worstSnapshot}
          onInspectSnapshot={(title, snapshot) => setInspected({ title, snapshot })}
        />
      </main>
      <LeaderboardPanel
        records={records} tournamentSummaries={tournamentSummaries} tournamentSeed={tournamentSeed}
        onClearHistory={() => { store.clear(); setRecords([]); }}
      />
      <BoardInspectorDialog
        title={inspected?.title ?? ''} snapshot={inspected?.snapshot ?? null} onClose={() => setInspected(null)}
      />
    </div>
  );
}
