import { useMemo, useRef, useState } from 'react';
import { adviseMove } from '../bots';
import type { Bot, BotMoveAdvice } from '../bots';
import { Game } from '../game';
import type { BloomPlacement, FlowerColor, GameResult, GridCoord, PendingCornerBloom, Rotation } from '../game';
import { SeededRandomSource } from '../rng';
import { GameRunner } from '../simulation';

export type PlayTurnState =
  | { readonly kind: 'browsing'; readonly previewRotation: Rotation }
  | { readonly kind: 'selected'; readonly coord: GridCoord; readonly rotation: Rotation; readonly chosenBlooms: Readonly<Record<string, FlowerColor>> }
  | { readonly kind: 'must_discard' }
  | { readonly kind: 'complete'; readonly result: GameResult };

export interface BotBenchmark { readonly botName: string; readonly result: GameResult; }

const randomSeed = (): number => Math.floor(Math.random() * 1_000_000);

function nextTurnState(game: Game): PlayTurnState {
  if (game.isComplete) return { kind: 'complete', result: game.result! };
  return game.validPlacements.length === 0 ? { kind: 'must_discard' } : { kind: 'browsing', previewRotation: 0 };
}

function autoResolveBlooms(pending: readonly PendingCornerBloom[]): readonly BloomPlacement[] | null {
  if (pending.length === 0) return [];
  const used = new Set<FlowerColor>();
  const out: BloomPlacement[] = [];
  for (const { corner, eligibleColors } of pending) {
    if (eligibleColors.length > 1) return null;
    if (eligibleColors.length === 1) {
      const c = eligibleColors[0]!;
      if (used.has(c)) return null;
      used.add(c);
      out.push({ corner, color: c });
    }
  }
  return out;
}

function prefillBlooms(pending: readonly PendingCornerBloom[]): Record<string, FlowerColor> {
  const counts = new Map<FlowerColor, number>();
  for (const { eligibleColors } of pending) {
    if (eligibleColors.length === 1) counts.set(eligibleColors[0]!, (counts.get(eligibleColors[0]!) ?? 0) + 1);
  }
  const chosen: Record<string, FlowerColor> = {};
  for (const { corner, eligibleColors } of pending) {
    if (eligibleColors.length === 1 && counts.get(eligibleColors[0]!) === 1) chosen[corner.key] = eligibleColors[0]!;
  }
  return chosen;
}

function isSelectionConfirmable(pending: readonly PendingCornerBloom[], chosen: Readonly<Record<string, FlowerColor>>): boolean {
  const used = new Set<FlowerColor>();
  for (const { corner, eligibleColors } of pending) {
    const color = chosen[corner.key];
    if (!color) continue;
    if (!eligibleColors.includes(color) || used.has(color)) return false;
    used.add(color);
  }
  return pending.every(({ corner, eligibleColors }) => chosen[corner.key] !== undefined || !eligibleColors.some((c) => !used.has(c)));
}

