import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CompareView from './CompareView';
import { useCompare, useStockHistory } from '../api/queries';
import type { Quote } from '../api/types';

vi.mock('../api/queries', () => ({
  useCompare: vi.fn(),
  useStockHistory: vi.fn(),
}));

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
      .toHaveTextContent('AAPL quote: 2026-07-10');
    expect(screen.getByRole('columnheader', { name: 'AAPL Apple Inc.' })).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toHaveClass('hidden', 'sm:block');
    expect(screen.getByText('Apple Inc.')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('row', { name: 'As of 2026-07-10' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: 'Forward P/E 25.00' })).toBeInTheDocument();
    expect(screen.queryByText('P/E')).not.toBeInTheDocument();
  });
});
