import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CompareView from './CompareView';
import { useCompare, useStockHistory } from '../api/queries';

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

    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load comparison data');
    expect(screen.getByText('503 upstream unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading comparison data' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry comparison' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
