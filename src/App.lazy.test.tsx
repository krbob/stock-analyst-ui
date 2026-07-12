import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => ({
  priceMount: vi.fn(),
  priceUnmount: vi.fn(),
  compareMount: vi.fn(),
  compareUnmount: vi.fn(),
  detailsMount: vi.fn(),
  detailsUnmount: vi.fn(),
}));

vi.mock('./components/PriceChart', async () => {
  const { useEffect } = await import('react');
  return {
    default: function MockPriceChart() {
      useEffect(() => {
        lifecycle.priceMount();
        return lifecycle.priceUnmount;
      }, []);
      return <div data-testid="price-chart-module">Price chart</div>;
    },
  };
});

vi.mock('./components/CompareView', async () => {
  const { useEffect } = await import('react');
  return {
    default: function MockCompareView() {
      useEffect(() => {
        lifecycle.compareMount();
        return lifecycle.compareUnmount;
      }, []);
      return <div data-testid="comparison-module">Comparison view</div>;
    },
  };
});

vi.mock('./components/StockDetails', async () => {
  const { useEffect } = await import('react');
  return {
    default: function MockStockDetails() {
      useEffect(() => {
        lifecycle.detailsMount();
        return lifecycle.detailsUnmount;
      }, []);
      return <div data-testid="stock-details-module">Stock details</div>;
    },
  };
});

vi.mock('./components/TickerSearch', () => ({
  default: function MockTickerSearch() {
    return <div data-testid="ticker-search" />;
  },
}));

vi.mock('./api/queries', () => ({
  useQuote: () => ({ data: undefined, error: null, isLoading: false }),
  useStockHistory: () => ({ data: undefined }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/');
});

describe('App lazy analysis modes', () => {
  it('unmounts the inactive heavy view when switching modes', async () => {
    window.history.replaceState(null, '', '/?s=AAPL');
    const { default: App } = await import('./App');
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByTestId('price-chart-module')).toBeInTheDocument();
    expect(await screen.findByTestId('stock-details-module')).toBeInTheDocument();
    expect(lifecycle.priceMount).toHaveBeenCalledTimes(1);
    expect(lifecycle.detailsMount).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('comparison-module')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(await screen.findByTestId('comparison-module')).toBeInTheDocument();
    expect(screen.queryByTestId('price-chart-module')).not.toBeInTheDocument();
    expect(screen.queryByTestId('stock-details-module')).not.toBeInTheDocument();
    expect(lifecycle.priceUnmount).toHaveBeenCalledTimes(1);
    expect(lifecycle.detailsUnmount).toHaveBeenCalledTimes(1);
    expect(lifecycle.compareMount).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Compare' }));

    expect(await screen.findByTestId('price-chart-module')).toBeInTheDocument();
    expect(await screen.findByTestId('stock-details-module')).toBeInTheDocument();
    expect(screen.queryByTestId('comparison-module')).not.toBeInTheDocument();
    expect(lifecycle.compareUnmount).toHaveBeenCalledTimes(1);
    expect(lifecycle.priceMount).toHaveBeenCalledTimes(2);
    expect(lifecycle.detailsMount).toHaveBeenCalledTimes(2);
  });
});
