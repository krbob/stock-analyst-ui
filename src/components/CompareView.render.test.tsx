import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CompareView from './CompareView';
import { useCompare, useStockHistory } from '../api/queries';
import type { Quote } from '../api/types';

vi.mock('../api/queries', () => ({
  useCompare: vi.fn(),
  useStockHistory: vi.fn(),
}));

function makeComparisonQuote(symbol: string, lastPrice: number, dailyGain: number): Quote {
  return {
    symbol,
    name: `${symbol} Inc.`,
    date: '2026-07-10',
    currency: 'USD',
    lastPrice,
    marketCap: lastPrice * 100_000_000,
    peRatio: lastPrice / 10,
    pbRatio: lastPrice / 50,
    eps: lastPrice / 20,
    roe: lastPrice / 1_000,
    beta: 1,
    dividendYield: lastPrice / 10_000,
    dividendGrowth: lastPrice / 20_000,
    gain: {
      daily: dailyGain,
      weekly: null,
      monthly: null,
      quarterly: null,
      halfYearly: null,
      ytd: null,
      yearly: null,
      fiveYear: null,
    },
    provenance: {
      source: 'YAHOO_FINANCE',
      retrievedAt: '2026-07-12T10:00:00Z',
      marketDate: '2026-07-10',
      currency: 'USD',
      unitScale: 1,
      adjustment: 'SPLIT_ADJUSTED',
      status: 'FRESH',
    },
  } as Quote;
}

describe('CompareView rendering', () => {
  afterEach(() => {
    cleanup();
    vi.mocked(useCompare).mockReset();
    vi.mocked(useStockHistory).mockReset();
  });

  it('shows a retryable error instead of an endless table spinner', () => {
    const refetch = vi.fn();
    vi.mocked(useStockHistory).mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useStockHistory>);
    vi.mocked(useCompare).mockReturnValue({
      data: undefined,
      error: new Error('503 upstream unavailable'),
      isLoading: false,
      refetch,
    } as unknown as ReturnType<typeof useCompare>);

    render(<CompareView symbols={['AAPL', 'MSFT']} period="1y" />);

    const chart = screen.getByRole('img', { name: 'Percentage comparison chart for AAPL, MSFT' });
    const description = document.getElementById(chart.getAttribute('aria-describedby')!);
    expect(chart).toHaveAttribute('tabindex', '0');
    expect(description).toHaveTextContent('0 of 2 series loaded');
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load comparison data');
    expect(screen.getByText('503 upstream unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading comparison data' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry comparison' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('shows each quote market date and labels forward valuation consistently', () => {
    vi.mocked(useStockHistory).mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useStockHistory>);
    vi.mocked(useCompare).mockReturnValue({
      data: [{
        symbol: 'AAPL',
        data: {
          symbol: 'AAPL',
          name: 'Apple Inc.',
          date: '2026-07-10',
          lastPrice: 200,
          peRatio: 25,
          gain: {
            daily: null,
            weekly: null,
            monthly: null,
            quarterly: null,
            halfYearly: null,
            ytd: null,
            yearly: null,
            fiveYear: null,
          },
          provenance: {
            source: 'YAHOO_FINANCE',
            retrievedAt: '2026-07-12T10:00:00Z',
            marketDate: '2026-07-10',
            currency: 'USD',
            unitScale: 1,
            adjustment: 'SPLIT_ADJUSTED',
            status: 'FRESH',
          },
        } as Quote,
        error: null,
      }],
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCompare>);

    render(<CompareView symbols={['AAPL']} period="1y" />);

    const tableRegion = screen.getByRole('region', { name: 'Scrollable stock comparison table' });
    expect(tableRegion).toHaveAttribute('tabindex', '0');
    expect(tableRegion.querySelector('table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Metric' })).toHaveClass('sticky', 'left-0');
    expect(screen.getByText('As of')).toHaveClass('sticky', 'left-0');
    expect(within(tableRegion).getByText('2026-07-10')).toHaveClass('whitespace-nowrap');
    expect(screen.getByRole('region', { name: 'Comparison market data provenance' }))
      .toHaveTextContent('AAPL quote inputs: 2026-07-10');
    expect(screen.getByRole('columnheader', { name: 'AAPL Apple Inc.' })).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toHaveClass('hidden', 'sm:block');
    expect(screen.getByText('Apple Inc.')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('row', { name: 'As of 2026-07-10' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Forward P/E 25.00' })).toBeInTheDocument();
    expect(screen.queryByText('P/E')).not.toBeInTheDocument();
  });

  it('keeps descriptive metrics neutral and highlights only the highest comparable return', () => {
    vi.mocked(useStockHistory).mockReturnValue({
      data: undefined,
      error: null,
      isFetching: false,
    } as ReturnType<typeof useStockHistory>);
    vi.mocked(useCompare).mockReturnValue({
      data: [
        { symbol: 'AAPL', data: makeComparisonQuote('AAPL', 100, 0.01), error: null },
        { symbol: 'MSFT', data: makeComparisonQuote('MSFT', 200, 0.02), error: null },
      ],
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCompare>);

    render(<CompareView symbols={['AAPL', 'MSFT']} period="1y" />);

    expect(screen.getByText(/highlights mark only the highest return/i)).toBeInTheDocument();
    for (const label of ['Price', 'Market Cap', 'Forward P/E', 'P/B', 'EPS', 'ROE', 'Div Yield', 'Div Growth']) {
      const row = screen.getByRole('row', { name: new RegExp(`^${label}`) });
      for (const cell of within(row).getAllByRole('cell').slice(1)) {
        expect(cell).not.toHaveClass('text-highlight');
        expect(cell).not.toHaveAttribute('title');
      }
    }

    const dailyRow = screen.getByRole('row', { name: /^Daily/ });
    expect(within(dailyRow).getByText('+1.00%')).not.toHaveClass('text-highlight');
    expect(within(dailyRow).getByText('+2.00%')).toHaveClass('text-highlight', 'font-semibold');
    expect(within(dailyRow).getByText('+2.00%')).toHaveAttribute(
      'title',
      'Highest period return in this comparison',
    );
  });
});
