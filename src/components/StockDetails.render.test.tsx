import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import StockDetails from './StockDetails';
import { useQuote } from '../api/queries';
import type { Quote } from '../api/types';

vi.mock('../api/queries', () => ({
  useQuote: vi.fn(),
}));

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    currency: 'USD',
    date: '2026-07-03',
    lastPrice: 150,
    gain: {
      daily: 0.01,
      weekly: null,
      monthly: null,
      quarterly: null,
      halfYearly: null,
      ytd: null,
      yearly: null,
      fiveYear: null,
    },
    peRatio: 25,
    pbRatio: 10,
    eps: 6,
    roe: 0.5,
    marketCap: 3e12,
    beta: 1.2,
    dividendYield: 0.005,
    dividendGrowth: 0.04,
    fiftyTwoWeekHigh: 200,
    fiftyTwoWeekLow: 100,
    sector: 'Technology',
    industry: 'Consumer Electronics',
    earningsDate: '2026-07-30',
    recommendation: 'buy',
    analystCount: 40,
    provenance: {
      source: 'YAHOO_FINANCE',
      retrievedAt: '2026-07-12T10:00:00Z',
      marketDate: '2026-07-03',
      currency: 'USD',
      unitScale: 1,
      adjustment: 'SPLIT_ADJUSTED',
      status: 'FRESH',
    },
    ...overrides,
  };
}

describe('StockDetails', () => {
  afterEach(() => {
    cleanup();
    vi.mocked(useQuote).mockReset();
  });

  it('shows an error state when quote data cannot be loaded', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('upstream unavailable'),
    } as ReturnType<typeof useQuote>);

    render(<StockDetails symbol="AAPL" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load stock details');
    expect(screen.getByText('upstream unavailable')).toBeInTheDocument();
  });

  it('shows a pulse skeleton while loading', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useQuote>);

    const { container } = render(<StockDetails symbol="AAPL" />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses shared quote state without subscribing to the same symbol again', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(
      <StockDetails
        symbol="AAPL"
        quoteState={{ data: makeQuote(), isLoading: false, error: null }}
      />,
    );

    expect(useQuote).toHaveBeenCalledWith('', undefined);
    expect(screen.getByText('Forward P/E')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the 52-week range meter positioned by the last price', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: makeQuote(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(<StockDetails symbol="AAPL" />);

    const meter = screen.getByRole('meter', { name: 'Position in 52-week range' });
    expect(meter).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText(/52W Low 100\.00/)).toBeInTheDocument();
    expect(screen.getByText(/52W High 200\.00/)).toBeInTheDocument();
  });

  it('falls back to plain 52-week items when range data is missing', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: makeQuote({ fiftyTwoWeekHigh: null }),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(<StockDetails symbol="AAPL" />);

    expect(screen.queryByRole('meter', { name: 'Position in 52-week range' })).not.toBeInTheDocument();
    expect(screen.getByText('52W High')).toBeInTheDocument();
    expect(screen.getByText('52W Low')).toBeInTheDocument();
  });

  it('renders the RSI gauge from the last indicator value', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: makeQuote(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(
      <StockDetails
        symbol="AAPL"
        indicators={{ rsi: [{ date: '2026-07-02', value: 40 }, { date: '2026-07-03', value: 72.4 }] }}
      />,
    );

    expect(screen.getByRole('meter', { name: 'RSI gauge' })).toHaveAttribute('aria-valuenow', '72');
  });

  it('omits the RSI gauge when no RSI data exists', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: makeQuote(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(<StockDetails symbol="AAPL" />);

    expect(screen.queryByRole('meter', { name: 'RSI gauge' })).not.toBeInTheDocument();
  });

  it('wires metric tooltips via role=tooltip and aria-describedby', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: makeQuote(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(<StockDetails symbol="AAPL" />);

    const label = screen.getByText('Forward P/E');
    const describedBy = label.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const tooltip = document.getElementById(describedBy!);
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    expect(tooltip).toHaveTextContent(/estimated future earnings/);
  });

  it('describes technical indicator windows using the selected candle interval', () => {
    vi.mocked(useQuote).mockReturnValue({
      data: makeQuote(),
      isLoading: false,
      error: null,
    } as ReturnType<typeof useQuote>);

    render(
      <StockDetails
        symbol="AAPL"
        interval="15m"
        indicators={{ sma50: [{ date: '2026-07-03', value: 150 }] }}
      />,
    );

    const label = screen.getByText('SMA 50 · 15m');
    const tooltip = document.getElementById(label.getAttribute('aria-describedby')!);
    expect(tooltip).toHaveTextContent('50-bar (15-minute candles)');
    expect(tooltip).not.toHaveTextContent('50-day');
  });
});
