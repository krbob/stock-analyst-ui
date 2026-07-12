import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStockHistory } from '../api/queries';
import PriceChart from './PriceChart';

const chartMock = vi.hoisted(() => ({
  applyOptions: vi.fn(),
  remove: vi.fn(),
  setPreserveEmptyPane: vi.fn(),
  setStretchFactor: vi.fn(),
  subscribeCrosshairMove: vi.fn(),
  subscribeVisibleLogicalRangeChange: vi.fn(),
  fitContent: vi.fn(),
  priceScaleApplyOptions: vi.fn(),
}));

vi.mock('../api/queries', () => ({
  useStockHistory: vi.fn(() => ({ data: undefined, isFetching: false, error: null })),
}));

vi.mock('lightweight-charts', () => ({
  CandlestickSeries: 'CandlestickSeries',
  HistogramSeries: 'HistogramSeries',
  LineSeries: 'LineSeries',
  PriceScaleMode: { Logarithmic: 1, Normal: 0 },
  createSeriesMarkers: vi.fn(),
  createChart: vi.fn(() => ({
    applyOptions: chartMock.applyOptions,
    panes: () => [{
      setPreserveEmptyPane: chartMock.setPreserveEmptyPane,
      setStretchFactor: chartMock.setStretchFactor,
    }],
    priceScale: () => ({ applyOptions: chartMock.priceScaleApplyOptions }),
    remove: chartMock.remove,
    subscribeCrosshairMove: chartMock.subscribeCrosshairMove,
    timeScale: () => ({
      fitContent: chartMock.fitContent,
      subscribeVisibleLogicalRangeChange: chartMock.subscribeVisibleLogicalRangeChange,
    }),
  })),
}));

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('PriceChart request ownership', () => {
  it('uses shared history state without subscribing to the same symbol again', () => {
    render(
      <PriceChart
        symbol="AAPL"
        indicators={['sma50']}
        historyState={{ data: undefined, isFetching: true, error: null }}
      />,
    );

    expect(useStockHistory).toHaveBeenCalledWith('', '1y', undefined, ['sma50'], undefined, undefined);
  });

  it('retains its standalone query fallback when no shared state is provided', () => {
    render(<PriceChart symbol="AAPL" indicators={['sma50']} />);

    expect(useStockHistory).toHaveBeenCalledWith('AAPL', '1y', undefined, ['sma50'], undefined, undefined);
  });
});