export function usePlayController(bots: readonly Bot[]) {
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const gameRef = useRef<Game | null>(null);
  gameRef.current ??= Game.create(new SeededRandomSource(seed));

  const [turnState, setTurnState] = useState<PlayTurnState>(() => nextTurnState(gameRef.current!));
  const [advisorBotId, setAdvisorBotIdState] = useState<string>(() => bots.find((b) => b.id === 'heuristic')?.id ?? bots[0]!.id);
  const [showHint, setShowHint] = useState(false);
  const [autoShowHint, setAutoShowHintState] = useState(false);
  const [botBenchmark, setBotBenchmark] = useState<BotBenchmark | null>(null);
  const [, setTick] = useState(0);

  const game = gameRef.current;
  const snapshot = game.toSnapshot();
  const advisorBot = bots.find((b) => b.id === advisorBotId) ?? bots[0]!;

  const validRotationsByCoord = useMemo(() => {
    const map = new Map<string, Rotation[]>();
    for (const p of game.validPlacements) {
      const list = map.get(p.coord.key);
      if (list) list.push(p.rotation);
      else map.set(p.coord.key, [p.rotation]);
    }
    return map as ReadonlyMap<string, readonly Rotation[]>;
  }, [game, snapshot.turnNumber, seed]);

  const advice: BotMoveAdvice | null = useMemo(() => {
    const view = game.activeView;
    if (!showHint || !view) return null;
    return adviseMove(advisorBot, view, new SeededRandomSource((seed ^ Math.imul(view.turnNumber + 1, 2654435761)) >>> 0));
  }, [game, showHint, advisorBot, seed, snapshot.turnNumber]);

  const pendingCorners: readonly PendingCornerBloom[] =
    turnState.kind === 'selected' && !game.isComplete
      ? game.eligibleBloomsFor({ coord: turnState.coord, rotation: turnState.rotation })
      : [];
  const canConfirmSelected = turnState.kind === 'selected' && isSelectionConfirmable(pendingCorners, turnState.chosenBlooms);

  const syncTurn = (nextAutoHint = autoShowHint) => {
    setTurnState(nextTurnState(gameRef.current!));
    setShowHint(nextAutoHint);
    setTick((t) => t + 1);
  };
  const startNewGame = (nextSeed = randomSeed()) => {
    setSeed(nextSeed);
    gameRef.current = Game.create(new SeededRandomSource(nextSeed));
    setBotBenchmark(null);
    syncTurn(autoShowHint);
  };
  const selectWithRot = (coord: GridCoord, rotation: Rotation) =>
    setTurnState({ kind: 'selected', coord, rotation, chosenBlooms: prefillBlooms(game.eligibleBloomsFor({ coord, rotation })) });

  const rotatePreview = (delta: 1 | -1) => {
    if (turnState.kind === 'browsing') {
      setTurnState({ kind: 'browsing', previewRotation: ((turnState.previewRotation + delta + 4) % 4) as Rotation });
    } else if (turnState.kind === 'selected') {
      const rots = validRotationsByCoord.get(turnState.coord.key) ?? [];
      if (rots.length > 1) selectWithRot(turnState.coord, rots[(rots.indexOf(turnState.rotation) + delta + rots.length) % rots.length]!);
    }
  };
  const selectRotation = (rotation: Rotation) => {
    if (turnState.kind === 'browsing') setTurnState({ kind: 'browsing', previewRotation: rotation });
    else if (turnState.kind === 'selected' && validRotationsByCoord.get(turnState.coord.key)?.includes(rotation)) selectWithRot(turnState.coord, rotation);
  };
  const clickCoord = (coord: GridCoord) => {
    if (turnState.kind === 'complete' || turnState.kind === 'must_discard') return;
    const rots = validRotationsByCoord.get(coord.key);
    if (!rots || rots.length === 0) return;
    if (turnState.kind === 'selected' && turnState.coord.key === coord.key) { if (rots.length > 1) rotatePreview(1); return; }
    const preferred = turnState.kind === 'browsing' ? turnState.previewRotation : turnState.rotation;
    const rotation = rots.includes(preferred) ? preferred : rots[0]!;
    const pending = game.eligibleBloomsFor({ coord, rotation });
    const forced = autoResolveBlooms(pending);
    if (rots.length === 1 && forced !== null) { game.applyMove({ coord, rotation }, forced); syncTurn(); }
    else setTurnState({ kind: 'selected', coord, rotation, chosenBlooms: prefillBlooms(pending) });
  };
  const chooseBloom = (cornerKey: string, color: FlowerColor) => {
    if (turnState.kind === 'selected') setTurnState({ ...turnState, chosenBlooms: { ...turnState.chosenBlooms, [cornerKey]: color } });
  };
  const confirmSelection = () => {
    if (turnState.kind !== 'selected' || !canConfirmSelected) return;
    const blooms: BloomPlacement[] = [];
    for (const { corner } of pendingCorners) { const c = turnState.chosenBlooms[corner.key]; if (c) blooms.push({ corner, color: c }); }
    game.applyMove({ coord: turnState.coord, rotation: turnState.rotation }, blooms);
    syncTurn();
  };
  const discardTile = () => { if (turnState.kind === 'must_discard') { game.discardCurrentTile(); syncTurn(); } };
  const applyBotAdvice = () => {
    if (!advice || game.isComplete) return;
    if (advice.kind === 'discard') game.discardCurrentTile();
    else game.applyMove(advice.placement, advice.blooms);
    syncTurn();
  };

  return {
    seed, snapshot, turnState, validRotationsByCoord, pendingCorners, canConfirmSelected,
    advisorBotId, advisorBot, showHint, autoShowHint, advice, botBenchmark,
    startNewGame, replaySeed: () => startNewGame(seed),
    rotatePreview, selectRotation, clickCoord, chooseBloom, confirmSelection,
    cancelSelection: () => setTurnState((s) => (s.kind === 'selected' ? { kind: 'browsing', previewRotation: 0 } : s)),
    discardTile, applyBotAdvice,
    toggleHint: () => setShowHint((h) => !h),
    setAutoShowHint: (on: boolean) => { setAutoShowHintState(on); if (on) setShowHint(true); },
    setAdvisorBotId: (id: string) => { setAdvisorBotIdState(id); setBotBenchmark(null); },
    compareWithBotOnSeed: () => setBotBenchmark({ botName: advisorBot.name, result: new GameRunner(advisorBot, seed).runToCompletion() }),
  };
}
