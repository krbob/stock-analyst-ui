import { describe, expect, it, vi } from 'vitest';
import { runChartCleanups } from './chart-lifecycle';

describe('PriceChart lifecycle cleanup', () => {
  it('continues cleanup when a chart resource was already removed', () => {
    const remainingCleanup = vi.fn();

    expect(() => runChartCleanups([
      () => { throw new Error('object already disposed'); },
      remainingCleanup,
    ])).not.toThrow();
    expect(remainingCleanup).toHaveBeenCalledTimes(1);
  });
});
