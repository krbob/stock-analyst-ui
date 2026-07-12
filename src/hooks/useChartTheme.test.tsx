import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartTheme } from '../lib/chart-theme';
import { useChartTheme } from './useChartTheme';

const mocks = vi.hoisted(() => ({
  readChartTheme: vi.fn(),
  chartThemesEqual: vi.fn(),
  subscribeChartTheme: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock('../lib/chart-theme', () => ({
  readChartTheme: mocks.readChartTheme,
  chartThemesEqual: mocks.chartThemesEqual,
  subscribeChartTheme: mocks.subscribeChartTheme,
}));

const initialTheme = {
  background: '#fff',
  text: '#111',
  grid: '#eee',
  scaleBorder: '#ccc',
  up: '#060',
  down: '#900',
  accent: '#00f',
  compareColors: ['#00f'],
  indicatorColors: {
    sma50: '#111',
    sma200: '#222',
    ema50: '#333',
    ema200: '#444',
    bb_upper: '#555',
    bb_middle: '#666',
    bb_lower: '#777',
    rsi: '#888',
    macd: '#999',
    macd_signal: '#aaa',
  },
  dividend: '#70a',
} satisfies ChartTheme;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readChartTheme.mockReturnValue(initialTheme);
});

afterEach(cleanup);

describe('useChartTheme', () => {
  it('preserves identity for equal tokens, updates changed tokens and unsubscribes', () => {
    let notify = () => {};
    mocks.subscribeChartTheme.mockImplementation((listener: () => void) => {
      notify = listener;
      return mocks.unsubscribe;
    });
    mocks.chartThemesEqual.mockReturnValueOnce(true).mockReturnValueOnce(false);
    const { result, unmount } = renderHook(() => useChartTheme());
    const first = result.current;

    act(notify);
    expect(result.current).toBe(first);

    const changed = { ...initialTheme, accent: '#123456' };
    mocks.readChartTheme.mockReturnValue(changed);
    act(notify);
    expect(result.current).toEqual(changed);
    expect(result.current).not.toBe(first);

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
