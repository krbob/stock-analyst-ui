import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import StockDetails from './StockDetails';
import { useQuote } from '../api/queries';

vi.mock('../api/queries', () => ({
  useQuote: vi.fn(),
}));

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
});
