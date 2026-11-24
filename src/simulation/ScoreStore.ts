import { JsonKeyStore, type StorageLike } from './JsonKeyStore';

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
  private readonly store: JsonKeyStore<BotRunRecord[]>;

  constructor(storageKey = 'gentle-rain:bot-runs:v1', storage?: StorageLike) {
    this.store = new JsonKeyStore<BotRunRecord[]>(storageKey, storage);
  }

  loadAll(): readonly BotRunRecord[] {
    return this.store.read((parsed) => (Array.isArray(parsed) ? (parsed as BotRunRecord[]).map(cloneRecord) : null)) ?? [];
  }

  save(record: BotRunRecord): void {
    this.store.write([...this.loadAll(), cloneRecord(record)]);
  }

  clear(): void {
    this.store.clear();
  }
}
