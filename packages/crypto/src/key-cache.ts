/**
 * A small, bounded, time-limited cache of unwrapped data keys.
 *
 * Without it, rendering a 200-message transcript costs 200 KMS round trips.
 * With it, one. The trade is that unwrapped key material lives in process
 * memory for up to `ttlMs` — so keep the TTL short and the cache small, and
 * note that this is exactly the exposure the threat model already accepts
 * (the running app must hold keys to translate and moderate at all).
 */
export class DataKeyCache {
  readonly #entries = new Map<string, { key: Uint8Array; expiresAt: number }>();
  readonly #maxEntries: number;
  readonly #ttlMs: number;

  constructor(options: { maxEntries?: number; ttlMs?: number } = {}) {
    this.#maxEntries = options.maxEntries ?? 256;
    this.#ttlMs = options.ttlMs ?? 5 * 60_000;
  }

  get(cacheKey: string): Uint8Array | null {
    const hit = this.#entries.get(cacheKey);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.#entries.delete(cacheKey);
      return null;
    }
    // Refresh recency for the LRU eviction below.
    this.#entries.delete(cacheKey);
    this.#entries.set(cacheKey, hit);
    return hit.key;
  }

  set(cacheKey: string, key: Uint8Array): void {
    if (this.#entries.size >= this.#maxEntries) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
    this.#entries.set(cacheKey, { key, expiresAt: Date.now() + this.#ttlMs });
  }

  /** Drop everything. Call on key rotation or when a conversation is purged. */
  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    return this.#entries.size;
  }
}
