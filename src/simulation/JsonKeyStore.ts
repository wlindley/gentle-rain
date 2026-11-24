export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export class JsonKeyStore<T> {
  constructor(
    private readonly key: string,
    private readonly storage: StorageLike = globalThis.localStorage,
  ) {}

  read(revive: (parsed: unknown) => T | null): T | null {
    const raw = this.storage.getItem(this.key);
    if (raw === null) return null;
    try {
      return revive(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  write(value: unknown): void {
    this.storage.setItem(this.key, JSON.stringify(value));
  }

  clear(): void {
    this.storage.removeItem(this.key);
  }
}
