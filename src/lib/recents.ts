interface RecentStoreOptions<T> {
  maxItems: number;
  normalize: (value: unknown) => T | null;
  keyOf: (item: T) => string;
  mergeDuplicate?: (current: T, next: T) => T;
}

export function loadRecentItems<T>(storageKey: string, options: RecentStoreOptions<T>): T[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];

    const values = JSON.parse(stored);
    if (!Array.isArray(values)) return [];

    const seen = new Map<string, T>();
    for (const raw of values) {
      const item = options.normalize(raw);
      if (!item) continue;
      const key = options.keyOf(item);
      const current = seen.get(key);
      seen.set(key, current && options.mergeDuplicate ? options.mergeDuplicate(current, item) : current ?? item);
    }
    return [...seen.values()];
  } catch {
    return [];
  }
}

export function addRecentItem<T>(storageKey: string, item: T, options: RecentStoreOptions<T>): T[] {
  const key = options.keyOf(item);
  const recents = loadRecentItems(storageKey, options).filter((recent) => options.keyOf(recent) !== key);
  const next = [item, ...recents].slice(0, options.maxItems);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

export function removeRecentItem<T>(storageKey: string, key: string, options: RecentStoreOptions<T>): T[] {
  const next = loadRecentItems(storageKey, options).filter((recent) => options.keyOf(recent) !== key);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}
