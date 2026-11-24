import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BotRegistry } from '../bots';
import { EvolvedBot, LocalStorageEvolutionStore } from '../evolution';
import type { Genome, GenomeEvaluation } from '../evolution';
import { LocalStorageScoreStore, SimulationSession, TournamentRunner } from '../simulation';
import type { BotRunRecord, TournamentSummary } from '../simulation';
import type { SpeedMode } from './ControlBar';

export type RunMode = 'idle' | 'simulating' | 'tournament';

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);
const TURNS_PER_FRAME: Record<'1x' | '4x' | '20x', number> = { '1x': 1, '4x': 3, '20x': 12 };
const SLOW_STEP_INTERVAL_MS = 167;

export function useSimulationController() {
  const evolutionStore = useMemo(() => new LocalStorageEvolutionStore(), []);
  const registry = useMemo(() => {
    const reg = BotRegistry.createDefault();
    for (const ch of evolutionStore.loadChampions()) {
      const bot = new EvolvedBot(ch.evaluation.genome, ch.name);
      if (!reg.has(bot.id)) reg.register(bot);
    }
    return reg;
  }, [evolutionStore]);
  const store = useMemo(() => new LocalStorageScoreStore(), []);

  const [selectedBotId, setSelectedBotId] = useState(registry.bots[2]?.id ?? registry.bots[0]!.id);
  const [targetGames, setTargetGames] = useState(1000);
  const [parallelSlots, setParallelSlots] = useState(36);
  const [speed, setSpeed] = useState<SpeedMode>('4x');
  const [useFixedSeed, setUseFixedSeed] = useState(true);
  const [seed, setSeed] = useState(2026);
  const [runMode, setRunMode] = useState<RunMode>('idle');
  const [records, setRecords] = useState<readonly BotRunRecord[]>(() => store.loadAll());
  const [tournamentSummaries, setTournamentSummaries] = useState<readonly TournamentSummary[]>([]);
  const [tournamentSeed, setTournamentSeed] = useState<number | null>(null);
  const [gamesPerSec, setGamesPerSec] = useState(0);
  const [, setTick] = useState(0);

  const sessionRef = useRef<SimulationSession | null>(null);
  const tournamentRef = useRef<TournamentRunner | null>(null);
  const savedRef = useRef(false);
  const rateRef = useRef({ lastTime: performance.now(), lastCompleted: 0 });
  const lastSlowStepRef = useRef(0);
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

  sessionRef.current ??= new SimulationSession({
    bot: registry.require(selectedBotId), targetGames, parallelSlots, baseSeed: useFixedSeed ? seed : randomSeed(),
  });

  const reset = useCallback(
    (botId = selectedBotId, games = targetGames, slots = parallelSlots, fixed = useFixedSeed, s = seed) => {
      setRunMode('idle');
      createSession(botId, games, slots, fixed ? s : randomSeed());
    },
    [selectedBotId, targetGames, parallelSlots, useFixedSeed, seed, createSession],
  );

  useEffect(() => {
    if (runMode === 'idle') return;
    let rafId = 0;

    const frame = () => {
      if (runMode === 'tournament' && tournamentRef.current) {
        const runner = tournamentRef.current;
        const deadline = performance.now() + 12;
        while (!runner.isComplete && performance.now() < deadline) runner.stepGamesAll(5);
        setTournamentSummaries(runner.rankedSummaries);
        if (runner.isComplete) {
          const nowIso = new Date().toISOString();
          for (const s of runner.sessions) store.save(s.toRunRecord(`${s.config.bot.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nowIso, true));
          setRecords(store.loadAll());
          setRunMode('idle');
        } else rafId = requestAnimationFrame(frame);
        return;
      }
      const session = sessionRef.current;
      if (!session) return;
      const now = performance.now();
      const mode = speedRef.current;
      if (mode === 'turbo') {
        const deadline = now + 10;
        while (!session.isComplete && performance.now() < deadline) session.stepGames(25);
      } else if (mode === '0.1x') {
        if (now - lastSlowStepRef.current < SLOW_STEP_INTERVAL_MS) { rafId = requestAnimationFrame(frame); return; }
        lastSlowStepRef.current = now;
        session.stepTurns(1);
      } else session.stepTurns(TURNS_PER_FRAME[mode]);
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
        setRunMode('idle');
      } else rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [runMode, store, useFixedSeed]);

  const session = sessionRef.current;
  const activeBot = registry.require(selectedBotId);

  const toggleRun = () => {
    if (session.isComplete) {
      createSession(selectedBotId, targetGames, parallelSlots, useFixedSeed ? seed : randomSeed());
      setRunMode('simulating');
    } else setRunMode((m) => (m === 'simulating' ? 'idle' : 'simulating'));
  };

  const compareAll = () => {
    const runSeed = useFixedSeed ? seed : randomSeed();
    tournamentRef.current = new TournamentRunner({ bots: registry.bots, targetGames, parallelSlots: Math.min(parallelSlots, 16), baseSeed: runSeed });
    setTournamentSeed(runSeed);
    setTournamentSummaries(tournamentRef.current.rankedSummaries);
    setRunMode('tournament');
  };

  const registerEvolvedBot = (genome: Genome, evaluation: GenomeEvaluation | null) => {
    const label = `Evolved Gen ${genome.generation} (${genome.id})`;
    const bot = new EvolvedBot(genome, label);
    if (!registry.has(bot.id)) registry.register(bot);
    if (evaluation) evolutionStore.saveChampion({ id: bot.id, name: label, savedAtIso: new Date().toISOString(), evaluation });
    setSelectedBotId(bot.id);
    reset(bot.id);
  };

  return {
    bots: registry.bots, activeBot, session, slots: session.slotViews,
    selectedBotId, targetGames, parallelSlots, speed, useFixedSeed, seed,
    runMode, records, tournamentSummaries, tournamentSeed, gamesPerSec,
    selectBot: (id: string) => { setSelectedBotId(id); reset(id); },
    changeTargetGames: (n: number) => { setTargetGames(n); reset(selectedBotId, n); },
    changeParallelSlots: (n: number) => { setParallelSlots(n); reset(selectedBotId, targetGames, n); },
    setSpeed,
    toggleFixedSeed: (on: boolean) => { setUseFixedSeed(on); reset(selectedBotId, targetGames, parallelSlots, on); },
    changeSeed: (s: number) => { setSeed(s); reset(selectedBotId, targetGames, parallelSlots, useFixedSeed, s); },
    toggleRun, pause: () => setRunMode('idle'), reset: () => reset(), compareAll,
    clearHistory: () => { store.clear(); setRecords([]); },
    registerEvolvedBot,
  };
}
