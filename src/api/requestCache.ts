/**
 * An in-memory cache of request results for one visit to the site.
 *
 * Callers asking for the same key share one request, a result is reused until
 * it is older than the caller's maxAgeMs, failures are never kept, and the
 * least recently used entries are dropped past `limit`. A caller's abort signal
 * stops that caller waiting; it does not cancel the shared request, so another
 * page that needs the same data still gets it.
 */
type Entry = { promise: Promise<unknown>; at: number; settled: boolean; value?: unknown };

export function createRequestCache(limit = 200, now: () => number = () => Date.now()) {
  const entries = new Map<string, Entry>();
  const trim = () => {
    while (entries.size > limit) entries.delete(entries.keys().next().value as string);
  };
  const fresh = (key: string, maxAgeMs: number) => {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (now() - entry.at > maxAgeMs) {
      entries.delete(key);
      return undefined;
    }
    entries.delete(key); // most recently used
    entries.set(key, entry);
    return entry;
  };
  const store = (key: string, promise: Promise<unknown>) => {
    const entry: Entry = { promise, at: now(), settled: false };
    entries.set(key, entry);
    promise.then(
      (value) => {
        entry.settled = true;
        entry.value = value;
      },
      () => {
        if (entries.get(key) === entry) entries.delete(key);
      },
    );
    trim();
    return entry;
  };
  return {
    get<T>(key: string, load: () => Promise<T>, maxAgeMs: number, signal?: AbortSignal): Promise<T> {
      const entry = fresh(key, maxAgeMs) ?? store(key, load());
      return untilAborted(entry.promise as Promise<T>, signal);
    },
    /** The result if it is already here and fresh, without waiting. */
    peek<T>(key: string, maxAgeMs: number): T | undefined {
      const entry = fresh(key, maxAgeMs);
      return entry?.settled ? (entry.value as T) : undefined;
    },
    set<T>(key: string, value: T) {
      store(key, Promise.resolve(value));
    },
    get size() {
      return entries.size;
    },
  };
}

function untilAborted<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  const aborted = () => signal.reason ?? new DOMException("The request was cancelled.", "AbortError");
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise<T>((resolve, reject) => {
    const stop = () => reject(aborted());
    signal.addEventListener("abort", stop, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", stop);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", stop);
        reject(error);
      },
    );
  });
}
