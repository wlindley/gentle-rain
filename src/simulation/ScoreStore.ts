export interface BotRunRecord {
  readonly id: string;
  readonly botId: string;
  readonly botName: string;
  readonly timestampIso: string;
  readonly baseSeed: number | null;
  readonly totalGames: number;
  readonly winCount: number;
  readonly winRate: number;
  readonly meanScore: number;
  readonly medianScore: number;
  readonly p95Score: number;
  readonly p99Score: number;
  readonly minScore: number;
  readonly maxScore: number;
  readonly meanBlooms: number;
  readonly scoreHistogram: Record<string, number>;
}

export interface ScoreStore {
  loadAll(): readonly BotRunRecord[];
  save(record: BotRunRecord): void;
  clear(): void;
}

const cloneRecord = (record: BotRunRecord): BotRunRecord => ({
  ...record,
  scoreHistogram: { ...record.scoreHistogram },
});

export class InMemoryScoreStore implements ScoreStore {
  private records: BotRunRecord[] = [];

  loadAll(): readonly BotRunRecord[] {
    return this.records.map(cloneRecord);
  }

  save(record: BotRunRecord): void {
    this.records.push(cloneRecord(record));
  }

  clear(): void {
    this.records = [];
  }
}

export class LocalStorageScoreStore implements ScoreStore {
  constructor(
    private readonly storageKey = 'gentle-rain:bot-runs:v1',
    private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = globalThis.localStorage,
  ) {}

  loadAll(): readonly BotRunRecord[] {
    const raw = this.storage.getItem(this.storageKey);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BotRunRecord[]) : [];
    } catch {
      return [];
    }
  }

  save(record: BotRunRecord): void {
    const updated = [...this.loadAll(), cloneRecord(record)];
    this.storage.setItem(this.storageKey, JSON.stringify(updated));
  }

  clear(): void {
    this.storage.removeItem(this.storageKey);
  }
}
