export function runChartCleanups(cleanups: Iterable<() => void>): void {
  for (const cleanup of cleanups) {
    try {
      cleanup();
    } catch {
      // Lightweight Charts cleanup can be called again during parent unmount.
    }
  }
}
